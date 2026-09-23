import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import {
  istVerwaltung,
  statusPasstZuAlter,
  baldStatuswechsel,
} from "../../shared/mitgliedBerechtigung.ts";

/**
 * Liefert den kompakten Handlungsbedarf für /mitglieder (nur Verwaltung):
 *  - offene Mitgliedsanträge
 *  - anstehende Geburtstage (nächste 30 Tage)
 *  - altersbedingt bald nötige Statusprüfung
 *  - anstehende Ehrungen (zuverlässig aus Ehrungsdaten/Regeln berechnet)
 *
 * KEIN Warnungs-Raten, KEIN "noch nie eingeladen", KEIN Spartenzuordnungs-Hinweis.
 */
// Geburtstage sind Kalendertage des Vereins (Europe/Berlin), keine UTC-Zeitpunkte.
// Datumsdifferenzen in UTC berechnen, damit Sommer-/Winterzeit keine Tage verschiebt.
function naechsteGeburtstageInfo(geb, jetzt = new Date()) {
  if (typeof geb !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(geb);
  if (!match) return null;
  const [jahr, monat, tag] = match.slice(1).map(Number);
  const geboren = new Date(Date.UTC(jahr, monat - 1, tag));
  if (geboren.getUTCFullYear() !== jahr || geboren.getUTCMonth() !== monat - 1 || geboren.getUTCDate() !== tag) return null;

  const teile = Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(jetzt);
  const heute = Object.fromEntries(teile.map(({ type, value }) => [type, Number(value)]));
  const heuteTag = Date.UTC(heute.year, heute.month - 1, heute.day);
  // Ein 29. Februar fällt in Nicht-Schaltjahren auf den 1. März (wie zuvor).
  let naechste = new Date(Date.UTC(heute.year, monat - 1, tag));
  if (naechste.getTime() < heuteTag) naechste = new Date(Date.UTC(heute.year + 1, monat - 1, tag));
  const tage = Math.round((naechste.getTime() - heuteTag) / 86400000);
  return { tage, wirdAlter: naechste.getUTCFullYear() - jahr, datum: naechste.toISOString().slice(0, 10) };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!istVerwaltung(user)) {
      return Response.json({ error: "Access Denied", message: "Nur Verwaltung." }, { status: 403 });
    }
    const S = base44.asServiceRole.entities;

    const [mitglieder, antraege, ehrungen, teilnahmen, veranstaltungen] = await Promise.all([
      S.Mitglied.list("nachname", 2000),
      S.Mitgliedsantrag.list("-created_date", 200),
      S.Ehrung.list("-created_date", 1000),
      S.Teilnahme.list("-created_date", 3000),
      S.Veranstaltung.list("-datum", 1000),
    ]);

    // 1. Offene Mitgliedsanträge (Neu / In Bearbeitung)
    const offeneAntraege = (antraege || []).filter(a =>
      a.status === "Neu" || a.status === "In Bearbeitung"
    ).map(a => ({
      id: a.id, vorname: a.vorname, nachname: a.nachname, status: a.status,
      created_date: a.created_date, sparte: a.sparte,
    }));

    // 2. Anstehende Geburtstage (nächste 30 Tage, nur nicht-archivierte, lebendige)
    const in30 = [];
    for (const m of (mitglieder || [])) {
      if (m.archiviert) continue;
      if (m.mitgliedsstatus === "Verstorben") continue;
      const g = naechsteGeburtstageInfo(m.geburtsdatum);
      if (g && g.tage >= 0 && g.tage <= 30) {
        in30.push({
          id: m.id, vorname: m.vorname, nachname: m.nachname,
          tage: g.tage, wirdAlter: g.wirdAlter, datum: g.datum,
        });
      }
    }
    in30.sort((a, b) => a.tage - b.tage);

    // 3. Altersbedingt bald nötige Statusprüfung
    const statusPruefung = [];
    for (const m of (mitglieder || [])) {
      if (m.archiviert) continue;
      if (m.mitgliedsstatus === "Verstorben") continue;
      // a) Status passt nicht zum Alter (akuter Handlungsbedarf)
      const warn = statusPasstZuAlter(m.geburtsdatum, m.mitgliedsstatus);
      if (warn) {
        statusPruefung.push({
          id: m.id, vorname: m.vorname, nachname: m.nachname,
          typ: "falsch", text: warn, alter: null,
        });
        continue;
      }
      // b) Baldige Stufengrenze (Geburtstag in <= 90 Tagen)
      const bald = baldStatuswechsel(m.geburtsdatum, m.mitgliedsstatus);
      if (bald) {
        statusPruefung.push({
          id: m.id, vorname: m.vorname, nachname: m.nachname,
          typ: "bald", text: bald.hinweis || `Bald ${bald.zielStatus}`,
          alter: bald.wirdAlter, tage: bald.tageBisGeburtstag,
        });
      }
    }

    // 4. Anstehende Ehrungen (zuverlässig berechnet)
    //    Mitgliedsjahre: anrechenbare Jahre ab 18. Geburtstag; Stufe fällig wenn
    //    Jahre > Stufe und Stufe weder verliehen noch geplant.
    //    Umzüge: adult count + historisch; Stufe fällig wenn >= Stufe und nicht verliehen/geplant.
    const anstehendeEhrungen = [];
    const vMap = {};
    for (const v of (veranstaltungen || [])) vMap[v.id] = v;
    const MITGLIEDS_STUFEN = [10, 20, 30, 40, 50, 60, 70, 80];
    const UMZUGS_STUFEN = [66, 99, 133, 166, 199, 222, 266, 299, 333];

    for (const m of (mitglieder || [])) {
      if (m.archiviert || m.mitgliedsstatus === "Verstorben") continue;
      if (!m.geburtsdatum || !m.eintrittsdatum) continue;
      const meineEhrungen = (ehrungen || []).filter(e => e.mitglied_id === m.id);
      // Anrechenbare Mitgliedsjahre
      const geb = new Date(m.geburtsdatum);
      const eintr = new Date(m.eintrittsdatum);
      const achtzehn = new Date(geb.getFullYear() + 18, geb.getMonth(), geb.getDate());
      const start = eintr > achtzehn ? eintr : achtzehn;
      const ende = m.austrittsdatum ? new Date(m.austrittsdatum) : new Date();
      let mjahre = 0;
      if (start <= ende) {
        mjahre = ende.getFullYear() - start.getFullYear();
        const dm = ende.getMonth() - start.getMonth();
        if (dm < 0 || (dm === 0 && ende.getDate() < start.getDate())) mjahre--;
      }
      const verliehenM = meineEhrungen.filter(e => e.typ === "Mitgliedsjahre" && e.status === "Verliehen").map(e => Number(e.wert));
      const geplantM = meineEhrungen.filter(e => e.typ === "Mitgliedsjahre" && e.status === "Geplant").map(e => Number(e.wert));
      for (const stufe of MITGLIEDS_STUFEN) {
        if (mjahre > stufe && !verliehenM.includes(stufe) && !geplantM.includes(stufe)) {
          anstehendeEhrungen.push({
            mitglied_id: m.id, vorname: m.vorname, nachname: m.nachname,
            typ: "Mitgliedsjahre", stufe, jahre: mjahre,
          });
        }
      }
      // Umzugsteilnahmen
      const meineTeilnahmen = (teilnahmen || []).filter(t => t.mitglied_id === m.id && t.status === "Anwesend");
      let erwachsen = 0;
      for (const t of meineTeilnahmen) {
        const v = vMap[t.veranstaltung_id];
        if (!v || v.typ !== "Umzug" || !v.datum) continue;
        const umzugDatum = new Date(v.datum);
        const alterBeim = umzugDatum.getFullYear() - geb.getFullYear();
        if (alterBeim >= 18) erwachsen++;
      }
      const verliehenU = meineEhrungen.filter(e => e.typ === "Umzugsteilnahmen" && e.status === "Verliehen").map(e => Number(e.wert));
      const geplantU = meineEhrungen.filter(e => e.typ === "Umzugsteilnahmen" && e.status === "Geplant").map(e => Number(e.wert));
      for (const stufe of UMZUGS_STUFEN) {
        if (erwachsen >= stufe && !verliehenU.includes(stufe) && !geplantU.includes(stufe)) {
          anstehendeEhrungen.push({
            mitglied_id: m.id, vorname: m.vorname, nachname: m.nachname,
            typ: "Umzugsteilnahmen", stufe, count: erwachsen,
          });
        }
      }
    }

    return Response.json({
      offeneAntraege,
      geburtstage: in30,
      statusPruefung,
      anstehendeEhrungen,
    });
  } catch (error) {
    console.error("getMitgliederDashboardSicher:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}