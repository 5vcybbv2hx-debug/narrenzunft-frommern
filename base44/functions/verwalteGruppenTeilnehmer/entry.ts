import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Sichere Verwaltung der Teilnehmer:innen einer Gruppe (z. B. Tanzgruppe Hexentanz).
 *
 * Erlaubt für:
 *  - Admin, Vorstand, Stv. Vorstand
 *  - Aktuelle Spartenleiter/Verantwortliche der Gruppe
 *
 * Aktionen (mit Service-Role, clientseitig an RLS gebunden):
 *  - 'add'    { haesgruppe_id, mitglied_id, position? }  → Teilnehmer:in anlegen (Duplikat-Prüfung)
 *  - 'update' { haesgruppe_id, teilnehmer_id, position?, aktiv? } → Position/Status ändern
 *  - 'remove' { haesgruppe_id, teilnehmer_id } → Teilnehmer:in entfernen
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    const body = await req.json();
    const { aktion, haesgruppe_id, mitglied_id, position, aktiv, teilnehmer_id } = body;
    if (!aktion) return Response.json({ error: 'aktion fehlt' }, { status: 400 });
    if (!haesgruppe_id) return Response.json({ error: 'haesgruppe_id fehlt' }, { status: 400 });

    const srv = base44.asServiceRole;

    // ── Autorisierung prüfen ──
    const gruppen = await srv.entities.Haesgruppe.filter({ id: haesgruppe_id });
    const gruppe = gruppen?.[0];
    if (!gruppe) return Response.json({ error: 'Gruppe nicht gefunden' }, { status: 404 });

    const isFuehrung = ['admin', 'vorstand', 'stellv_vorstand'].includes(user.role);
    if (!isFuehrung) {
      // Spartenleiter: muss aktuelle(r) Verantwortliche(r) dieser Gruppe sein
      const meineMitglieder = await srv.entities.Mitglied.filter({ user_id: user.id });
      const meinMitglied = meineMitglieder?.[0];
      const aktuelleVerantwortliche = gruppe.verantwortliche_ids || (gruppe.verantwortlicher_id ? [gruppe.verantwortlicher_id] : []);
      const istVerantwortlich = meinMitglied && aktuelleVerantwortliche.includes(meinMitglied.id);
      if (!istVerantwortlich) {
        return Response.json({ error: 'Keine Berechtigung — nur Vorstand oder Spartenleiter der Gruppe dürfen Teilnehmer:innen verwalten.' }, { status: 403 });
      }
    }

    // ── Aktionen ──
    if (aktion === 'add') {
      if (!mitglied_id) return Response.json({ error: 'mitglied_id fehlt' }, { status: 400 });

      // Mitglied muss existieren
      const ziel = await srv.entities.Mitglied.filter({ id: mitglied_id });
      if (!ziel?.length) return Response.json({ error: 'Mitglied nicht gefunden' }, { status: 404 });

      // Duplikat-Prüfung (über alle Einträge, auch pausierte)
      const vorhanden = await srv.entities.GruppenTeilnehmer.filter({ haesgruppe_id, mitglied_id });
      if (vorhanden?.length > 0) {
        return Response.json({ error: 'Dieses Mitglied ist bereits als Teilnehmer:in eingetragen.' }, { status: 409 });
      }

      const neu = await srv.entities.GruppenTeilnehmer.create({
        haesgruppe_id,
        mitglied_id,
        position: typeof position === 'string' ? position.trim() : '',
        aktiv: true,
      });
      return Response.json({ erfolg: true, teilnehmer: neu });
    }

    if (aktion === 'update') {
      if (!teilnehmer_id) return Response.json({ error: 'teilnehmer_id fehlt' }, { status: 400 });
      const patch = {};
      if (position !== undefined) patch.position = typeof position === 'string' ? position.trim() : '';
      if (aktiv !== undefined) patch.aktiv = !!aktiv;
      const t = await srv.entities.GruppenTeilnehmer.update(teilnehmer_id, patch);
      return Response.json({ erfolg: true, teilnehmer: t });
    }

    if (aktion === 'remove') {
      if (!teilnehmer_id) return Response.json({ error: 'teilnehmer_id fehlt' }, { status: 400 });
      await srv.entities.GruppenTeilnehmer.delete(teilnehmer_id);
      return Response.json({ erfolg: true });
    }

    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
