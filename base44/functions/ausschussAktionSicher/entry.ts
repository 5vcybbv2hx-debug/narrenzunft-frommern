import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMitgliedUndRechte, schreibeAudit, generiereBeschlussnummer } from "../../shared/ausschussBerechtigung.ts";

/**
 * Zentrale, allowlist-basierte Function für Ausschuss-Lifecycle- und
 * Verknüpfungsaktionen. Alle Schreibvorgänge laufen über die Service-Role,
 * nachdem die Berechtigung serverseitig geprüft wurde — so scheitern Nutzer
 * mit Zusatzrecht "ausschuss" / aktive Ausschussmitglieder nicht an der
 * Entity-RLS. Keine generische freie Entity-Mutation: jede Aktion ist
 * explizit freigegeben und validiert.
 */

const heuteISO = () => new Date().toISOString().split("T")[0];

async function getObj(base44, entity, id) {
  return await base44.asServiceRole.entities[entity].get(id);
}
async function pushToArr(base44, entity, id, field, value) {
  const obj = await getObj(base44, entity, id);
  const arr = Array.isArray(obj[field]) ? [...obj[field]] : [];
  if (value && !arr.includes(value)) arr.push(value);
  await base44.asServiceRole.entities[entity].update(id, { [field]: arr });
  return arr;
}
async function pullFromArr(base44, entity, id, field, value) {
  const obj = await getObj(base44, entity, id);
  const arr = (Array.isArray(obj[field]) ? obj[field] : []).filter((x) => x !== value);
  await base44.asServiceRole.entities[entity].update(id, { [field]: arr });
}
function mitgliedName(mitglieder, id) {
  const m = mitglieder?.find((x) => x.id === id);
  return m ? `${m.vorname} ${m.nachname}` : "–";
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const ctx = await loeseMitgliedUndRechte(base44, user);
    if (!ctx.darfAusschuss) {
      return Response.json({ error: "Access Denied", message: "Keine Ausschuss-Berechtigung." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const aktion = body.aktion;
    if (!aktion) return Response.json({ error: "Keine Aktion angegeben" }, { status: 400 });

    // ── Allowlist ──
    const brauchVerwaltung = (a) =>
      ["sitzung_status", "sitzung_einladen", "tops_sperren", "sitzung_anwesenheit", "top_status", "top_loeschen",
       "abstimmung_anlegen", "abstimmung_stimme_fuer", "abstimmung_wiedereroeffnen",
       "jahresplan_speichern", "jahresplan_loeschen",
       "abstimmung_abschliessen", "abstimmung_loeschen", "beschluss_anlegen",
       "beschluss_aus_abstimmung", "beschluss_update", "beschluss_aufheben",
       "beschluss_loeschen", "aufgabe_aus_beschluss", "aufgabe_update", "aufgabe_loeschen",
       "protokoll_freigabe", "sitzung_kopieren", "datei_entfernen"].includes(a);

    if (brauchVerwaltung(aktion) && !ctx.kannVerwalten) {
      return Response.json({ error: "Access Denied", message: "Aktion nur für Vorstand/Stellv./Admin." }, { status: 403 });
    }

    const result = await ausfuehren(base44, ctx, body);

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("ausschussAktionSicher:", error);
    return Response.json({ error: error.message || "Interner Fehler" }, { status: 500 });
  }
}

async function ausfuehren(base44, ctx, body) {
  const { aktion } = body;
  const S = base44.asServiceRole.entities;

  switch (aktion) {
    // ── Sitzungs-Lifecycle ──
    case "sitzung_status": {
      const { termin_id, sitzungs_status } = body;
      await S.KalenderTermin.update(termin_id, { sitzungs_status });
      await schreibeAudit(base44, ctx, "Sitzung", termin_id, "sitzung_status", { sitzungs_status });
      return { termin_id, sitzungs_status };
    }
    case "sitzung_einladen": {
      const { termin_id } = body;
      const patch = { sitzungs_status: "Eingeladen", einladung_gesendet_am: new Date().toISOString() };
      await S.KalenderTermin.update(termin_id, patch);
      await schreibeAudit(base44, ctx, "Sitzung", termin_id, "sitzung_einladen", {});
      return { termin_id, ...patch };
    }
    case "tops_sperren": {
      const { termin_id, tops_gesperrt } = body;
      await S.KalenderTermin.update(termin_id, { tops_gesperrt: !!tops_gesperrt });
      await schreibeAudit(base44, ctx, "Sitzung", termin_id, "tops_sperren", { tops_gesperrt });
      return { termin_id, tops_gesperrt: !!tops_gesperrt };
    }
    case "sitzung_kopieren": {
      const { quelle_id, ziel_id } = body;
      const quelle = await S.KalenderTermin.get(quelle_id);
      if (!quelle) throw new Error("Quell-Sitzung nicht gefunden");
      const tops = await S.Tagesordnungspunkt.filter({ termin_id: quelle_id });
      let zielTerminId = ziel_id;
      if (!zielTerminId) {
        const neu = await S.KalenderTermin.create({
          titel: quelle.titel + " (Kopie)",
          datum: body.datum || heuteISO(),
          terminart: quelle.terminart,
          sichtbarkeit: quelle.sichtbarkeit || "ausschuss",
          ort: quelle.ort,
          startzeit: quelle.startzeit,
          beschreibung: quelle.beschreibung,
          sitzungs_status: "Entwurf",
        });
        zielTerminId = neu.id;
      }
      const existing = await S.Tagesordnungspunkt.filter({ termin_id: zielTerminId });
      for (const t of (tops || []).sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))) {
        await S.Tagesordnungspunkt.create({
          termin_id: zielTerminId,
          reihenfolge: (existing?.length || 0) + (tops.indexOf(t) + 1),
          titel: t.titel,
          beschreibung: t.beschreibung || "",
          kategorie: t.kategorie || "",
          dauer_minuten: t.dauer_minuten || 15,
          vertraulich: !!t.vertraulich,
          status: "Offen",
        });
      }
      await schreibeAudit(base44, ctx, "Sitzung", zielTerminId, "sitzung_kopieren", { quelle_id });
      return { ziel_id: zielTerminId, anzahl: (tops || []).length };
    }

    // ── Anwesenheit einer Ausschusssitzung ──
    case "sitzung_anwesenheit": {
      const { termin_id, mitglied_id, status } = body;
      if (!termin_id || !mitglied_id || !["Anwesend", "Entschuldigt", "Unentschuldigt"].includes(status)) {
        throw new Error("Ungültige Anwesenheit");
      }
      const termin = await S.KalenderTermin.get(termin_id);
      if (!termin || !["Ausschusssitzung", "Vorstandssitzung", "Intern"].includes(termin.terminart)) {
        throw new Error("Sitzung nicht gefunden");
      }
      const mitgliedschaft = await S.AusschussMitglied.filter({ mitglied_id, aktiv: true });
      if (!mitgliedschaft?.length) throw new Error("Kein aktives Ausschussmitglied");
      const alle = await S.SitzungsAnwesenheit.filter({ termin_id });
      const bestehend = (alle || []).find((a) => a.mitglied_id === mitglied_id);
      const anwesenheit = bestehend
        ? await S.SitzungsAnwesenheit.update(bestehend.id, { status })
        : await S.SitzungsAnwesenheit.create({ termin_id, mitglied_id, status });
      await schreibeAudit(base44, ctx, "Sitzung", termin_id, "sitzung_anwesenheit", { mitglied_id, status });
      return { anwesenheit: anwesenheit || { ...bestehend, status } };
    }

    // ── TOPs ──
    case "top_anlegen": {
      const { termin_id, titel, beschreibung, kategorie, dauer_minuten, vertraulich } = body;
      if (!titel) throw new Error("Titel fehlt");
      const termin = await S.KalenderTermin.get(termin_id);
      if (termin?.tops_gesperrt) throw new Error("Agenda ist gesperrt");
      const vorhandene = await S.Tagesordnungspunkt.filter({ termin_id });
      const top = await S.Tagesordnungspunkt.create({
        termin_id, titel, beschreibung: beschreibung || "", kategorie: kategorie || "",
        dauer_minuten: dauer_minuten || 15, vertraulich: !!vertraulich,
        reihenfolge: (vorhandene?.length || 0) + 1, status: "Offen",
        beantragt_von_id: ctx.currentMitgliedId || "",
      });
      await schreibeAudit(base44, ctx, "TOP", top.id, "top_anlegen", { termin_id, titel });
      return { top };
    }
    case "top_status": {
      const { top_id, status } = body;
      await S.Tagesordnungspunkt.update(top_id, { status });
      await schreibeAudit(base44, ctx, "TOP", top_id, "top_status", { status });
      return { top_id, status };
    }
    case "top_notiz": {
      const { top_id, notizen } = body;
      await S.Tagesordnungspunkt.update(top_id, { notizen });
      await schreibeAudit(base44, ctx, "TOP", top_id, "top_notiz", {});
      return { top_id };
    }
    case "top_loeschen": {
      const { top_id } = body;
      await S.Tagesordnungspunkt.delete(top_id);
      await schreibeAudit(base44, ctx, "TOP", top_id, "top_loeschen", {});
      return { top_id };
    }

    // ── TOP → Abstimmung ──
    case "top_abstimmung_anlegen": {
      const { top_id, titel, beschreibung, angenommen_ab } = body;
      if (!titel) throw new Error("Titel fehlt");
      const top = await S.Tagesordnungspunkt.get(top_id);
      if (!top) throw new Error("TOP nicht gefunden");
      const abs = await S.Abstimmung.create({
        titel, beschreibung: beschreibung || "", termin_id: top.termin_id, top_id,
        status: "Offen", angenommen_ab: angenommen_ab || 50,
      });
      await pushToArr(base44, "Tagesordnungspunkt", top_id, "abstimmung_ids", abs.id);
      await schreibeAudit(base44, ctx, "Abstimmung", abs.id, "top_abstimmung_anlegen", { top_id, titel });
      return { abstimmung: abs };
    }

    // ── Abstimmung ──
    case "abstimmung_anlegen": {
      const { titel, beschreibung, angenommen_ab, termin_id } = body;
      if (!titel?.trim() || !termin_id) throw new Error("Titel und Sitzung fehlen");
      const termin = await S.KalenderTermin.get(termin_id);
      if (!termin || !["Ausschusssitzung", "Vorstandssitzung", "Intern"].includes(termin.terminart)) {
        throw new Error("Sitzung nicht gefunden");
      }
      const grenze = Number(angenommen_ab ?? 50);
      if (!Number.isFinite(grenze) || grenze < 1 || grenze > 100) throw new Error("Ungültige Mehrheit");
      const abstimmung = await S.Abstimmung.create({ titel: titel.trim(), beschreibung: beschreibung || "", termin_id,
        angenommen_ab: grenze, status: "Offen" });
      await schreibeAudit(base44, ctx, "Abstimmung", abstimmung.id, "abstimmung_anlegen", { termin_id, titel });
      return { abstimmung };
    }
    case "abstimmung_stimme": {
      const { abstimmung_id, stimme } = body;
      if (!ctx.currentMitgliedId) throw new Error("Kein Mitglied verknüpft");
      const aktiv = await S.AusschussMitglied.filter({ mitglied_id: ctx.currentMitgliedId, aktiv: true });
      if (!aktiv?.length) throw new Error("Nur aktive Ausschussmitglieder dürfen abstimmen");
      const abs = await S.Abstimmung.get(abstimmung_id);
      const optionen = Array.isArray(abs?.antwort_optionen) && abs.antwort_optionen.length ? abs.antwort_optionen : ["Ja", "Nein", "Enthaltung"];
      if (!abs || abs.status !== "Offen" || !optionen.includes(stimme)) {
        throw new Error("Abstimmung geschlossen oder Stimme ungültig");
      }
      const existing = (await S.AbstimmungsStimme.filter({ abstimmung_id })).find(
        (s) => s.mitglied_id === ctx.currentMitgliedId
      );
      let stimmeRec;
      if (existing) {
        await S.AbstimmungsStimme.update(existing.id, { stimme });
        stimmeRec = { ...existing, stimme };
      } else {
        stimmeRec = await S.AbstimmungsStimme.create({
          abstimmung_id, mitglied_id: ctx.currentMitgliedId, stimme,
        });
      }
      return { stimme: stimmeRec };
    }
    case "abstimmung_stimme_fuer": {
      const { abstimmung_id, mitglied_id, stimme } = body;
      const aktiv = await S.AusschussMitglied.filter({ mitglied_id, aktiv: true });
      const abs = await S.Abstimmung.get(abstimmung_id);
      const optionen = Array.isArray(abs?.antwort_optionen) && abs.antwort_optionen.length ? abs.antwort_optionen : ["Ja", "Nein", "Enthaltung"];
      if (!aktiv?.length || !abs || abs.status !== "Offen" || !optionen.includes(stimme)) {
        throw new Error("Ausschussmitglied, offene Abstimmung und gültige Stimme erforderlich");
      }
      const existing = (await S.AbstimmungsStimme.filter({ abstimmung_id })).find((v) => v.mitglied_id === mitglied_id);
      const stimmeRec = existing
        ? await S.AbstimmungsStimme.update(existing.id, { stimme })
        : await S.AbstimmungsStimme.create({ abstimmung_id, mitglied_id, stimme });
      await schreibeAudit(base44, ctx, "Abstimmung", abstimmung_id, "abstimmung_stimme_fuer", { mitglied_id });
      return { stimme: stimmeRec || { ...existing, stimme } };
    }
    case "abstimmung_wiedereroeffnen": {
      const { abstimmung_id } = body;
      const abs = await S.Abstimmung.get(abstimmung_id);
      if (!abs) throw new Error("Abstimmung nicht gefunden");
      await S.Abstimmung.update(abstimmung_id, { status: "Offen", ergebnis: null });
      await schreibeAudit(base44, ctx, "Abstimmung", abstimmung_id, "abstimmung_wiedereroeffnen", {});
      return { abstimmung_id, status: "Offen", ergebnis: null };
    }
    case "abstimmung_abschliessen": {
      const { abstimmung_id } = body;
      const abs = await S.Abstimmung.get(abstimmung_id);
      if (!abs) throw new Error("Abstimmung nicht gefunden");
      const stimmen = await S.AbstimmungsStimme.filter({ abstimmung_id });
      const ja = stimmen.filter((s) => s.stimme === "Ja").length;
      const gesamt = stimmen.filter((s) => s.stimme !== "Enthaltung").length;
      const prozent = gesamt > 0 ? (ja / gesamt) * 100 : 0;
      const ergebnis = prozent > (abs.angenommen_ab || 50) ? "Angenommen" : "Abgelehnt";
      await S.Abstimmung.update(abstimmung_id, { status: "Abgeschlossen", ergebnis });
      await schreibeAudit(base44, ctx, "Abstimmung", abstimmung_id, "abstimmung_abschliessen", { ergebnis, ja, gesamt });
      return { abstimmung_id, ergebnis, ja, gesamt };
    }
    case "abstimmung_loeschen": {
      const { abstimmung_id } = body;
      const abs = await S.Abstimmung.get(abstimmung_id).catch(() => null);
      if (abs?.top_id) await pullFromArr(base44, "Tagesordnungspunkt", abs.top_id, "abstimmung_ids", abstimmung_id);
      await S.AbstimmungsStimme.filter({ abstimmung_id }).then((list) =>
        Promise.all((list || []).map((s) => S.AbstimmungsStimme.delete(s.id)))
      );
      await S.Abstimmung.delete(abstimmung_id);
      await schreibeAudit(base44, ctx, "Abstimmung", abstimmung_id, "abstimmung_loeschen", {});
      return { abstimmung_id };
    }

    // ── Beschluss ──
    case "beschluss_anlegen": {
      const { titel, inhalt, datum, termin_id, top_id, kategorie, beschlussorgan,
        verantwortlicher_id, faellig_am, vertraulich, notizen } = body;
      if (!titel || !datum) throw new Error("Titel und Datum fehlen");
      const jahr = body.jahr || new Date(datum).getFullYear();
      const beschlussnummer = await generiereBeschlussnummer(base44, jahr);
      const beschluss = await S.Beschluss.create({
        titel, inhalt: inhalt || "", datum, termin_id: termin_id || "", top_id: top_id || "",
        status: "Offen", vertraulich: !!vertraulich, notizen: notizen || "",
        beschlussnummer, jahr, kategorie: kategorie || "",
        beschlussorgan: beschlussorgan || "Ausschuss",
        verantwortlicher_id: verantwortlicher_id || "", faellig_am: faellig_am || "",
      });
      if (top_id) await pushToArr(base44, "Tagesordnungspunkt", top_id, "beschluss_ids", beschluss.id);
      await schreibeAudit(base44, ctx, "Beschluss", beschluss.id, "beschluss_anlegen", { beschlussnummer, titel });
      return { beschluss };
    }
    case "beschluss_aus_abstimmung": {
      const { abstimmung_id, titel, inhalt, kategorie, verantwortlicher_id, faellig_am } = body;
      const abs = await S.Abstimmung.get(abstimmung_id);
      if (!abs) throw new Error("Abstimmung nicht gefunden");
      if (abs.ergebnis !== "Angenommen") throw new Error("Abstimmung nicht angenommen");
      const datum = heuteISO();
      const jahr = new Date(datum).getFullYear();
      const beschlussnummer = await generiereBeschlussnummer(base44, jahr);
      const beschluss = await S.Beschluss.create({
        titel: titel || abs.titel, inhalt: inhalt || abs.beschreibung || "",
        datum, termin_id: abs.termin_id || "", top_id: abs.top_id || "",
        abstimmung_id, status: "Offen", beschlussnummer, jahr,
        kategorie: kategorie || "", beschlussorgan: "Ausschuss",
        verantwortlicher_id: verantwortlicher_id || "", faellig_am: faellig_am || "",
      });
      await S.Abstimmung.update(abstimmung_id, { beschluss_id: beschluss.id });
      if (abs.top_id) await pushToArr(base44, "Tagesordnungspunkt", abs.top_id, "beschluss_ids", beschluss.id);
      await schreibeAudit(base44, ctx, "Beschluss", beschluss.id, "beschluss_aus_abstimmung", { abstimmung_id, beschlussnummer });
      return { beschluss };
    }
    case "beschluss_update": {
      const { beschluss_id, ...fields } = body;
      delete fields.aktion;
      const clean = {};
      for (const k of ["titel", "inhalt", "status", "kategorie", "beschlussorgan", "verantwortlicher_id",
        "faellig_am", "umgesetzt_am", "umsetzungsnachweis", "gueltig_bis", "vertraulich", "notizen"]) {
        if (fields[k] !== undefined) clean[k] = fields[k];
      }
      await S.Beschluss.update(beschluss_id, clean);
      await schreibeAudit(base44, ctx, "Beschluss", beschluss_id, "beschluss_update", clean);
      return { beschluss_id };
    }
    case "beschluss_aufheben": {
      const { beschluss_id, aufgehoben_durch_id } = body;
      await S.Beschluss.update(beschluss_id, { status: "Aufgehoben", aufgehoben_durch_id: aufgehoben_durch_id || "" });
      await schreibeAudit(base44, ctx, "Beschluss", beschluss_id, "beschluss_aufheben", { aufgehoben_durch_id });
      return { beschluss_id };
    }
    case "beschluss_loeschen": {
      const { beschluss_id } = body;
      const b = await S.Beschluss.get(beschluss_id).catch(() => null);
      if (b?.top_id) await pullFromArr(base44, "Tagesordnungspunkt", b.top_id, "beschluss_ids", beschluss_id);
      await S.Beschluss.delete(beschluss_id);
      await schreibeAudit(base44, ctx, "Beschluss", beschluss_id, "beschluss_loeschen", {});
      return { beschluss_id };
    }

    // ── Beschluss → Aufgabe ──
    case "aufgabe_aus_beschluss": {
      const { beschluss_id, titel, beschreibung, faellig_am, verantwortlicher_id } = body;
      const b = await S.Beschluss.get(beschluss_id);
      if (!b) throw new Error("Beschluss nicht gefunden");
      const aufg = await S.Ausschussaufgabe.create({
        titel: titel || b.titel, beschreibung: beschreibung || b.inhalt || "",
        status: "Offen", prioritaet: "Mittel",
        faellig_am: faellig_am || b.faellig_am || "",
        verantwortlicher_id: verantwortlicher_id || b.verantwortlicher_id || "",
        termin_id: b.termin_id || "", beschluss_id, top_id: b.top_id || "",
      });
      if (b.top_id) await pushToArr(base44, "Tagesordnungspunkt", b.top_id, "aufgabe_ids", aufg.id);
      await schreibeAudit(base44, ctx, "Aufgabe", aufg.id, "aufgabe_aus_beschluss", { beschluss_id });
      return { aufgabe: aufg };
    }

    // ── Aufgaben ──
    case "aufgabe_anlegen": {
      const { titel, beschreibung, faellig_am, verantwortlicher_id, prioritaet, termin_id, top_id, beschluss_id, notizen, status } = body;
      if (!titel) throw new Error("Titel fehlt");
      const aufg = await S.Ausschussaufgabe.create({
        titel, beschreibung: beschreibung || "", status: ["Offen", "In Bearbeitung", "Erledigt", "Abgebrochen"].includes(status) ? status : "Offen",
        prioritaet: prioritaet || "Mittel", faellig_am: faellig_am || "",
        verantwortlicher_id: verantwortlicher_id || "", termin_id: termin_id || "",
        top_id: top_id || "", beschluss_id: beschluss_id || "", notizen: notizen || "",
      });
      if (top_id) await pushToArr(base44, "Tagesordnungspunkt", top_id, "aufgabe_ids", aufg.id);
      await schreibeAudit(base44, ctx, "Aufgabe", aufg.id, "aufgabe_anlegen", { titel });
      return { aufgabe: aufg };
    }
    case "aufgabe_status": {
      const { aufgabe_id, status, fortschritt_notiz } = body;
      const aufg = await S.Ausschussaufgabe.get(aufgabe_id);
      if (!aufg) throw new Error("Aufgabe nicht gefunden");
      // Nur Verantwortlicher oder Verwaltung darf fremde Aufgaben ändern
      if (!ctx.kannVerwalten && aufg.verantwortlicher_id !== ctx.currentMitgliedId && aufg.created_by_id !== ctx.currentMitgliedId) {
        throw new Error("Nur der Verantwortliche oder Vorstand darf den Status ändern");
      }
      const patch = { status };
      if (status === "Erledigt") patch.abgeschlossen_am = heuteISO();
      if (fortschritt_notiz !== undefined) patch.fortschritt_notiz = fortschritt_notiz;
      await S.Ausschussaufgabe.update(aufgabe_id, patch);
      await schreibeAudit(base44, ctx, "Aufgabe", aufgabe_id, "aufgabe_status", { status });
      return { aufgabe_id, ...patch };
    }
    case "aufgabe_uebergeben": {
      const { aufgabe_id, verantwortlicher_id } = body;
      const aufg = await S.Ausschussaufgabe.get(aufgabe_id);
      if (!aufg) throw new Error("Aufgabe nicht gefunden");
      if (!ctx.kannVerwalten && aufg.verantwortlicher_id !== ctx.currentMitgliedId && aufg.created_by_id !== ctx.currentMitgliedId) {
        throw new Error("Nur der Verantwortliche oder Vorstand darf die Aufgabe übergeben");
      }
      await S.Ausschussaufgabe.update(aufgabe_id, { verantwortlicher_id });
      await schreibeAudit(base44, ctx, "Aufgabe", aufgabe_id, "aufgabe_uebergeben", { an: verantwortlicher_id });
      return { aufgabe_id, verantwortlicher_id };
    }
    case "aufgabe_update": {
      const { aufgabe_id, ...fields } = body;
      delete fields.aktion;
      const clean = {};
      for (const k of ["titel", "beschreibung", "prioritaet", "faellig_am", "verantwortlicher_id",
        "status", "fortschritt_notiz", "notizen", "termin_id", "top_id", "beschluss_id", "veranstaltung_id", "wiederholung"]) {
        if (fields[k] !== undefined) clean[k] = fields[k];
      }
      if (clean.status === "Erledigt") clean.abgeschlossen_am = heuteISO();
      await S.Ausschussaufgabe.update(aufgabe_id, clean);
      await schreibeAudit(base44, ctx, "Aufgabe", aufgabe_id, "aufgabe_update", clean);
      return { aufgabe_id };
    }
    case "aufgabe_in_top": {
      // WICHTIG: Aufgabe wird NICHT gelöscht. Stattdessen TOP mit quell_aufgabe_id
      // anlegen, Aufgabe verknüpfen und Status setzen.
      const { aufgabe_id, termin_id, titel, beschreibung } = body;
      const aufg = await S.Ausschussaufgabe.get(aufgabe_id);
      if (!aufg) throw new Error("Aufgabe nicht gefunden");
      const termin = await S.KalenderTermin.get(termin_id);
      if (termin?.tops_gesperrt) throw new Error("Agenda ist gesperrt");
      const vorhandene = await S.Tagesordnungspunkt.filter({ termin_id });
      const top = await S.Tagesordnungspunkt.create({
        termin_id, titel: titel || aufg.titel, beschreibung: beschreibung || aufg.beschreibung || "",
        verantwortlicher_id: aufg.verantwortlicher_id || "",
        reihenfolge: (vorhandene?.length || 0) + 1, status: "Offen",
        quell_aufgabe_id: aufgabe_id, dauer_minuten: 15,
      });
      await S.Ausschussaufgabe.update(aufgabe_id, { top_id: top.id, termin_id, status: "In Bearbeitung" });
      await pushToArr(base44, "Tagesordnungspunkt", top.id, "aufgabe_ids", aufgabe_id);
      await schreibeAudit(base44, ctx, "TOP", top.id, "aufgabe_in_top", { aufgabe_id, termin_id });
      return { top, aufgabe_id };
    }
    case "aufgabe_loeschen": {
      const { aufgabe_id } = body;
      const a = await S.Ausschussaufgabe.get(aufgabe_id).catch(() => null);
      if (a?.top_id) await pullFromArr(base44, "Tagesordnungspunkt", a.top_id, "aufgabe_ids", aufgabe_id);
      await S.Ausschussaufgabe.delete(aufgabe_id);
      await schreibeAudit(base44, ctx, "Aufgabe", aufgabe_id, "aufgabe_loeschen", {});
      return { aufgabe_id };
    }

    // ── Jahresplanung ──
    case "jahresplan_speichern": {
      const { jahresplan_id, daten } = body;
      if (!daten || typeof daten !== "object" || !daten.titel?.trim()) throw new Error("Titel fehlt");
      const monat = Number(daten.monat), tag = Number(daten.tag);
      if (!Number.isInteger(monat) || monat < 1 || monat > 12 || !Number.isInteger(tag) || tag < 1 || tag > 31) {
        throw new Error("Ungültiges Plandatum");
      }
      const jahresplan = {};
      for (const feld of ["titel", "beschreibung", "verantwortlicher_id", "prioritaet", "aktiv", "wiederholung", "jahr", "kategorie"]) {
        if (daten[feld] !== undefined) jahresplan[feld] = daten[feld];
      }
      jahresplan.monat = monat;
      jahresplan.tag = tag;
      if (!["Niedrig", "Mittel", "Hoch", "Dringend"].includes(jahresplan.prioritaet)) throw new Error("Ungültige Priorität");
      if (!["Jährlich", "Einmalig"].includes(jahresplan.wiederholung)) throw new Error("Ungültige Wiederholung");
      const gespeichert = jahresplan_id
        ? await S.AusschussJahresplan.update(jahresplan_id, jahresplan)
        : await S.AusschussJahresplan.create(jahresplan);
      await schreibeAudit(base44, ctx, "Jahresplan", jahresplan_id || gespeichert.id, jahresplan_id ? "jahresplan_update" : "jahresplan_anlegen", { titel: jahresplan.titel });
      return { jahresplan: gespeichert };
    }
    case "jahresplan_loeschen": {
      const { jahresplan_id } = body;
      if (!jahresplan_id) throw new Error("Jahresplan-ID fehlt");
      await S.AusschussJahresplan.delete(jahresplan_id);
      await schreibeAudit(base44, ctx, "Jahresplan", jahresplan_id, "jahresplan_loeschen", {});
      return { jahresplan_id };
    }

    // ── Protokoll ──
    case "protokoll_entwurf": {
      const { termin_id } = body;
      const termin = await S.KalenderTermin.get(termin_id);
      if (!termin) throw new Error("Sitzung nicht gefunden");
      const [anw, tops, abs, prot, alleM, alleB, alleA] = await Promise.all([
        S.SitzungsAnwesenheit.filter({ termin_id }),
        S.Tagesordnungspunkt.filter({ termin_id }),
        S.Abstimmung.filter({ termin_id }),
        S.Protokoll.filter({ termin_id }),
        S.Mitglied.list("nachname", 500),
        S.Beschluss.filter({ termin_id }),
        S.Ausschussaufgabe.filter({ termin_id }),
      ]);
      const topIds = new Set((tops || []).map((t) => t.id));
      const beschluesse = (alleB || []).filter((b) => b.termin_id === termin_id || topIds.has(b.top_id));

      let text = `Protokoll — ${termin.titel}\n`;
      text += `Datum: ${termin.datum || "–"}${termin.startzeit ? " ab " + termin.startzeit : ""}\n`;
      if (termin.ort) text += `Ort: ${termin.ort}\n`;
      text += "\n— Anwesenheit —\n";
      const anwesend = (anw || []).filter((a) => a.status === "Anwesend");
      const entsch = (anw || []).filter((a) => a.status === "Entschuldigt");
      const unentsch = (anw || []).filter((a) => a.status === "Unentschuldigt");
      text += `Anwesend (${anwesend.length}): ${anwesend.map((a) => mitgliedName(alleM, a.mitglied_id)).join(", ") || "–"}\n`;
      text += `Entschuldigt (${entsch.length}): ${entsch.map((a) => mitgliedName(alleM, a.mitglied_id)).join(", ") || "–"}\n`;
      text += `Unentschuldigt (${unentsch.length}): ${unentsch.map((a) => mitgliedName(alleM, a.mitglied_id)).join(", ") || "–"}\n`;
      text += `Beschlussfähigkeit: ${anwesend.length >= Math.ceil((anw?.length || 0) / 2) ? "gegeben" : "nicht gegeben"}\n`;

      text += "\n— Tagesordnung —\n";
      for (const t of (tops || []).sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))) {
        text += `\n${t.reihenfolge || ""}. ${t.titel} [${t.status}]\n`;
        if (t.beschreibung) text += `   ${t.beschreibung}\n`;
        if (t.notizen) text += `   Notiz: ${t.notizen}\n`;
        const topAbs = (abs || []).filter((a) => a.top_id === t.id);
        for (const a of topAbs) {
          const st = await S.AbstimmungsStimme.filter({ abstimmung_id: a.id });
          const ja = st.filter((s) => s.stimme === "Ja").length;
          const nein = st.filter((s) => s.stimme === "Nein").length;
          const enth = st.filter((s) => s.stimme === "Enthaltung").length;
          text += `   Abstimmung „${a.titel}": ${ja} Ja / ${nein} Nein / ${enth} Enthaltung → ${a.ergebnis || "offen"}\n`;
        }
        const topBes = beschluesse.filter((b) => b.top_id === t.id);
        for (const b of topBes) {
          text += `   Beschluss ${b.beschlussnummer || ""}: ${b.titel} — ${b.status}\n`;
        }
        const topAufg = (alleA || []).filter((a) => a.top_id === t.id);
        for (const a of topAufg) {
          text += `   Aufgabe: ${a.titel} (${a.status}${a.faellig_am ? ", fällig " + a.faellig_am : ""})\n`;
        }
      }

      const titel = `Protokoll ${termin.titel}`;
      let protokoll;
      if (prot && prot.length > 0) {
        protokoll = prot[0];
        await S.Protokoll.update(protokoll.id, { inhalt: text, titel, datum: protokoll.datum || termin.datum, freigabestatus: protokoll.freigabestatus || "Entwurf" });
        protokoll = { ...protokoll, inhalt: text, titel };
      } else {
        protokoll = await S.Protokoll.create({
          termin_id, titel, inhalt: text, datum: termin.datum || heuteISO(),
          autor_mitglied_id: ctx.currentMitgliedId || "", freigabestatus: "Entwurf",
        });
      }
      await S.KalenderTermin.update(termin_id, { protokoll_status: "Entwurf" });
      await schreibeAudit(base44, ctx, "Protokoll", protokoll.id, "protokoll_entwurf", { termin_id });
      return { protokoll };
    }
    case "protokoll_freigabe": {
      const { protokoll_id, freigabestatus } = body;
      const patch = { freigabestatus };
      if (freigabestatus === "Veröffentlicht") {
        patch.veroeffentlicht = true;
        patch.freigegeben_am = new Date().toISOString();
      } else if (freigabestatus === "Freigegeben") {
        patch.veroeffentlicht = true;
      } else {
        patch.veroeffentlicht = false;
      }
      await S.Protokoll.update(protokoll_id, patch);
      const prot = await S.Protokoll.get(protokoll_id);
      if (prot?.termin_id) {
        const pStatus = freigabestatus === "Veröffentlicht" ? "Veröffentlicht"
          : freigabestatus === "Freigegeben" ? "Freigegeben"
          : freigabestatus === "In Prüfung" ? "In Prüfung" : "Entwurf";
        await S.KalenderTermin.update(prot.termin_id, { protokoll_status: pStatus });
      }
      await schreibeAudit(base44, ctx, "Protokoll", protokoll_id, "protokoll_freigabe", { freigabestatus });
      return { protokoll_id, freigabestatus };
    }

    // ── Dateien ──
    case "datei_anhaengen": {
      const { objekt_typ, objekt_id, datei } = body;
      const entityMap = { Sitzung: "KalenderTermin", TOP: "Tagesordnungspunkt", Beschluss: "Beschluss",
        Abstimmung: "Abstimmung", Aufgabe: "Ausschussaufgabe", Protokoll: "Protokoll" };
      const entity = entityMap[objekt_typ];
      if (!entity) throw new Error("Unbekannter Objekttyp");
      const obj = await getObj(base44, entity, objekt_id);
      const arr = Array.isArray(obj.dateien) ? [...obj.dateien] : [];
      arr.push({ ...datei, datum: datei.datum || new Date().toISOString(), hochgeladen_von_id: ctx.currentMitgliedId || "" });
      await S[entity].update(objekt_id, { dateien: arr });
      await schreibeAudit(base44, ctx, objekt_typ, objekt_id, "datei_anhaengen", { name: datei?.name });
      return { dateien: arr };
    }
    case "datei_entfernen": {
      const { objekt_typ, objekt_id, index } = body;
      const entityMap = { Sitzung: "KalenderTermin", TOP: "Tagesordnungspunkt", Beschluss: "Beschluss",
        Abstimmung: "Abstimmung", Aufgabe: "Ausschussaufgabe", Protokoll: "Protokoll" };
      const entity = entityMap[objekt_typ];
      const obj = await getObj(base44, entity, objekt_id);
      const arr = Array.isArray(obj.dateien) ? [...obj.dateien] : [];
      arr.splice(index, 1);
      await S[entity].update(objekt_id, { dateien: arr });
      await schreibeAudit(base44, ctx, objekt_typ, objekt_id, "datei_entfernen", { index });
      return { dateien: arr };
    }

    default:
      throw new Error("Unbekannte Aktion: " + aktion);
  }
}