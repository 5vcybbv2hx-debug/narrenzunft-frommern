import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMeinMitglied, istVerwaltung } from "../../shared/mitgliedBerechtigung.ts";

/**
 * Anwesenheit für Trainings-Termine (KalenderAnmeldung.anwesend).
 *
 * Mitglieder melden sich selbst an/ab (KalenderAnmeldung). Die ANWESENHEIT
 * darf nur setzen:
 *   - Vorstand / Stellv. / Admin
 *   - Eintragung im Termin (KalenderTermin.verantwortliche_ids)
 *   - Verantwortliche der Gruppe (haesgruppe_id -> Haesgruppe.verantwortliche_ids
 *     / verantwortlicher_id)
 * RLS erlaubt KalenderAnmeldung-Updates nur dem Owner — deshalb service-role.
 *
 * Aktionen:
 *  - "liste"  : alle Anmeldungen eines Termins (mit anwesend-Status)
 *  - "setzen" : anwesend true/false für eine anmeldung_id
 *               (oder termin_id + mitglied_id); legt ggf. eine
 *               Anmeldung an (implizit angemeldet)
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const { aktion } = body;

    async function darfSetzen(termin) {
      if (istVerwaltung(user)) return true;
      const mein = await loeseMeinMitglied(base44, user);
      if (!mein || !termin) return false;
      if ((termin.verantwortliche_ids || []).includes(mein.id)) return true;
      if (termin.haesgruppe_id) {
        const g = await S.Haesgruppe.get(termin.haesgruppe_id).catch(() => null);
        if (g) {
          if ((g.verantwortliche_ids || []).includes(mein.id)) return true;
          if (g.verantwortlicher_id === mein.id) return true;
        }
      }
      return false;
    }

    if (aktion === "liste") {
      const { termin_id } = body;
      if (!termin_id) return Response.json({ error: "termin_id fehlt" }, { status: 400 });
      const anmeldungen = await S.KalenderAnmeldung.filter({ termin_id });
      return Response.json({ ok: true, anmeldungen: anmeldungen || [] });
    }

    if (aktion === "setzen") {
      const { anmeldung_id, termin_id, mitglied_id, anwesend } = body;
      let anm;
      let terminId = termin_id;
      if (anmeldung_id) {
        anm = await S.KalenderAnmeldung.get(anmeldung_id).catch(() => null);
        if (anm) terminId = anm.termin_id;
      } else if (termin_id && mitglied_id) {
        const list = await S.KalenderAnmeldung.filter({ termin_id, mitglied_id });
        anm = (list || [])[0];
      }
      if (!terminId) return Response.json({ error: "termin_id fehlt" }, { status: 400 });
      const termin = await S.KalenderTermin.get(terminId).catch(() => null);
      if (!termin) return Response.json({ error: "Termin nicht gefunden" }, { status: 404 });
      if (!(await darfSetzen(termin))) {
        return Response.json({ error: "Nur Verantwortliche der Gruppe oder Vorstand" }, { status: 403 });
      }
      if (anm) {
        await S.KalenderAnmeldung.update(anm.id, { anwesend: anwesend === true });
      } else if (termin_id && mitglied_id) {
        anm = await S.KalenderAnmeldung.create({
          termin_id,
          mitglied_id,
          status: "Angemeldet", // durch Anwesenheit implizit angemeldet
          anwesend: anwesend === true,
        });
      } else {
        return Response.json({ error: "Anmeldung nicht gefunden" }, { status: 404 });
      }
      return Response.json({ ok: true, anmeldung_id: anm.id, anwesend: anwesend === true });
    }

    return Response.json({ error: "Unbekannte Aktion: " + aktion }, { status: 400 });
  } catch (error) {
    console.error("verwalteTrainingAnwesenheit:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}