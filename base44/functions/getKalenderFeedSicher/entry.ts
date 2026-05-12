import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const hashToken = async (token) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const plainToken = url.searchParams.get('token');
    const feedTyp = url.searchParams.get('type') || 'persoenlich';

    if (!plainToken) {
      return Response.json({ error: 'Token erforderlich' }, { status: 400 });
    }

    // 1. Token validieren (Hash vergleichen)
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

    // 2. Zuletzt genutzt aktualisieren
    await base44.asServiceRole.entities.KalenderFeedToken.update(token.id, {
      zuletzt_genutzt_am: new Date().toISOString(),
    });

    // 3. User/Mitglied laden
    const mitgliedResp = await base44.asServiceRole.entities.Mitglied.filter({ 
      id: token.mitglied_id 
    });
    const mitglied = mitgliedResp[0];

    // 4. Termine filtern nach Feed-Typ und Rolle
    const alleTermine = await base44.asServiceRole.entities.KalenderTermin.list('datum', 500);
    let gefilterteTermine = [];

    if (feedTyp === 'persoenlich') {
      // Nur eigene Termine + eigene Kindertermine
      if (mitglied) {
        const verwandtschaften = await base44.asServiceRole.entities.Verwandtschaft.filter({
          mitglied_id: mitglied.id
        });
        const kinderIds = verwandtschaften.map(v => v.verwandter_id);
        
        gefilterteTermine = alleTermine.filter(t => {
          if (t.sichtbarkeit === 'admin') return false;
          if (t.eingeladene_ids?.includes(mitglied.id)) return true;
          return t.eingeladene_ids?.some(id => kinderIds.includes(id));
        });
      }
    } else if (feedTyp === 'ausschuss') {
      if (token.rolle !== 'ausschuss' && token.rolle !== 'admin' && token.rolle !== 'vorstand') {
        return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      gefilterteTermine = alleTermine.filter(t => 
        ['ausschuss', 'alle'].includes(t.sichtbarkeit) && t.terminart !== 'Vorstandssitzung'
      );
    } else if (feedTyp === 'vorstand') {
      if (token.rolle !== 'admin' && token.rolle !== 'vorstand' && token.rolle !== 'stellv_vorstand') {
        return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      gefilterteTermine = alleTermine.filter(t => 
        ['vorstand', 'alle'].includes(t.sichtbarkeit)
      );
    } else if (feedTyp === 'mitglieder') {
      if (!['admin', 'vorstand', 'stellv_vorstand'].includes(token.rolle)) {
        return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      gefilterteTermine = alleTermine.filter(t => 
        !['ausschuss', 'vorstand', 'admin'].includes(t.sichtbarkeit)
      );
    }

    // 5. ICS-Format erzeugen
    const icsHeader = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Zunft Meister Hub//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Narrenzunft Kalender
X-WR-TIMEZONE:Europe/Berlin
BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:STANDARD
DTSTART:19701025T030000
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700329T020000
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
END:VTIMEZONE
`;

    const events = gefilterteTermine.map(t => {
      const startDatum = t.datum + (t.startzeit ? `T${t.startzeit}:00` : 'T00:00:00');
      const endDatum = t.datum + (t.endzeit ? `T${t.endzeit}:00` : 'T23:59:59');
      
      return `BEGIN:VEVENT
UID:${t.id}@zunft-hub.local
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART;TZID=Europe/Berlin:${startDatum.replace(/[-:]/g, '')}
DTEND;TZID=Europe/Berlin:${endDatum.replace(/[-:]/g, '')}
SUMMARY:${t.titel}
DESCRIPTION:${t.beschreibung || ''}
LOCATION:${t.ort || ''}
STATUS:CONFIRMED
END:VEVENT`;
    }).join('\n');

    const icsFooter = `END:VCALENDAR`;
    const icsContent = icsHeader + events + icsFooter;

    return new Response(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="kalender-${feedTyp}.ics"`,
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});