import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'vorstand') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const fileUrl = body.fileUrl || 'https://files.base44.com/mp/private/6a216d71b6fcba886566ffb1/b1190ec3a_haes_historie_final.json';
    
    const response = await fetch(fileUrl);
    if (!response.ok) {
      const text = await response.text();
      return Response.json({ error: `Fetch failed (${response.status}): ${text.slice(0, 200)}` }, { status: 502 });
    }
    const historie = await response.json();
    
    const results = { created: 0, errors: [] };
    
    for (const entry of historie) {
      try {
        const record = {
          haes_id: entry.haes_id,
          von_datum: entry.von_datum,
          bis_datum: entry.bis_datum || null,
          aktiv: entry.aktiv || false,
          notizen: entry.notizen || ''
        };
        if (entry.mitglied_id) {
          record.mitglied_id = entry.mitglied_id;
        }
        await base44.asServiceRole.entities.HaesHistorie.create(record);
        results.created++;
      } catch (err) {
        results.errors.push({ haes_id: entry.haes_id, von: entry.von_datum, error: err.message });
      }
    }
    
    return Response.json(results);
  } catch (err) {
    console.error('importHaesHistorieFromURL error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}