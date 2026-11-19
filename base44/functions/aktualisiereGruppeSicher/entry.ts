import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Stammdaten einer Gruppe (Name, Beschreibung, Farbe) sicher ändern.
 *
 * Erlaubt für:
 *  - Admin, Vorstand, Stv. Vorstand
 *  - die aktuell eingetragenen Verantwortlichen (Spartenleiter) GENAU dieser Gruppe
 *
 * Warum eine eigene Function: Haesgruppe hat RLS-Update nur für Vorstand/Admin,
 * Spartenleiter könnten ihre eigene Gruppe also nicht umbenennen. Anlegen,
 * Löschen, Typwechsel und Aktiv-Status bleiben bewusst der Führung vorbehalten.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { gruppeId, name, beschreibung, farbe } = body || {};
    if (!gruppeId) return Response.json({ error: 'gruppeId fehlt' }, { status: 400 });

    const srv = base44.asServiceRole;
    const gruppe = (await srv.entities.Haesgruppe.filter({ id: gruppeId }))?.[0];
    if (!gruppe) return Response.json({ error: 'Gruppe nicht gefunden' }, { status: 404 });

    const isFuehrung = ['admin', 'vorstand', 'stellv_vorstand'].includes(user.role);
    if (!isFuehrung) {
      const meineMitglieder = await srv.entities.Mitglied.filter({ user_id: user.id });
      const meinMitglied = meineMitglieder?.[0];
      const verantwortliche = gruppe.verantwortliche_ids?.length
        ? gruppe.verantwortliche_ids
        : (gruppe.verantwortlicher_id ? [gruppe.verantwortlicher_id] : []);
      if (!meinMitglied || !verantwortliche.includes(meinMitglied.id)) {
        return Response.json({
          error: 'Keine Berechtigung — nur Vorstand oder die Verantwortlichen dieser Gruppe dürfen die Stammdaten ändern.',
        }, { status: 403 });
      }
    }

    const patch = {};
    if (typeof name === 'string') {
      const sauber = name.trim();
      if (sauber.length < 2) return Response.json({ error: 'Der Name muss mindestens 2 Zeichen haben.' }, { status: 400 });
      if (sauber.length > 80) return Response.json({ error: 'Der Name ist zu lang (max. 80 Zeichen).' }, { status: 400 });
      patch.name = sauber;
    }
    if (typeof beschreibung === 'string') patch.beschreibung = beschreibung.trim();
    if (typeof farbe === 'string' && farbe.trim()) {
      const f = farbe.trim();
      if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(f)) {
        return Response.json({ error: 'Ungültige Farbe (z. B. #EA2525).' }, { status: 400 });
      }
      patch.farbe = f;
    }
    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Keine Änderungen übergeben.' }, { status: 400 });
    }

    const erg = await srv.entities.Haesgruppe.update(gruppeId, patch);
    return Response.json({ ok: true, gruppe: erg });
  } catch (error) {
    console.error('aktualisiereGruppeSicher:', error);
    return Response.json({ error: error.message || 'Interner Fehler' }, { status: 500 });
  }
}
