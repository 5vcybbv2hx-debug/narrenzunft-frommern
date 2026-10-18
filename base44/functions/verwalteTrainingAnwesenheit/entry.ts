import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMeinMitglied, istVerwaltung } from "../../shared/mitgliedBerechtigung.ts";

/**
 * Anwesenheit für Trainings (KalenderTermine mit terminart 'Training').
 *
 * Mitglieder melden sich selbst an/ab (KalenderAnmeldung, Zeitstempel via
 * created/updated_date). Die ANWESENHEIT darf nur setzen:
 *   - Vorstand / Stellv. / Admin
 *   - Verantwortliche der Gruppe (haesgruppe_id -> Haesgruppe.verantwortliche_ids)
 *   - Eintragung im Termin (KalenderTermin.verantwortliche_ids)
 * RLS erlaubt KalenderAnmeldung-Updates nur dem Owner — deshalb service-role.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const S = base44.asServiceRole.entities;
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const mitglied = await loeseMeinMitglied(base44, user);
    const body = await req.json().catch(() => ({}));
    const { aktion } = body;

    async function darfVerwalten(termin) {
      if (istVerwaltung(user)) return true;
      if (!mitglied) return false;
      if ((termin.verantwortliche_ids || []).includes(mitglied.id)) return true;
      if (termin.haesgruppe_id) {
        const g = await S.Haesgruppe.get(termin.haesgruppe_id).catch(() => null);
        if (g && (g.verantwortliche_ids || []).includes(mitglied.id)) return true;
      }
      return false;
    }

    switch (aktion) {
      case "setzen": {
        const { termin_id, mitglied_id, anwesend } = body;
        if (!termin_id || !mitglied_id) return Response.json({ error: "termin_id und mitglied_id fehlen" }, { status: 400 });
        const termin = await S.KalenderTermin.get(termin_id).catch(() => null);
        if (!termin) return Response.json({ error: "Termin nicht gefunden" }, { status: 404 });
        if (!termin.haesgruppe_id) return Response.json({ error: "Termin ist kein Gruppen-Training" }, { status: 400 });
        if (!(await darfVerwalten(termin))) {
          return Response.json({ error: "Nur Verantwortliche der Gruppe oder Vorstand" }, { status: 403 });
        }
        const bestehende = await S.KalenderAnmeldung.filter({ termin_id, mitglied_id });
        const eintrag = (bestehende || [])[0];
        if (eintrag) {
          await S.KalenderAnmeldung.update(eintrag.id, { anwesend: anwesend === true });
        } else {
          await S.KalenderAnmeldung.create({
            termin_id, mitglied_id,
            status: "Angemeldet",          // durch Anwesenheit implizit angemeldet
            anwesend: anwesend === true,
          });
        }
        return Response.json({ ok: true, anwesend: anwesend === true });
      }

      default:
        return Response.json({ error: "Unbekannte Aktion: " + aktion }, { status: 400 });
    }
  } catch (error) {
    console.error("verwalteTrainingAnwesenheit:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
