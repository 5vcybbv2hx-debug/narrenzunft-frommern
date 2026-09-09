import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

/**
 * Öffentliche Verleih-Info für einen Gegenstand (aufgerufen von der QR-Seite /verleih/:id — KEINE Authentifizierung).
 * Gibt NUR öffentlich bestimmte Felder zurück (keine Standorte, Versicherungs- oder TÜV-Daten).
 */
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    // id via JSON-Body (SDK-Aufruf), Query-Parameter (?id=...) oder letzter URL-Segment (direkt HTTP)
    const id = body.id || url.searchParams.get('id') || url.pathname.split('/').filter(Boolean).pop();
    if (!id) return Response.json({ error: 'id fehlt' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const treffer = await base44.asServiceRole.entities.Ausruestung.filter({ id });
    const a = treffer?.[0];
    if (!a || a.aktiv === false || !a.verleihbar) {
      return Response.json({ error: 'Gegenstand nicht gefunden' }, { status: 404 });
    }

    return Response.json({
      name: a.name || '',
      kategorie: a.kategorie || '',
      beschreibung: a.beschreibung || '',
      bild_url: a.bild_url || '',
      preis: a.verleih_preis || 0,
      kaution: a.verleih_kaution || 0,
      notiz: a.verleih_notiz || '',
    });
  } catch (e) {
    return Response.json({ error: e?.message || 'Serverfehler' }, { status: 500 });
  }
});