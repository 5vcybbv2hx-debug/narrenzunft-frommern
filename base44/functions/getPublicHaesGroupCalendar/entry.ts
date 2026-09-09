import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";

/**
 * Öffentlicher Kalender-Feed (ICS) für eine Häsgruppe basierend auf Token.
 * Keine Authentifizierung erforderlich - Token ist der Zugangsschlüssel.
 * Verwendet base44.asServiceRole statt raw fetch mit Umgebungsvariablen.
 */
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.pathname.split('/').pop()?.replace('.ics', '');

    if (!token) {
      return Response.json({ error: "Token required" }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Token in AppEinstellung suchen (format: "haesgroup_<ID>")
    const einstellungen = await base44.asServiceRole.entities.AppEinstellung.list();
    const haesEinstellung = einstellungen.find(e =>
      e.schluessel?.startsWith('haesgroup_') && e.wert_ids?.[0] === token
    );

    if (!haesEinstellung) {
      return Response.json({ error: "Invalid token" }, { status: 404 });
    }

    const haesgruppe_id = haesEinstellung.schluessel.replace('haesgroup_', '');

    // Lade alle Kalendertermine für diese Häsgruppe
    const alle_termine = await base44.asServiceRole.entities.KalenderTermin.list('datum', 500);

    // Filter: nur Häsgruppen-Termine (sichtbarkeit='haesgruppe' + haesgruppe_id matching)
    const gruppe_termine = alle_termine.filter(t =>
      t.sichtbarkeit === 'haesgruppe' && t.haesgruppe_id === haesgruppe_id
    );

    // ICS generieren
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Narrenzunft//Häsgruppen-Kalender//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Häsgruppen-Kalender',
      'X-WR-TIMEZONE:Europe/Berlin',
    ];

    for (const t of gruppe_termine) {
      const dtStart = t.datum?.replace(/-/g, '');
      const startTime = t.startzeit?.replace(/:/g, '') || '000000';
      const endTime = t.endzeit?.replace(/:/g, '') || '235959';

      icsLines.push(
        'BEGIN:VEVENT',
        `DTSTART:${dtStart}T${startTime}`,
        `DTEND:${dtStart}T${endTime}`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `UID:${t.id}@narrenzunft.local`,
        `SUMMARY:${t.titel || 'Termin'}`,
        t.beschreibung ? `DESCRIPTION:${t.beschreibung}` : 'DESCRIPTION:',
        t.ort ? `LOCATION:${t.ort}` : '',
        'END:VEVENT'
      );
    }

    icsLines.push('END:VCALENDAR');

    return new Response(icsLines.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="haesgruppe.ics"',
        'Cache-Control': 'max-age=3600',
      }
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});