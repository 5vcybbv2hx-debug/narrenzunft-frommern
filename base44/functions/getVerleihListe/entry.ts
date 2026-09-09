import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

/**
 * Öffentliche Liste aller zum Verleih freigegebenen Gegenstände (KEINE Authentifizierung).
 * Gibt NUR öffentlich bestimmte Felder zurück (keine Standorte, Versicherungs- oder TÜV-Daten).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const items = await base44.asServiceRole.entities.Ausruestung.filter({
      verleihbar: true,
      aktiv: true,
    });

    const liste = (items || [])
      .map((a) => ({
        id: a.id,
        name: a.name || '',
        kategorie: a.kategorie || '',
        beschreibung: a.beschreibung || '',
        bild_url: a.bild_url || '',
        preis: a.verleih_preis || 0,
        kaution: a.verleih_kaution || 0,
        notiz: a.verleih_notiz || '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    return Response.json({ liste });
  } catch (e) {
    return Response.json({ error: e?.message || 'Serverfehler' }, { status: 500 });
  }
});