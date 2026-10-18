import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMeinMitglied, istVerwaltung } from "../../shared/mitgliedBerechtigung.ts";

/**
 * U18-Begleitbestätigung für Veranstaltungen/Umzüge mit Pflicht-Flag
 * (u18_begleitung_erforderlich). Ablauf:
 *   1. 'anlegen': Bei Anmeldung einer U18-Person wird ein Datensatz mit
 *      Begleitperson (Mitglied oder externer Name) angelegt (Status: Ausstehend).
 *   2. 'eltern_bestaetigen': Erziehungsberechtigte/r bestätigt (Verwandtschaft
 *      beziehung 'Elternteil') — mit Zeitstempel.
 *   3. 'begleitung_bestaetigen': Die Begleitperson bestätigt selbst (falls
 *      Mitglied); bei externer Begleitung nur Vorstand (manuell, z. B. vor Ort).
 * Erst wenn beide bestätigt haben, ist der Status 'Bestätigt'.
 */
const jetztISO = () => new Date().toISOString();

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const S = base44.asServiceRole.entities;
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const mitglied = await loeseMeinMitglied(base44, user);
    const body = await req.json().catch(() => ({}));
    const { aktion } = body;

    async function istElternteilVon(u18Id) {
      if (!mitglied || !u18Id) return false;
      const verw = await S.Verwandtschaft.filter({ mitglied_id: u18Id }).catch(() => []);
      return (verw || []).some(v =>
        v.verwandter_id === mitglied.id && String(v.beziehung || "").toLowerCase().includes("elter"));
    }

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

    switch (aktion) {
      case "anlegen": {
        const { typ, termin_id, u18_mitglied_id, begleit_mitglied_id, begleit_name } = body;
        if (!termin_id || !u18_mitglied_id || !typ) {
          return Response.json({ error: "typ, termin_id und u18_mitglied_id fehlen" }, { status: 400 });
        }
        if (!begleit_mitglied_id && !String(begleit_name || "").trim()) {
          return Response.json({ error: "Begleitperson fehlt (Mitglied oder Name)" }, { status: 400 });
        }
        // Anlegen darf: die/der U18 selbst, ein Elternteil, oder Verwaltung
        const darf = istVerwaltung(user) || mitglied?.id === u18_mitglied_id || (await istElternteilVon(u18_mitglied_id));
        if (!darf) return Response.json({ error: "Nur U18-Person selbst, Erziehungsberechtigte/r oder Verwaltung" }, { status: 403 });
        // Doppel-Anlage vermeiden
        const bestehende = await S.U18Begleitung.filter({ termin_id, u18_mitglied_id }).catch(() => []);
        const aktiv = (bestehende || []).find(e => e.typ === typ);
        if (aktiv) {
          const erg = await S.U18Begleitung.update(aktiv.id, {
            begleit_mitglied_id: begleit_mitglied_id || "",
            begleit_name: String(begleit_name || "").trim(),
          });
          return Response.json({ ok: true, eintrag: erg });
        }
        const eintrag = await S.U18Begleitung.create({
          typ, termin_id, u18_mitglied_id,
          u18_name: await nameVon(u18_mitglied_id),
          begleit_mitglied_id: begleit_mitglied_id || "",
          begleit_name: begleit_mitglied_id ? await nameVon(begleit_mitglied_id) : String(begleit_name || "").trim(),
          eltern_bestaetigt_am: "", eltern_bestaetigt_von: "",
          begleitung_bestaetigt_am: "", begleitung_bestaetigt_von: "",
          status: "Ausstehend", notiz: "",
        });
        return Response.json({ ok: true, eintrag });
      }

      case "eltern_bestaetigen": {
        const { eintrag_id } = body;
        const e = eintrag_id ? await S.U18Begleitung.get(eintrag_id).catch(() => null) : null;
        if (!e) return Response.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
        const darf = istVerwaltung(user) || (await istElternteilVon(e.u18_mitglied_id));
        if (!darf) return Response.json({ error: "Nur Erziehungsberechtigte/r oder Verwaltung" }, { status: 403 });
        const name = istVerwaltung(user) && !(await istElternteilVon(e.u18_mitglied_id)) ? "Vorstand (manuell)" : (mitglied ? `${mitglied.vorname} ${mitglied.nachname}`.trim() : user.email);
        const erg = await S.U18Begleitung.update(eintrag_id, {
          eltern_bestaetigt_am: jetztISO(), eltern_bestaetigt_von: name,
          status: statusVon({ ...e, eltern_bestaetigt_am: jetztISO() }),
        });
        return Response.json({ ok: true, eintrag: erg });
      }

      case "begleitung_bestaetigen": {
        const { eintrag_id } = body;
        const e = eintrag_id ? await S.U18Begleitung.get(eintrag_id).catch(() => null) : null;
        if (!e) return Response.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
        // Bei externer Begleitung (kein Mitglied) darf nur die Verwaltung bestätigen
        const darf = istVerwaltung(user) || (mitglied && e.begleit_mitglied_id === mitglied.id);
        if (!darf) return Response.json({ error: "Nur die Begleitperson selbst oder Verwaltung" }, { status: 403 });
        const name = istVerwaltung(user) && !(mitglied && e.begleit_mitglied_id === mitglied.id)
          ? "Vorstand (manuell)" : (mitglied ? `${mitglied.vorname} ${mitglied.nachname}`.trim() : user.email);
        const erg = await S.U18Begleitung.update(eintrag_id, {
          begleitung_bestaetigt_am: jetztISO(), begleitung_bestaetigt_von: name,
          status: statusVon({ ...e, begleitung_bestaetigt_am: jetztISO() }),
        });
        return Response.json({ ok: true, eintrag: erg });
      }

      default:
        return Response.json({ error: "Unbekannte Aktion: " + aktion }, { status: 400 });
    }
  } catch (error) {
    console.error("verwalteU18Begleitung:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
