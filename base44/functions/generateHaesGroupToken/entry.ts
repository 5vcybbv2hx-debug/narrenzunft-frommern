import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

/**
 * Generiert einen eindeutigen Token für eine Häsgruppe
 * zum Abonnieren ihres personalisierten Kalender-Feeds
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { haesgruppe_id, regenerate } = await req.json();
    if (!haesgruppe_id) {
      return Response.json({ error: "haesgruppe_id required" }, { status: 400 });
    }

    // Token-Schlüssel: "haesgroup_" + Häsgruppen-ID
    const tokenSchluessel = `haesgroup_${haesgruppe_id}`;

    // Existierende Tokens suchen
    let einstellungen = await base44.entities.AppEinstellung.filter({ schluessel: tokenSchluessel });

    if (einstellungen.length > 0 && !regenerate) {
      // Existierender Token - zurückgeben
      return Response.json({
        success: true,
        token: einstellungen[0].wert_ids?.[0],
        created_at: einstellungen[0].created_date,
        url: `${Deno.env.get('BASE44_APP_URL')}/api/calendar/haesgroup/${einstellungen[0].wert_ids?.[0]}.ics`
      });
    }

    // Neuen Token generieren (UUID-ähnlich)
    const newToken = crypto.getRandomValues(new Uint8Array(16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (einstellungen.length > 0) {
      // Existierenden Token aktualisieren
      await base44.entities.AppEinstellung.update(einstellungen[0].id, { wert_ids: [newToken] });
    } else {
      // Neuen Eintrag erstellen
      await base44.entities.AppEinstellung.create({
        schluessel: tokenSchluessel,
        wert_ids: [newToken]
      });
    }

    return Response.json({
      success: true,
      token: newToken,
      url: `${Deno.env.get('BASE44_APP_URL')}/api/calendar/haesgroup/${newToken}.ics`
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});