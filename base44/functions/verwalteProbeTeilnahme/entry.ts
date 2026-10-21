import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { loeseMeinMitglied, istVerwaltung, istElternVon } from '../../shared/mitgliedBerechtigung.ts';

/**
 * Sichere Verwaltung von Probe-Abmeldungen und Anwesenheit für Tanzgruppen.
 *
 * Aktionen:
 *  - 'abmelden'           { termin_id, mitglied_id?, grund? } → Abmeldung mit Zeitstempel.
 *                         Erlaubt für: die Person selbst, Elternteil (Verwandtschaft),
 *                         Vorstand/Stellv./Admin, Gruppen-Verantwortliche (verantwortliche_ids).
 *  - 'abmeldung_loeschen' { termin_id, mitglied_id? }        → Rücknahme (gleiche Rechte).
 *  - 'anwesenheit_setzen' { termin_id, eintraege: [{mitglied_id, anwesend}] }
 *                         → nur Vorstand/Stellv./Admin oder Gruppen-Verantwortliche.
 *  - 'liste'              { termin_id } → alle Teilnahme-Datensätze des Termins.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const { aktion, termin_id, grund } = body;
    if (!aktion) return Response.json({ error: 'aktion fehlt' }, { status: 400 });
    if (!termin_id) return Response.json({ error: 'termin_id fehlt' }, { status: 400 });

    const termin = await S.SpartenTermin.get(termin_id).catch(() => null);
    if (!termin) return Response.json({ error: 'Termin nicht gefunden' }, { status: 404 });
    const gruppeId = termin.haesgruppe_id;
    const mein = await loeseMeinMitglied(base44, user);

    async function istGruppenVerantwortlicher() {
      if (!mein || !gruppeId) return false;
      const g = await S.Haesgruppe.get(gruppeId).catch(() => null);
      if (!g) return false;
      const ids = g.verantwortliche_ids || (g.verantwortlicher_id ? [g.verantwortlicher_id] : []);
      return ids.includes(mein.id);
    }

    async function findeOderLegeAn(mitgliedId) {
      const list = await S.ProbeTeilnahme.filter({ termin_id, mitglied_id: mitgliedId });
      if (list && list.length > 0) return list[0];
      return await S.ProbeTeilnahme.create({ termin_id, haesgruppe_id: gruppeId, mitglied_id: mitgliedId });
    }

    if (aktion === 'liste') {
      const saetze = await S.ProbeTeilnahme.filter({ termin_id });
      return Response.json({ erfolg: true, teilnahmen: saetze || [] });
    }

    if (aktion === 'abmelden' || aktion === 'abmeldung_loeschen') {
      const zielMitgliedId = body.mitglied_id || (mein ? mein.id : null);
      if (!zielMitgliedId) return Response.json({ error: 'Mitglied konnte nicht aufgelöst werden' }, { status: 400 });

      let erlaubt = istVerwaltung(user) || (mein && mein.id === zielMitgliedId);
      if (!erlaubt && mein) erlaubt = await istElternVon(base44, mein.id, zielMitgliedId);
      if (!erlaubt) erlaubt = await istGruppenVerantwortlicher();
      if (!erlaubt) {
        return Response.json({ error: 'Keine Berechtigung — nur selbst, Elternteil, Vorstand oder Gruppen-Verantwortliche.' }, { status: 403 });
      }

      const satz = await findeOderLegeAn(zielMitgliedId);
      if (aktion === 'abmelden') {
        await S.ProbeTeilnahme.update(satz.id, {
          abgemeldet: true,
          abgemeldet_am: new Date().toISOString(),
          abgemeldet_durch_id: mein ? mein.id : '',
          grund: String(grund || '').slice(0, 200),
        });
      } else {
        await S.ProbeTeilnahme.update(satz.id, {
          abgemeldet: false, abgemeldet_am: '', abgemeldet_durch_id: '', grund: '',
        });
      }
      return Response.json({ erfolg: true, aktion, termin_id, mitglied_id: zielMitgliedId });
    }

    if (aktion === 'anwesenheit_setzen') {
      const erlaubt = istVerwaltung(user) || await istGruppenVerantwortlicher();
      if (!erlaubt) {
        return Response.json({ error: 'Keine Berechtigung — nur Vorstand oder Gruppen-Verantwortliche.' }, { status: 403 });
      }
      const eintraege = Array.isArray(body.eintraege) ? body.eintraege : [];
      if (!eintraege.length) return Response.json({ error: 'eintraege fehlen' }, { status: 400 });
      const jetzt = new Date().toISOString();
      let gesetzt = 0;
      for (const e of eintraege) {
        if (!e || !e.mitglied_id) continue;
        const satz = await findeOderLegeAn(e.mitglied_id);
        await S.ProbeTeilnahme.update(satz.id, {
          anwesend: !!e.anwesend,
          anwesend_gesetzt_von: mein ? mein.id : '',
          anwesend_gesetzt_am: jetzt,
        });
        gesetzt++;
      }
      return Response.json({ erfolg: true, gesetzt });
    }

    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || 'Interner Fehler' }, { status: 500 });
  }
}
