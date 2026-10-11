import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { istVerwaltung, istVorstand, loeseMeinMitglied, istElternVon } from "../../shared/mitgliedBerechtigung.ts";

/**
 * Vereinsdokumente (Satzung, Ordnungen, Antragsformulare) + Datenschutz-Zustimmung.
 *
 * Dateien liegen im PRIVATE Storage, Download nur per signierter URL nach Auth-Prüfung.
 *
 * Aktionen für ALLE eingeloggten Mitglieder:
 *  - liste_oeffentlich:  Dokumente mit sichtbarkeit='alle' und ist_aktuell=true
 *  - signed_url:         Download (Mitglied nur für sichtbarkeit='alle', Verwaltung für alle)
 *  - zustimmung_status:  Muss ich (und meine Kinder) noch zustimmen?
 *  - zustimmen:          Zustimmung erteilen (für mich + optional verknüpfte Kinder)
 *
 * Aktionen nur Verwaltung (admin/vorstand/stellv_vorstand):
 *  - liste_alle, anlegen, aktualisieren, version_erhoehen
 *  - zustimmung_uebersicht, zustimmung_manuell
 * Löschen: nur admin/vorstand.
 */

const heuteISO = () => new Date().toISOString().split("T")[0];
const KATEGORIEN = new Set(["Satzung", "Ordnung", "Antragsformular", "Datenschutz", "Protokoll", "Sonstiges"]);
const SICHTBARKEIT = new Set(["alle", "ausschuss"]);

async function aktuellesDatenschutzDokument(S) {
  const docs = await S.VereinsDokument.filter({ kategorie: "Datenschutz", ist_aktuell: true }).catch(() => []);
  if (docs?.length) return docs.sort((a, b) => (b.version || 0) - (a.version || 0))[0];
  // Fallback: Satzung enthält § 14
  const satz = await S.VereinsDokument.filter({ kategorie: "Satzung", ist_aktuell: true }).catch(() => []);
  return satz?.length ? satz.sort((a, b) => (b.version || 0) - (a.version || 0))[0] : null;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const S = base44.asServiceRole.entities;
    const I = base44.asServiceRole.integrations.Core;
    const body = await req.json().catch(() => ({}));
    const { aktion } = body;
    if (!aktion) return Response.json({ error: "Keine Aktion" }, { status: 400 });
    const verwaltung = istVerwaltung(user);
    const meinMitglied = await loeseMeinMitglied(base44, user);

    switch (aktion) {
      // ───────── Lesen (alle Mitglieder) ─────────
      case "liste_oeffentlich": {
        const docs = await S.VereinsDokument.filter({ sichtbarkeit: "alle", ist_aktuell: true });
        return Response.json({ dokumente: (docs || []).sort((a, b) => (a.sortierung || 100) - (b.sortierung || 100)) });
      }
      case "signed_url": {
        const { dokument_id } = body;
        if (!dokument_id) return Response.json({ error: "dokument_id fehlt" }, { status: 400 });
        const doc = await S.VereinsDokument.get(dokument_id).catch(() => null);
        if (!doc) return Response.json({ error: "Dokument nicht gefunden" }, { status: 404 });
        if (doc.sichtbarkeit !== "alle" && !verwaltung) {
          return Response.json({ error: "Access Denied" }, { status: 403 });
        }
        if (!doc.file_uri || /^https?:\/\//i.test(doc.file_uri)) {
          return Response.json({ error: "Keine private Datei-URI" }, { status: 400 });
        }
        let res;
        try { res = await I.CreateFileSignedUrl({ file_uri: doc.file_uri, expires_in: 300 }); }
        catch { return Response.json({ error: "Datei nicht mehr abrufbar" }, { status: 404 }); }
        const signed_url = res?.signed_url || res?.data?.signed_url;
        if (!signed_url) return Response.json({ error: "Signierte URL fehlgeschlagen" }, { status: 500 });
        return Response.json({ signed_url, name: doc.dateiname || doc.titel });
      }

      // ───────── Zustimmung (Mitglied) ─────────
      case "zustimmung_status": {
        const doc = await aktuellesDatenschutzDokument(S);
        if (!doc) return Response.json({ erforderlich: false, grund: "kein_dokument" });
        if (!meinMitglied) return Response.json({ erforderlich: false, grund: "kein_mitglied" });
        const version = doc.version || 1;
        const meine = await S.DatenschutzZustimmung.filter({ mitglied_id: meinMitglied.id });
        const habeZugestimmt = (meine || []).some(z => !z.fuer_mitglied_id && (z.version || 0) >= version);
        // Verknüpfte Kinder (Eltern stimmen für sie mit zu)
        let kinderOffen = [];
        try {
          const verw = await S.Verwandtschaft.filter({ mitglied_id: meinMitglied.id });
          const kinderIds = (verw || []).filter(v => v.beziehung === "Kind").map(v => v.verwandter_id);
          for (const kid of kinderIds) {
            const k = await S.Mitglied.get(kid).catch(() => null);
            if (!k) continue;
            const eigene = await S.DatenschutzZustimmung.filter({ fuer_mitglied_id: kid });
            const ok = (eigene || []).some(z => (z.version || 0) >= version);
            if (!ok) kinderOffen.push({ id: kid, name: `${k.vorname || ""} ${k.nachname || ""}`.trim() });
          }
        } catch (e) { console.error("zustimmung_status Kinder:", e); }
        return Response.json({
          erforderlich: !habeZugestimmt || kinderOffen.length > 0,
          ich_offen: !habeZugestimmt,
          kinder_offen: kinderOffen,
          version,
          dokument: { id: doc.id, titel: doc.titel, kategorie: doc.kategorie, stand_datum: doc.stand_datum || "" },
        });
      }
      case "zustimmen": {
        if (!meinMitglied) return Response.json({ error: "Kein Mitglied verknüpft" }, { status: 400 });
        const doc = await aktuellesDatenschutzDokument(S);
        if (!doc) return Response.json({ error: "Kein Datenschutz-Dokument hinterlegt" }, { status: 400 });
        const version = doc.version || 1;
        const jetzt = new Date().toISOString();
        const meine = await S.DatenschutzZustimmung.filter({ mitglied_id: meinMitglied.id });
        if (!(meine || []).some(z => !z.fuer_mitglied_id && (z.version || 0) >= version)) {
          await S.DatenschutzZustimmung.create({
            mitglied_id: meinMitglied.id, version, dokument_id: doc.id, zugestimmt_am: jetzt, art: "App",
          });
        }
        // Optional: für verknüpfte Kinder (nur wenn Elternteil)
        const kinder = Array.isArray(body.fuer_kinder_ids) ? body.fuer_kinder_ids.slice(0, 10) : [];
        for (const kid of kinder) {
          if (!(await istElternVon(base44, meinMitglied.id, kid))) continue;
          const eigene = await S.DatenschutzZustimmung.filter({ fuer_mitglied_id: kid });
          if ((eigene || []).some(z => (z.version || 0) >= version)) continue;
          await S.DatenschutzZustimmung.create({
            mitglied_id: meinMitglied.id, fuer_mitglied_id: kid, version, dokument_id: doc.id,
            zugestimmt_am: jetzt, art: "App", notiz: "Durch Elternteil für Kind",
          });
        }
        return Response.json({ ok: true, version });
      }
    }

    // ───────── Ab hier nur Verwaltung ─────────
    if (!verwaltung) {
      return Response.json({ error: "Access Denied", message: "Nur Vorstand/Stv./Admin." }, { status: 403 });
    }

    switch (aktion) {
      case "liste_alle": {
        const docs = await S.VereinsDokument.list("-created_date", 500);
        return Response.json({ dokumente: docs || [] });
      }
      case "anlegen": {
        const { titel, kategorie, beschreibung, sichtbarkeit, file_uri, dateiname, datei_groesse, stand_datum, version } = body;
        if (!titel || !file_uri) return Response.json({ error: "titel und file_uri fehlen" }, { status: 400 });
        if (typeof titel !== "string" || titel.length > 180) return Response.json({ error: "Ungültiger Titel" }, { status: 400 });
        if (!KATEGORIEN.has(kategorie || "Sonstiges")) return Response.json({ error: "Ungültige Kategorie" }, { status: 400 });
        if (!SICHTBARKEIT.has(sichtbarkeit || "ausschuss")) return Response.json({ error: "Ungültige Sichtbarkeit" }, { status: 400 });
        if (typeof file_uri !== "string" || /^https?:\/\//i.test(file_uri)) {
          return Response.json({ error: "file_uri muss private Storage-URI sein" }, { status: 400 });
        }
        const groesse = Number(datei_groesse || 0);
        if (!Number.isFinite(groesse) || groesse < 0 || groesse > 25 * 1024 * 1024) {
          return Response.json({ error: "Ungültige Dateigröße (max. 25 MB)" }, { status: 400 });
        }
        try {
          const probe = await I.CreateFileSignedUrl({ file_uri, expires_in: 60 });
          if (!(probe?.signed_url || probe?.data?.signed_url)) throw new Error("no url");
        } catch { return Response.json({ error: "Private Datei nicht gefunden" }, { status: 400 }); }
        const doc = await S.VereinsDokument.create({
          titel, kategorie: kategorie || "Sonstiges", beschreibung: beschreibung || "",
          sichtbarkeit: sichtbarkeit || "ausschuss", file_uri, dateiname: dateiname || titel,
          datei_groesse: groesse, stand_datum: stand_datum || heuteISO(),
          version: Number(version) > 0 ? Number(version) : 1, ist_aktuell: true,
          hochgeladen_von_id: meinMitglied?.id || "", sortierung: 100,
        });
        return Response.json({ dokument: doc });
      }
      case "aktualisieren": {
        const { dokument_id, titel, beschreibung, sichtbarkeit, kategorie, stand_datum } = body;
        if (!dokument_id) return Response.json({ error: "dokument_id fehlt" }, { status: 400 });
        const upd = {};
        if (typeof titel === "string" && titel.trim()) upd.titel = titel.trim().slice(0, 180);
        if (typeof beschreibung === "string") upd.beschreibung = beschreibung;
        if (sichtbarkeit) { if (!SICHTBARKEIT.has(sichtbarkeit)) return Response.json({ error: "Ungültige Sichtbarkeit" }, { status: 400 }); upd.sichtbarkeit = sichtbarkeit; }
        if (kategorie) { if (!KATEGORIEN.has(kategorie)) return Response.json({ error: "Ungültige Kategorie" }, { status: 400 }); upd.kategorie = kategorie; }
        if (stand_datum) upd.stand_datum = stand_datum;
        const doc = await S.VereinsDokument.update(dokument_id, upd);
        return Response.json({ dokument: doc });
      }
      case "ersetzen": {
        // Neue Fassung hochladen: alte wird archiviert, Version +1 (löst bei Satzung/Datenschutz erneute Zustimmung aus)
        const { dokument_id, file_uri, dateiname, datei_groesse, stand_datum } = body;
        if (!dokument_id || !file_uri) return Response.json({ error: "dokument_id und file_uri fehlen" }, { status: 400 });
        if (typeof file_uri !== "string" || /^https?:\/\//i.test(file_uri)) {
          return Response.json({ error: "file_uri muss private Storage-URI sein" }, { status: 400 });
        }
        const alt = await S.VereinsDokument.get(dokument_id).catch(() => null);
        if (!alt) return Response.json({ error: "Dokument nicht gefunden" }, { status: 404 });
        const neu = await S.VereinsDokument.create({
          titel: alt.titel, kategorie: alt.kategorie, beschreibung: alt.beschreibung || "",
          sichtbarkeit: alt.sichtbarkeit, file_uri, dateiname: dateiname || alt.dateiname,
          datei_groesse: Number(datei_groesse || 0), stand_datum: stand_datum || heuteISO(),
          version: (alt.version || 1) + 1, ist_aktuell: true,
          hochgeladen_von_id: meinMitglied?.id || "", sortierung: alt.sortierung || 100,
        });
        await S.VereinsDokument.update(alt.id, { ist_aktuell: false });
        return Response.json({ dokument: neu });
      }
      case "loeschen": {
        if (!istVorstand(user)) return Response.json({ error: "Nur Admin/Vorstand darf löschen" }, { status: 403 });
        const { dokument_id } = body;
        if (!dokument_id) return Response.json({ error: "dokument_id fehlt" }, { status: 400 });
        await S.VereinsDokument.delete(dokument_id);
        return Response.json({ ok: true });
      }
      case "zustimmung_uebersicht": {
        const doc = await aktuellesDatenschutzDokument(S);
        const version = doc?.version || 1;
        const [mitglieder, zust] = await Promise.all([
          S.Mitglied.list("nachname", 2000),
          S.DatenschutzZustimmung.list("-zugestimmt_am", 5000),
        ]);
        const eigene = new Map();
        for (const z of zust || []) {
          if (z.fuer_mitglied_id) continue;
          if ((z.version || 0) < version) continue;
          if (!eigene.has(z.mitglied_id)) eigene.set(z.mitglied_id, z);
        }
        const fuerKind = new Map();
        for (const z of zust || []) {
          if (!z.fuer_mitglied_id || (z.version || 0) < version) continue;
          if (!fuerKind.has(z.fuer_mitglied_id)) fuerKind.set(z.fuer_mitglied_id, z);
        }
        const heute = heuteISO();
        const aktiveStatus = (m) => m.mitgliedsstatus !== "Verstorben" && !(m.austrittsdatum && m.austrittsdatum <= heute);
        const zeilen = (mitglieder || []).filter(aktiveStatus).map(m => {
          const z = eigene.get(m.id) || fuerKind.get(m.id);
          return {
            mitglied_id: m.id,
            name: `${m.nachname || ""}, ${m.vorname || ""}`.trim(),
            status: m.mitgliedsstatus || "",
            zugestimmt: !!z,
            zugestimmt_am: z?.zugestimmt_am || null,
            art: z?.art || null,
            via_eltern: !!(z && z.fuer_mitglied_id),
          };
        });
        return Response.json({
          version, dokument: doc ? { id: doc.id, titel: doc.titel, stand_datum: doc.stand_datum || "" } : null,
          zeilen, gesamt: zeilen.length, zugestimmt: zeilen.filter(z => z.zugestimmt).length,
        });
      }
      case "zustimmung_manuell": {
        // Vorstand trägt ein, dass ein Mitglied (z.B. ohne App) schriftlich zugestimmt hat
        const { mitglied_id, notiz } = body;
        if (!mitglied_id) return Response.json({ error: "mitglied_id fehlt" }, { status: 400 });
        const doc = await aktuellesDatenschutzDokument(S);
        if (!doc) return Response.json({ error: "Kein Datenschutz-Dokument hinterlegt" }, { status: 400 });
        const version = doc.version || 1;
        const vorhanden = await S.DatenschutzZustimmung.filter({ mitglied_id });
        if ((vorhanden || []).some(z => !z.fuer_mitglied_id && (z.version || 0) >= version)) {
          return Response.json({ ok: true, bereits: true });
        }
        await S.DatenschutzZustimmung.create({
          mitglied_id, version, dokument_id: doc.id, zugestimmt_am: new Date().toISOString(),
          art: "Manuell durch Vorstand", eingetragen_von_id: meinMitglied?.id || "",
          notiz: (typeof notiz === "string" ? notiz : "").slice(0, 300),
        });
        return Response.json({ ok: true });
      }
      default:
        return Response.json({ error: "Unbekannte Aktion: " + aktion }, { status: 400 });
    }
  } catch (error) {
    console.error("vereinsDokumentSicher:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
