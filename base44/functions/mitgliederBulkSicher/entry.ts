import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { istVorstand, loeseMeinMitglied } from "../../shared/mitgliedBerechtigung.ts";

/**
 * Sichere Sammelaktionen für die Mitgliederliste.
 *
 * Allowlist:
 *  - status_setzen:    Setzt mitgliedsstatus für eine Auswahl (nur Verwaltung).
 *                      Prüft Alterskonsistenz, schreibt MitgliedEreignis, KEIN automatischer
 *                      Wechsel ab 18 (Vorstand entscheidet). Sparten-/Rollensync nur via
 *                      syncVerantwortlicheSicher (wird hier NICHT angerührt).
 *  - sparte_zuordnen:   Setzt haesgruppen_ids (nur Verwaltung), schreibt MitgliedEreignis.
 *  - einladung_entwurf: Erstellt Text-Entwürfe (KEIN Versand!) für Einladung/Nachricht.
 *                      Liefert nur Daten zurück; Frontend zeigt Entwurf, Versand bleibt
 *                      separater, expliziter Schritt.
 *
 * Keine Manipulation von app_rolle oder verantwortliche_ids. Keine Massenmails.
 */
const heuteISO = () => new Date().toISOString().split("T")[0];

const ALTER_STUFEN = {
  "Kleinkind 0-3": [0, 3],
  "Kinder 4-10": [4, 10],
  "Jugendliche 11-14": [11, 14],
  "Jungaktive 15-17": [15, 17],
};

function alterAus(geb) {
  if (!geb) return null;
  const d = new Date(geb);
  if (isNaN(d.getTime())) return null;
  const h = new Date();
  let a = h.getFullYear() - d.getFullYear();
  const m = h.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < d.getDate())) a--;
  return a;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!istVorstand(user)) {
      return Response.json({ error: "Access Denied", message: "Nur Vorstand/Admin." }, { status: 403 });
    }
    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const { aktion, mitglied_ids, } = body;
    if (!aktion) return Response.json({ error: "Keine Aktion angegeben" }, { status: 400 });
    if (!Array.isArray(mitglied_ids) || mitglied_ids.length === 0) {
      return Response.json({ error: "Keine Mitglieder ausgewählt" }, { status: 400 });
    }

    const meinMitglied = await loeseMeinMitglied(base44, user);

    switch (aktion) {
      case "status_setzen": {
        const { mitgliedsstatus } = body;
        if (!mitgliedsstatus) return Response.json({ error: "Status fehlt" }, { status: 400 });
        const results = [];
        for (const mid of mitglied_ids) {
          const m = await S.Mitglied.get(mid).catch(() => null);
          if (!m) { results.push({ id: mid, ok: false, fehler: "Nicht gefunden" }); continue; }
          const alt = alterAus(m.geburtsdatum);
          // Alterskonsistenz prüfen (nur für altersgebundene Stufen)
          const grenz = ALTER_STUFEN[mitgliedsstatus];
          if (grenz && alt !== null && (alt < grenz[0] || alt > grenz[1])) {
            results.push({ id: mid, ok: false, fehler: `Alter ${alt} passt nicht zu „${mitgliedsstatus}"` });
            continue;
          }
          const altStatus = m.mitgliedsstatus;
          await S.Mitglied.update(mid, { mitgliedsstatus });
          await S.MitgliedEreignis.create({
            mitglied_id: mid, typ: "Statuswechsel", datum: heuteISO(),
            titel: `Status: ${altStatus || "–"} → ${mitgliedsstatus}`,
            beschreibung: `Sammelaktion durch ${user.full_name || user.email}`,
            alt_wert: altStatus || "", neu_wert: mitgliedsstatus,
            erstellt_von_id: meinMitglied?.id || "",
          });
          results.push({ id: mid, ok: true });
        }
        const ok = results.filter(r => r.ok).length;
        return Response.json({ aktion, ok, gesamt: results.length, results });
      }
      case "sparte_zuordnen": {
        const { haesgruppen_ids } = body;
        if (!Array.isArray(haesgruppen_ids)) {
          return Response.json({ error: "haesgruppen_ids fehlt" }, { status: 400 });
        }
        const results = [];
        for (const mid of mitglied_ids) {
          const m = await S.Mitglied.get(mid).catch(() => null);
          if (!m) { results.push({ id: mid, ok: false, fehler: "Nicht gefunden" }); continue; }
          const altIds = Array.isArray(m.haesgruppen_ids) ? m.haesgruppen_ids : (m.haesgruppe_id ? [m.haesgruppe_id] : []);
          const neueIds = haesgruppen_ids;
          await S.Mitglied.update(mid, { haesgruppen_ids: neueIds });
          await S.MitgliedEreignis.create({
            mitglied_id: mid, typ: "Spartenzuordnung", datum: heuteISO(),
            titel: `Sparten: ${altIds.length} → ${neueIds.length}`,
            beschreibung: `Sammelaktion durch ${user.full_name || user.email}`,
            alt_wert: altIds.join(","), neu_wert: neueIds.join(","),
            erstellt_von_id: meinMitglied?.id || "",
          });
          results.push({ id: mid, ok: true });
        }
        const ok = results.filter(r => r.ok).length;
        return Response.json({ aktion, ok, gesamt: results.length, results });
      }
      case "einladung_entwurf": {
        // KEIN Versand — nur Daten für einen Entwurf im Frontend.
        const mitglieder = [];
        for (const mid of mitglied_ids) {
          const m = await S.Mitglied.get(mid).catch(() => null);
          if (m) mitglieder.push({
            id: m.id, vorname: m.vorname, nachname: m.nachname,
            email: m.email, telefon: m.telefon, mitgliedsstatus: m.mitgliedsstatus,
          });
        }
        const mitEmail = mitglieder.filter(m => m.email);
        return Response.json({
          aktion,
          entwurf: {
            empfaenger: mitglieder,
            mitEmail: mitEmail.length,
            ohneEmail: mitglieder.length - mitEmail.length,
            // Platzhalter-Text; Frontend zeigt editierbaren Entwurf
            betreff: "Einladung Narrenzunft Frommern",
            text: `Hallo,\n\nDu wurdest zur Narrenzunft-App eingeladen. Bitte melde dich an unter der App, um deine Daten zu sehen und zu pflegen.\n\nMit besten Grüßen\nDein Vorstand`,
          },
        });
      }
      default:
        return Response.json({ error: "Unbekannte Aktion: " + aktion }, { status: 400 });
    }
  } catch (error) {
    console.error("mitgliederBulkSicher:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}