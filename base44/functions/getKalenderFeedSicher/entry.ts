import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const hashToken = async (token) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// RFC 5545 TEXT-Escaping: Kommas/Semikolons/Backslashes/Newlines muessen maskiert werden,
// sonst verwerfen Google/Outlook einzelne Felder oder Events.
const escapeICS = (str) => (str || '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

// YYYY-MM-DD + optional HH:MM -> ICS-UTC-Stempel
const dtStamp = () => new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

const formatICSDate = (datum, zeit) => {
  const d = (datum || '').replace(/-/g, '');
  return zeit ? `${d}T${zeit.replace(':', '')}00` : d;
};

const buildICS = (events, calName) => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Narrenzunft Frommern//Kalender-Live-Sync//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(calName)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    'X-PUBLISHED-TTL:PT12H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
  ];
  for (const t of events) {
    const isAllDay = !t.startzeit;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${t.id}@narrenzunft-frommern`);
    lines.push(`DTSTAMP:${dtStamp()}`);
    if (isAllDay) {
      const endTag = new Date((t.datum || '') + 'T00:00:00Z');
      endTag.setUTCDate(endTag.getUTCDate() + 1); // DTEND bei VALUE=DATE ist exklusiv
      lines.push(`DTSTART;VALUE=DATE:${formatICSDate(t.datum)}`);
      lines.push(`DTEND;VALUE=DATE:${formatICSDate(endTag.toISOString().slice(0, 10))}`);
    } else {
      lines.push(`DTSTART;TZID=Europe/Berlin:${formatICSDate(t.datum, t.startzeit)}`);
      lines.push(`DTEND;TZID=Europe/Berlin:${formatICSDate(t.datum, t.endzeit || t.startzeit)}`);
    }
    lines.push(`SUMMARY:${escapeICS(t.titel)}`);
    if (t.beschreibung) lines.push(`DESCRIPTION:${escapeICS(t.beschreibung)}`);
    if (t.ort) lines.push(`LOCATION:${escapeICS(t.ort)}`);
    if (t.terminart) lines.push(`CATEGORIES:${escapeICS(t.terminart)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const plainToken = url.searchParams.get('token');
    const feedTyp = url.searchParams.get('type') || 'persoenlich';

    if (!plainToken) {
      return Response.json({ error: 'Token erforderlich' }, { status: 400 });
    }

    // 1. Token validieren (Hash vergleichen) — der Token IST die Authentifizierung,
    // Kalender-Apps koennen sich nicht einloggen.
    const tokenHash = await hashToken(plainToken);
    const base44 = createClientFromRequest(req);
    const tokenResp = await base44.asServiceRole.entities.KalenderFeedToken.filter({
      token_hash: tokenHash,
      feed_typ: feedTyp,
      aktiv: true,
    });
    const token = tokenResp[0];

    if (!token) {
      return Response.json({ error: 'Invalid or revoked token' }, { status: 401 });
    }

    // 2. Zuletzt genutzt aktualisieren (fehler-tolerant)
    try {
      await base44.asServiceRole.entities.KalenderFeedToken.update(token.id, {
        zuletzt_genutzt_am: new Date().toISOString(),
      });
    } catch { /* Nutzungsspur darf den Feed nicht blockieren */ }

    // 3. Mitglied + LIVE-Rolle laden (Rolle kann sich seit Token-Erstellung geaendert haben)
    const mitgliedResp = await base44.asServiceRole.entities.Mitglied.filter({ id: token.mitglied_id });
    const mitglied = mitgliedResp[0] || null;
    const rolle = mitglied?.app_rolle || token.rolle || 'mitglied';
    const fuehrung = ['admin', 'vorstand', 'stellv_vorstand'].includes(rolle);
    const imAusschuss = fuehrung || ['ausschuss'].includes(rolle);

    // 4. Termine: alles, was das Mitglied im App-Kalender sieht
    const alleTermine = await base44.asServiceRole.entities.KalenderTermin.list('datum', 500);

    let kinderIds = [];
    if (mitglied) {
      const verwandtschaften = await base44.asServiceRole.entities.Verwandtschaft.filter({
        mitglied_id: mitglied.id,
      });
      kinderIds = verwandtschaften.map(v => v.verwandter_id);
    }

    const vor30Tagen = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const sichtbareTermine = alleTermine.filter(t => {
      if (t.datum < vor30Tagen) return false; // Vergangenheit aelterer als 30 Tage ausblenden
      const s = t.sichtbarkeit || 'alle';
      if (s === 'alle') return true;
      if (['eingeladen'].includes(s)) {
        if (!mitglied) return false;
        return (t.eingeladene_ids || []).includes(mitglied.id) ||
          (t.eingeladene_ids || []).some(id => kinderIds.includes(id));
      }
      if (s === 'verantwortliche') {
        if (!mitglied) return false;
        return (t.verantwortliche_ids || []).includes(mitglied.id);
      }
      if (s === 'haesgruppe') {
        if (!mitglied) return false;
        return (t.haesgruppe_ids || []).includes(mitglied.haesgruppe_id);
      }
      if (s === 'ausschuss') return imAusschuss;
      if (s === 'admin') return fuehrung;
      return false;
    });

    // 5. Ausfahrten (Bus & Umzuege) — im App-Kalender fuer alle sichtbar
    const alleAusfahrten = await base44.asServiceRole.entities.Ausfahrt.list('datum', 200);
    const sichtbareAusfahrten = alleAusfahrten.filter(a => {
      if (!a.datum || a.datum < vor30Tagen) return false;
      return a.status !== 'Abgesagt';
    });

    // 6. Events zusammenfuehren (Termin + Ausfahrt), Ausfahrt mit Logistik-Infos
    const events = [
      ...sichtbareTermine.map(t => ({
        id: `termin-${t.id}`,
        titel: t.titel,
        datum: t.datum,
        startzeit: t.startzeit || null,
        endzeit: t.endzeit || null,
        ort: t.ort || null,
        beschreibung: t.beschreibung || null,
        terminart: t.terminart || null,
      })),
      ...sichtbareAusfahrten.map(a => {
        const details = [];
        if (a.typ) details.push(a.typ);
        if (a.abfahrt_zeit && a.abfahrt_ort) details.push(`Abfahrt ${a.abfahrt_zeit} · ${a.abfahrt_ort}`);
        else if (a.abfahrt_zeit) details.push(`Abfahrt ${a.abfahrt_zeit}`);
        if (a.rueckfahrt_zeit) details.push(`Rückfahrt ca. ${a.rueckfahrt_zeit}`);
        return {
          id: `ausfahrt-${a.id}`,
          titel: `🚌 ${a.titel}`,
          datum: a.datum,
          startzeit: a.abfahrt_zeit || a.veranstaltungsbeginn || null,
          endzeit: a.rueckfahrt_zeit || null,
          ort: a.ort || null,
          beschreibung: details.join(' · ') || a.notizen || null,
          terminart: 'Ausfahrt',
        };
      }),
    ].sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));

    const ics = buildICS(events, 'Narrenzunft Frommern – Termine');

    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
