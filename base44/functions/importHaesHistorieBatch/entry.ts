import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'vorstand') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const entries = body.entries || [];
    if (!entries.length) {
      return Response.json({ error: 'Keine Daten übergeben' }, { status: 400 });
    }

    const results = { created: 0, errors: [] };

    for (const entry of entries) {
      try {
        await base44.asServiceRole.entities.HaesHistorie.create({
          haes_id: entry.haes_id,
          mitglied_id: entry.mitglied_id || null,
          von_datum: entry.von_datum,
          bis_datum: entry.bis_datum || null,
          aktiv: entry.aktiv || false,
          notizen: entry.notizen || ''
        });
        results.created++;
      } catch (err) {
        results.errors.push({ haes_id: entry.haes_id, error: err.message });
      }
    }

    return Response.json(results);
  } catch (err) {
    console.error('importHaesHistorieBatch error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}