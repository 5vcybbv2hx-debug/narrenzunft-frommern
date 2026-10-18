import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMeinMitglied, istVerwaltung, istElternVon } from "../../shared/mitgliedBerechtigung.ts";

/**
 * U18-Begleitbestätigung (U18Begleitung-Entity).
 *
 * Getrennte Bestätigung: Eltern (via Verwandtschafts-Prüfung) UND
 * Begleitperson (Selbstbestätigung). Status wird erst „Bestätigt", wenn
 * beide vorliegen. Updates laufen im service-role (RLS update =
 * vorstand/admin; service-role bypasses RLS).
 *
 * Aktionen:
 *  - "anlegen"               : Begleitung anlegen (Duplikat-Catch)
 *  - "eltern_bestaetigen"    : Eltern bestätigen (Verwandtschafts-Prüfung)
 *  - "begleitung_bestaetigen": Begleitperson bestätigt selbst
 *  - "liste"                 : Begleitungen eines Termins (optional typ)
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const { aktion } = body;

    if (aktion === "anlegen") {
      const { typ, termin_id, u18_mitglied_id, u18_name, begleit_mitglied_id, begleit_name, notiz } = body;
      if (!termin_id || !u18_mitglied_id) {
        return Response.json({ error: "termin_id und u18_mitglied_id erforderlich" }, { status: 400 });
      }
      const exist = await S.U18Begleitung.filter({ typ: typ || "kalender", termin_id, u18_mitglied_id });
      if ((exist || []).length) {
        return Response.json({ ok: true, existierend: true, id: exist[0].id, begleitung: exist[0] });
      }
      const rec = await S.U18Begleitung.create({
        typ: typ || "kalender",
        termin_id,
        u18_mitglied_id,
        u18_name: u18_name || "",
        begleit_mitglied_id: begleit_mitglied_id || "",
        begleit_name: begleit_name || "",
        status: "Ausstehend",
        notiz: notiz || "",
      });
      return Response.json({ ok: true, id: rec.id, begleitung: rec });
    }

    if (aktion === "eltern_bestaetigen") {
      const { begleitung_id } = body;
      const b = await S.U18Begleitung.get(begleitung_id).catch(() => null);
      if (!b) return Response.json({ error: "Begleitung nicht gefunden" }, { status: 404 });
      const mein = await loeseMeinMitglied(base44, user);
      if (!mein) return Response.json({ error: "Kein Mitglied verknüpft" }, { status: 403 });
      const ok = istVerwaltung(user) || (await istElternVon(base44, mein.id, b.u18_mitglied_id));
      if (!ok) return Response.json({ error: "Nur die Eltern des U18 dürfen bestätigen" }, { status: 403 });
      const jetzt = new Date().toISOString();
      await S.U18Begleitung.update(b.id, {
        eltern_bestaetigt_am: jetzt,
        eltern_bestaetigt_von: mein.id,
        status: b.begleitung_bestaetigt_am ? "Bestätigt" : "Ausstehend",
      });
      return Response.json({ ok: true, id: b.id });
    }

    if (aktion === "begleitung_bestaetigen") {
      const { begleitung_id } = body;
      const b = await S.U18Begleitung.get(begleitung_id).catch(() => null);
      if (!b) return Response.json({ error: "Begleitung nicht gefunden" }, { status: 404 });
      const mein = await loeseMeinMitglied(base44, user);
      if (!mein) return Response.json({ error: "Kein Mitglied verknüpft" }, { status: 403 });
      const ok = istVerwaltung(user) || b.begleit_mitglied_id === mein.id;
      if (!ok) return Response.json({ error: "Nur die eingetragene Begleitperson darf bestätigen" }, { status: 403 });
      const jetzt = new Date().toISOString();
      await S.U18Begleitung.update(b.id, {
        begleitung_bestaetigt_am: jetzt,
        begleitung_bestaetigt_von: mein.id,
        status: b.eltern_bestaetigt_am ? "Bestätigt" : "Ausstehend",
      });
      return Response.json({ ok: true, id: b.id });
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