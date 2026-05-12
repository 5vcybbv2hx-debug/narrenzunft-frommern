import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Rollenbasierte Sichtbarkeitsregeln
const ROLLE_SICHTBARKEIT = {
  mitglied:       ['alle'],
  elternkonto:    ['alle'],
  spartenleiter:  ['alle', 'verantwortliche'],
  kassierer:      ['alle', 'verantwortliche'],
  stellv_vorstand:['alle', 'verantwortliche', 'ausschuss', 'admin'],
  vorstand:       ['alle', 'verantwortliche', 'ausschuss', 'admin'],
  admin:          ['alle', 'verantwortliche', 'ausschuss', 'admin', 'eingeladen', 'haesgruppe'],
};

// Feed-Typ → erlaubte Sichtbarkeiten + Terminarten
const FEED_CONFIG = {
  mitglieder:     { sichtbarkeiten: ['alle'], terminarten: null },
  ausschuss:      { sichtbarkeiten: ['alle', 'ausschuss'], terminarten: ['Ausschusssitzung', 'Intern', 'Vorstandssitzung'] },
  vorstand:       { sichtbarkeiten: ['alle', 'ausschuss', 'admin'], terminarten: null },
  verantwortliche:{ sichtbarkeiten: ['alle', 'verantwortliche'], terminarten: null },
  gruppe:         { sichtbarkeiten: ['alle', 'haesgruppe'], terminarten: ['Gruppen-Termin', 'Jugendtermin'] },
};

function formatICSDate(datum, zeit) {
  const d = datum.replace(/-/g, '');
  if (!zeit) return `${d}`;
  const t = zeit.replace(':', '') + '00';
  return `${d}T${t}`;
}

function escapeICS(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function buildICS(termine, calName) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NarrenzunftHub//Kalender//DE',
    `X-WR-CALNAME:${escapeICS(calName)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const t of termine) {
    const uid = `${t.id}@narrenzunft`;
    const dtstart = formatICSDate(t.datum, t.startzeit);
    const dtend = t.endzeit
      ? formatICSDate(t.datum, t.endzeit)
      : formatICSDate(t.datum, t.startzeit || '23:59');

    const isAllDay = !t.startzeit;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    if (isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
      lines.push(`DTEND;VALUE=DATE:${dtend}`);
    } else {
      lines.push(`DTSTART:${dtstart}`);
      lines.push(`DTEND:${dtend}`);
    }
    lines.push(`SUMMARY:${escapeICS(t.titel)}`);
    if (t.beschreibung) lines.push(`DESCRIPTION:${escapeICS(t.beschreibung)}`);
    if (t.ort) lines.push(`LOCATION:${escapeICS(t.ort)}`);
    lines.push(`CATEGORIES:${escapeICS(t.terminart)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { feed_typ } = body;
    // SICHERHEIT: mitglied_id darf NICHT vom Frontend übergeben werden – immer über Auth ermitteln

    if (!feed_typ || !FEED_CONFIG[feed_typ]) {
      return Response.json({ error: 'Ungültiger Feed-Typ' }, { status: 400 });
    }

    // Auth prüfen
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const userRolle = user.role || 'mitglied';
    const erlaubteSichtbarkeiten = ROLLE_SICHTBARKEIT[userRolle] || ['alle'];
    const feedConfig = FEED_CONFIG[feed_typ];

    // Sicherheits-Check: Hat der User Zugriff auf diesen Feed?
    const hatFeedZugriff = feedConfig.sichtbarkeiten.some(s => erlaubteSichtbarkeiten.includes(s));
    if (!hatFeedZugriff) {
      return Response.json({ error: 'Keine Berechtigung für diesen Feed' }, { status: 403 });
    }

    // Alle Termine laden
    const alleTermine = await base44.asServiceRole.entities.KalenderTermin.list('datum', 500);

    // Mitglied serverseitig über User-E-Mail ermitteln (nie aus Request-Body)
    let myMitglied = null;
    const mitglieder = await base44.asServiceRole.entities.Mitglied.filter({ email: user.email });
    myMitglied = mitglieder[0] || null;

    // Filtern: Sichtbarkeit + Terminart + Rollencheck
    const gefilterteTermine = alleTermine.filter(t => {
      // Terminart-Filter des Feeds
      if (feedConfig.terminarten && !feedConfig.terminarten.includes(t.terminart)) return false;

      const s = t.sichtbarkeit || 'alle';

      // Sicherheitsregel: Nicht-Admins dürfen Ausschuss/Vorstandstermine NICHT sehen
      if (['ausschuss', 'admin'].includes(s) && !['vorstand', 'stellv_vorstand', 'ausschuss', 'admin'].includes(userRolle)) {
        return false;
      }

      // Sichtbarkeit prüfen
      if (!erlaubteSichtbarkeiten.includes(s)) return false;

      // Eingeladene: nur wenn Mitglied in Liste
      if (s === 'eingeladen') {
        if (!myMitglied) return false;
        return (t.eingeladene_ids || []).includes(myMitglied.id);
      }

      // Verantwortliche: nur wenn Mitglied verantwortlich
      if (s === 'verantwortliche') {
        if (!myMitglied) return false;
        return (t.verantwortliche_ids || []).includes(myMitglied.id);
      }

      return true;
    });

    const calName = {
      mitglieder: 'Narrenzunft – Mitgliederkalender',
      ausschuss: 'Narrenzunft – Ausschusskalender',
      vorstand: 'Narrenzunft – Vorstandskalender',
      verantwortliche: 'Narrenzunft – Verantwortlichenkalender',
      gruppe: 'Narrenzunft – Gruppenkalender',
    }[feed_typ];

    const ics = buildICS(gefilterteTermine, calName);

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${feed_typ}-kalender.ics"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});