import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import {
  istVerwaltung, istVorstand, loeseMeinMitglied, istElternVon,
  ERLAUBTE_AENDERUNGS_FELDER,
} from "../../shared/mitgliedBerechtigung.ts";

/**
 * Verwaltet Selbstpflege-Änderungsanträge (Adresse, Telefon, E-Mail, Notfallkontakt).
 *
 * Aktionen:
 *  - anlegen:   Mitglied (oder Eltern für verknüpftes Kind) reicht Änderung ein.
 *               Server prüft Eigentümerschaft/Elternbezug. Feld-Whitelist (KEINE Bankdaten).
 *  - liste:     Verwaltung sieht alle offenen; Mitglied sieht eigene.
 *  - genehmigen: Verwaltung übernimmt Felder in Mitglied-Datensatz, setzt Status=Genehmigt.
 *  - ablehnen:   Verwaltung lehnt ab (mit Notiz).
 *
 * Keine Bank-/IBAN-/SEPA-Felder.
 */
const heuteISO = () => new Date().toISOString().split("T")[0];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const { aktion } = body;
    if (!aktion) return Response.json({ error: "Keine Aktion" }, { status: 400 });

    const meinMitglied = await loeseMeinMitglied(base44, user);

    switch (aktion) {
      case "anlegen": {
        const { ziel_mitglied_id, felder, notiz } = body;
        if (!ziel_mitglied_id) return Response.json({ error: "ziel_mitglied_id fehlt" }, { status: 400 });
        if (!Array.isArray(felder) || felder.length === 0) {
          return Response.json({ error: "Keine Felder angegeben" }, { status: 400 });
        }
        // Berechtigung: Eigenes Profil ODER Eltern für verknüpftes Kind
        let erlaubt = false;
        if (meinMitglied && meinMitglied.id === ziel_mitglied_id) erlaubt = true;
        if (!erlaubt && meinMitglied) {
          erlaubt = await istElternVon(base44, meinMitglied.id, ziel_mitglied_id);
        }
        if (!erlaubt) {
          return Response.json({ error: "Keine Berechtigung für dieses Mitglied" }, { status: 403 });
        }
        // Feld-Whitelist & alt-Wert ermitteln
        const ziel = await S.Mitglied.get(ziel_mitglied_id).catch(() => null);
        if (!ziel) return Response.json({ error: "Ziel-Mitglied nicht gefunden" }, { status: 404 });
        const bereinigt = [];
        for (const f of felder) {
          if (!ERLAUBTE_AENDERUNGS_FELDER.includes(f.feld)) {
            return Response.json({ error: `Feld nicht erlaubt: ${f.feld}` }, { status: 400 });
          }
          bereinigt.push({
            feld: f.feld,
            alt: ziel[f.feld] || "",
            neu: f.neu ?? "",
          });
        }
        const antrag = await S.Aenderungsantrag.create({
          mitglied_id: meinMitglied.id,
          ziel_mitglied_id,
          ziel_familie_id: ziel.familie_id || "",
          felder: bereinigt,
          status: "Offen",
          notiz: notiz || "",
        });
        return Response.json({ antrag });
      }
      case "liste": {
        const nurOffen = body.nur_offen !== false;
        let liste = [];
        if (istVerwaltung(user)) {
          liste = await S.Aenderungsantrag.list("-created_date", 200);
        } else if (meinMitglied) {
          liste = await S.Aenderungsantrag.filter({ mitglied_id: meinMitglied.id });
        }
        if (nurOffen) liste = (liste || []).filter(a => a.status === "Offen");
        // Zielnamen anreichern
        const ids = [...new Set((liste || []).map(a => a.ziel_mitglied_id).filter(Boolean))];
        const namen = {};
        for (const id of ids) {
          const m = await S.Mitglied.get(id).catch(() => null);
          if (m) namen[id] = `${m.vorname} ${m.nachname}`;
        }
        return Response.json({ antraege: liste, namen });
      }
      case "genehmigen": {
        if (!istVorstand(user)) {
          return Response.json({ error: "Nur Vorstand/Admin" }, { status: 403 });
        }
        const { antrag_id, notiz } = body;
        if (!antrag_id) return Response.json({ error: "antrag_id fehlt" }, { status: 400 });
        const a = await S.Aenderungsantrag.get(antrag_id).catch(() => null);
        if (!a) return Response.json({ error: "Antrag nicht gefunden" }, { status: 404 });
        if (a.status !== "Offen") return Response.json({ error: "Antrag nicht mehr offen" }, { status: 400 });
        // Felder in Ziel-Mitglied übernehmen
        const ziel = await S.Mitglied.get(a.ziel_mitglied_id).catch(() => null);
        if (!ziel) return Response.json({ error: "Ziel-Mitglied nicht gefunden" }, { status: 404 });
        const update = {};
        for (const f of (a.felder || [])) {
          if (ERLAUBTE_AENDERUNGS_FELDER.includes(f.feld)) update[f.feld] = f.neu;
        }
        await S.Mitglied.update(a.ziel_mitglied_id, update);
        await S.Aenderungsantrag.update(antrag_id, {
          status: "Genehmigt",
          entschieden_von_id: meinMitglied?.id || "",
          entschieden_am: new Date().toISOString(),
          notiz: notiz || a.notiz || "",
        });
        // Ereignis protokollieren
        await S.MitgliedEreignis.create({
          mitglied_id: a.ziel_mitglied_id, typ: "Notiz", datum: heuteISO(),
          titel: "Änderungsantrag genehmigt",
          beschreibung: `Felder: ${(a.felder || []).map(f => f.feld).join(", ")}`,
          erstellt_von_id: meinMitglied?.id || "",
        });
        return Response.json({ ok: true, antrag_id });
      }
      case "ablehnen": {
        if (!istVorstand(user)) {
          return Response.json({ error: "Nur Vorstand/Admin" }, { status: 403 });
        }
        const { antrag_id, notiz } = body;
        if (!antrag_id) return Response.json({ error: "antrag_id fehlt" }, { status: 400 });
        const a = await S.Aenderungsantrag.get(antrag_id).catch(() => null);
        if (!a) return Response.json({ error: "Antrag nicht gefunden" }, { status: 404 });
        if (a.status !== "Offen") return Response.json({ error: "Antrag nicht mehr offen" }, { status: 400 });
        await S.Aenderungsantrag.update(antrag_id, {
          status: "Abgelehnt",
          entschieden_von_id: meinMitglied?.id || "",
          entschieden_am: new Date().toISOString(),
          notiz: notiz || "",
        });
        return Response.json({ ok: true, antrag_id });
      }
      default:
        return Response.json({ error: "Unbekannte Aktion: " + aktion }, { status: 400 });
    }
  } catch (error) {
    console.error("aenderungsantragVerwalten:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}