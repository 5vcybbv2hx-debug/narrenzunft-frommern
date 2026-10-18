import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import { hashToken } from "../../shared/tokenHash.ts";

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
      // Token existiert — Klartext ist nicht rekonstruierbar (nur Hash gespeichert).
      return Response.json({
        success: true,
        existing: true,
        token: null,
        created_at: einstellungen[0].created_date,
        message: 'Token existiert bereits. Mit regenerate=true neu generieren, um einen neuen Link zu erhalten.'
      });
    }

    // Neuen Token generieren (kryptografisch sicher)
    const newToken = crypto.getRandomValues(new Uint8Array(16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    // NUR den Hash speichern — AppEinstellung ist für alle Mitglieder lesbar.
    const tokenHash = await hashToken(newToken);

    if (einstellungen.length > 0) {
      await base44.entities.AppEinstellung.update(einstellungen[0].id, { wert_ids: [tokenHash] });
    } else {
      await base44.entities.AppEinstellung.create({
        schluessel: tokenSchluessel,
        wert_ids: [tokenHash]
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