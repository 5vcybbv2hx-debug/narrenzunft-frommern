import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMeinMitglied, istVerwaltung, istElternVon } from "../../shared/mitgliedBerechtigung.ts";

/**
 * U18-Begleitbestätigung (U18Begleitung-Entity) für Termine/Ausfahrten/
 * Veranstaltungen mit Pflicht-Flag (u18_begleitung_erforderlich).
 *
 * Ablauf:
 *   1. 'anlegen': Bei Anmeldung einer U18-Person wird ein Datensatz mit
 *      Begleitperson (Mitglied oder externer Name) angelegt (Status: Ausstehend).
 *      Anlegen darf: die/der U18 selbst, ein Elternteil oder Verwaltung.
 *   2. 'eltern_bestaetigen': Erziehungsberechtigte/r bestätigt
 *      (Verwandtschafts-Prüfung via istElternVon) — mit Zeitstempel.
 *   3. 'begleitung_bestaetigen': Die Begleitperson bestätigt selbst (falls
 *      Mitglied); bei externer Begleitung nur Vorstand (manuell, z. B. vor Ort).
 *   4. 'liste': Begleitungen eines Termins (optional typ).
 * Erst wenn Eltern UND Begleitperson bestätigt haben, ist der Status 'Bestätigt'.
 * Updates laufen im service-role (RLS update = vorstand/admin; service-role
 * bypasses RLS). _von-Felder speichern die Mitglieds-ID (verfolgbar).
 */
const jetztISO = () => new Date().toISOString();

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const { aktion } = body;

    async function nameVon(id) {
      if (!id) return "";
      const m = await S.Mitglied.get(id).catch(() => null);
      return m ? `${m.vorname || ""} ${m.nachname || ""}`.trim() : "";
    }

    function statusVon(e) {
      const eltern = !!e.eltern_bestaetigt_am;
      const begl = !!e.begleitung_bestaetigt_am;
      return eltern && begl ? "Bestätigt" : "Ausstehend";
    }

    if (aktion === "anlegen") {
      const { typ, termin_id, u18_mitglied_id, begleit_mitglied_id, begleit_name, notiz } = body;
      if (!termin_id || !u18_mitglied_id || !typ) {
        return Response.json({ error: "typ, termin_id und u18_mitglied_id fehlen" }, { status: 400 });
      }
      if (!begleit_mitglied_id && !String(begleit_name || "").trim()) {
        return Response.json({ error: "Begleitperson fehlt (Mitglied oder Name)" }, { status: 400 });
      }
      const mein = await loeseMeinMitglied(base44, user);
      const darf = istVerwaltung(user)
        || (mein && mein.id === u18_mitglied_id)
        || (await istElternVon(base44, mein?.id, u18_mitglied_id));
      if (!darf) {
        return Response.json({ error: "Nur U18-Person selbst, Erziehungsberechtigte/r oder Verwaltung" }, { status: 403 });
      }
      // Doppel-Anlage vermeiden: bestehenden Eintrag aktualisieren
      const bestehende = await S.U18Begleitung.filter({ typ, termin_id, u18_mitglied_id }).catch(() => []);
      const aktiv = (bestehende || [])[0];
      if (aktiv) {
        const erg = await S.U18Begleitung.update(aktiv.id, {
          begleit_mitglied_id: begleit_mitglied_id || "",
          begleit_name: begleit_mitglied_id ? await nameVon(begleit_mitglied_id) : String(begleit_name || "").trim(),
        });
        return Response.json({ ok: true, existierend: true, id: aktiv.id, begleitung: erg });
      }
      const rec = await S.U18Begleitung.create({
        typ,
        termin_id,
        u18_mitglied_id,
        u18_name: await nameVon(u18_mitglied_id),
        begleit_mitglied_id: begleit_mitglied_id || "",
        begleit_name: begleit_mitglied_id ? await nameVon(begleit_mitglied_id) : String(begleit_name || "").trim(),
        status: "Ausstehend",
        notiz: notiz || "",
      });
      return Response.json({ ok: true, id: rec.id, begleitung: rec });
    }

    if (aktion === "eltern_bestaetigen") {
      const bid = body.eintrag_id || body.begleitung_id;
      const e = bid ? await S.U18Begleitung.get(bid).catch(() => null) : null;
      if (!e) return Response.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
      const mein = await loeseMeinMitglied(base44, user);
      if (!mein) return Response.json({ error: "Kein Mitglied verknüpft" }, { status: 403 });
      const ok = istVerwaltung(user) || (await istElternVon(base44, mein.id, e.u18_mitglied_id));
      if (!ok) return Response.json({ error: "Nur Erziehungsberechtigte/r oder Verwaltung" }, { status: 403 });
      const erg = await S.U18Begleitung.update(bid, {
        eltern_bestaetigt_am: jetztISO(),
        eltern_bestaetigt_von: mein.id,
        status: statusVon({ ...e, eltern_bestaetigt_am: jetztISO() }),
      });
      return Response.json({ ok: true, id: bid, begleitung: erg });
    }

    if (aktion === "begleitung_bestaetigen") {
      const bid = body.eintrag_id || body.begleitung_id;
      const e = bid ? await S.U18Begleitung.get(bid).catch(() => null) : null;
      if (!e) return Response.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
      const mein = await loeseMeinMitglied(base44, user);
      // Bei externer Begleitung (kein Mitglied) darf nur die Verwaltung bestätigen
      const ok = istVerwaltung(user) || (mein && e.begleit_mitglied_id === mein.id);
      if (!ok) return Response.json({ error: "Nur die Begleitperson selbst oder Verwaltung" }, { status: 403 });
      const erg = await S.U18Begleitung.update(bid, {
        begleitung_bestaetigt_am: jetztISO(),
        begleitung_bestaetigt_von: mein?.id || "",
        status: statusVon({ ...e, begleitung_bestaetigt_am: jetztISO() }),
      });
      return Response.json({ ok: true, id: bid, begleitung: erg });
    }

    if (aktion === "liste") {
      const { termin_id, typ } = body;
      if (!termin_id) return Response.json({ error: "termin_id fehlt" }, { status: 400 });
      const q = { termin_id };
      if (typ) q.typ = typ;
      const list = await S.U18Begleitung.filter(q);
      return Response.json({ ok: true, begleitungen: list || [] });
    }

    return Response.json({ error: "Unbekannte Aktion: " + aktion }, { status: 400 });
  } catch (error) {
    console.error("verwalteU18Begleitung:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}