import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { veranstaltung_id } = await req.json();
  if (!veranstaltung_id) return Response.json({ error: 'veranstaltung_id fehlt' }, { status: 400 });

  // Veranstaltung laden
  const vArr = await base44.asServiceRole.entities.Veranstaltung.filter({ id: veranstaltung_id });
  const v = vArr[0];
  if (!v) return Response.json({ error: 'Veranstaltung nicht gefunden' }, { status: 404 });

  // Alle angemeldeten Teilnahmen laden
  const teilnahmen = await base44.asServiceRole.entities.Teilnahme.filter({ veranstaltung_id });
  const aktiveTeilnahmen = teilnahmen.filter(t => t.status !== 'Abgesagt');

  if (aktiveTeilnahmen.length === 0) {
    return Response.json({ sent: 0, message: 'Keine angemeldeten Teilnehmer' });
  }

  // Mitglieder-IDs sammeln & laden
  const mitgliedIds = [...new Set(aktiveTeilnahmen.map(t => t.mitglied_id))];
  const alleMitglieder = await base44.asServiceRole.entities.Mitglied.list('nachname', 1000);
  const mitglieder = alleMitglieder.filter(m => mitgliedIds.includes(m.id) && m.email);

  // E-Mail aufbauen
  const typEmoji = { Umzug: '🎪', Abendveranstaltung: '🎭', Fest: '🎉', Intern: '📋', Arbeitsdienst: '🔧' };
  const emoji = typEmoji[v.typ] || '📅';
  const datumFormatiert = v.datum ? new Date(v.datum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';

  const mapsLink = (adresse) => adresse
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`
    : null;

  // Typ-spezifische Sektionen
  let detailsHtml = '';

  if (v.typ === 'Umzug') {
    if (v.busparkplatz_adresse || v.busparkplatz_treffzeit) {
      detailsHtml += `
        <div style="background:#1a2744;border-left:4px solid #f97316;padding:12px 16px;border-radius:8px;margin-bottom:12px;">
          <p style="font-weight:700;color:#f97316;margin:0 0 6px;">🅿️ Busparkplatz</p>
          ${v.busparkplatz_treffzeit ? `<p style="margin:0 0 4px;color:#e2e8f0;"><strong>Treffzeit:</strong> ${v.busparkplatz_treffzeit} Uhr</p>` : ''}
          ${v.busparkplatz_adresse ? `<p style="margin:0 0 4px;color:#e2e8f0;"><strong>Adresse:</strong> ${v.busparkplatz_adresse}</p>` : ''}
          ${mapsLink(v.busparkplatz_adresse) ? `<a href="${mapsLink(v.busparkplatz_adresse)}" style="color:#60a5fa;font-size:13px;">📍 Navigation öffnen</a>` : ''}
        </div>`;
    }
    if (v.umzugsaufstellung_ort || v.umzugsaufstellung_zeit) {
      detailsHtml += `
        <div style="background:#1a2744;border-left:4px solid #60a5fa;padding:12px 16px;border-radius:8px;margin-bottom:12px;">
          <p style="font-weight:700;color:#60a5fa;margin:0 0 6px;">📋 Umzugsaufstellung</p>
          ${v.umzugsaufstellung_zeit ? `<p style="margin:0 0 4px;color:#e2e8f0;"><strong>Zeit:</strong> ${v.umzugsaufstellung_zeit} Uhr</p>` : ''}
          ${v.umzugsaufstellung_ort ? `<p style="margin:0 0 4px;color:#e2e8f0;"><strong>Ort:</strong> ${v.umzugsaufstellung_ort}</p>` : ''}
          ${mapsLink(v.umzugsaufstellung_ort) ? `<a href="${mapsLink(v.umzugsaufstellung_ort)}" style="color:#60a5fa;font-size:13px;">📍 Navigation öffnen</a>` : ''}
        </div>`;
    }
    if (v.festakt_ort || v.festakt_adresse) {
      detailsHtml += `
        <div style="background:#1a2744;border-left:4px solid #a78bfa;padding:12px 16px;border-radius:8px;margin-bottom:12px;">
          <p style="font-weight:700;color:#a78bfa;margin:0 0 6px;">🎉 Festakt / Abschluss</p>
          ${v.festakt_zeit ? `<p style="margin:0 0 4px;color:#e2e8f0;"><strong>Beginn:</strong> ${v.festakt_zeit} Uhr</p>` : ''}
          ${v.festakt_ort ? `<p style="margin:0 0 4px;color:#e2e8f0;"><strong>Ort:</strong> ${v.festakt_ort}</p>` : ''}
          ${v.festakt_adresse ? `<p style="margin:0 0 4px;color:#e2e8f0;"><strong>Adresse:</strong> ${v.festakt_adresse}</p>` : ''}
          ${mapsLink(v.festakt_adresse || v.festakt_ort) ? `<a href="${mapsLink(v.festakt_adresse || v.festakt_ort)}" style="color:#60a5fa;font-size:13px;">📍 Navigation öffnen</a>` : ''}
        </div>`;
    }
  }

  if (['Abendveranstaltung', 'Fest', 'Intern'].includes(v.typ)) {
    if (v.veranstaltungsort_adresse) {
      detailsHtml += `
        <div style="background:#1a2744;border-left:4px solid #34d399;padding:12px 16px;border-radius:8px;margin-bottom:12px;">
          <p style="font-weight:700;color:#34d399;margin:0 0 6px;">📍 Veranstaltungsort</p>
          ${v.ort ? `<p style="margin:0 0 4px;color:#e2e8f0;"><strong>${v.ort}</strong></p>` : ''}
          <p style="margin:0 0 4px;color:#e2e8f0;">${v.veranstaltungsort_adresse}</p>
          <a href="${mapsLink(v.veranstaltungsort_adresse)}" style="color:#60a5fa;font-size:13px;">📍 Navigation öffnen</a>
        </div>`;
    }
    if (v.einlass_zeit || v.beginn_zeit) {
      detailsHtml += `
        <div style="background:#1a2744;border-left:4px solid #fbbf24;padding:12px 16px;border-radius:8px;margin-bottom:12px;">
          <p style="font-weight:700;color:#fbbf24;margin:0 0 6px;">🕐 Zeiten</p>
          ${v.einlass_zeit ? `<p style="margin:0 0 4px;color:#e2e8f0;"><strong>Einlass:</strong> ${v.einlass_zeit} Uhr</p>` : ''}
          ${v.beginn_zeit ? `<p style="margin:0 0 4px;color:#e2e8f0;"><strong>Beginn:</strong> ${v.beginn_zeit} Uhr</p>` : ''}
        </div>`;
    }
    if (v.programmablauf) {
      detailsHtml += `
        <div style="background:#1a2744;border-left:4px solid #60a5fa;padding:12px 16px;border-radius:8px;margin-bottom:12px;">
          <p style="font-weight:700;color:#60a5fa;margin:0 0 6px;">📋 Programmablauf</p>
          <p style="color:#e2e8f0;white-space:pre-line;margin:0;">${v.programmablauf}</p>
        </div>`;
    }
    if (v.dresscode) {
      detailsHtml += `
        <div style="background:#1a2744;border-left:4px solid #f472b6;padding:12px 16px;border-radius:8px;margin-bottom:12px;">
          <p style="font-weight:700;color:#f472b6;margin:0 0 6px;">👗 Dresscode / Kleidung</p>
          <p style="color:#e2e8f0;margin:0;">${v.dresscode}</p>
        </div>`;
    }
  }

  if (v.hinweise) {
    detailsHtml += `
      <div style="background:#1a2744;border-left:4px solid #94a3b8;padding:12px 16px;border-radius:8px;margin-bottom:12px;">
        <p style="font-weight:700;color:#94a3b8;margin:0 0 6px;">📝 Allgemeine Hinweise</p>
        <p style="color:#e2e8f0;white-space:pre-line;margin:0;">${v.hinweise}</p>
      </div>`;
  }

  if (v.kontakt_vor_ort) {
    detailsHtml += `
      <div style="background:#1a2744;border-left:4px solid #34d399;padding:12px 16px;border-radius:8px;margin-bottom:12px;">
        <p style="font-weight:700;color:#34d399;margin:0 0 6px;">📞 Ansprechpartner vor Ort</p>
        <p style="color:#e2e8f0;margin:0;">${v.kontakt_vor_ort}</p>
      </div>`;
  }

  const subject = `${emoji} Infobrief: ${v.titel} – ${datumFormatiert}`;

  const bodyHtml = `
    <div style="font-family:Arial,sans-serif;background:#111827;color:#e2e8f0;padding:24px;border-radius:12px;max-width:600px;">
      <div style="text-align:center;margin-bottom:24px;">
        <p style="font-size:32px;margin:0;">${emoji}</p>
        <h1 style="color:#f97316;margin:8px 0 4px;">${v.titel}</h1>
        <p style="color:#94a3b8;margin:0;">${v.typ} · ${datumFormatiert}${v.uhrzeit ? ' · ' + v.uhrzeit + ' Uhr' : ''}</p>
        ${v.ort ? `<p style="color:#94a3b8;margin:4px 0 0;">📍 ${v.ort}</p>` : ''}
      </div>

      ${detailsHtml || '<p style="color:#94a3b8;text-align:center;">Weitere Details folgen.</p>'}

      <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #374151;">
        <p style="color:#6b7280;font-size:12px;margin:0;">Narrenzunft Verwaltung · Automatisch generierter Infobrief</p>
      </div>
    </div>`;

  // E-Mails versenden
  let sent = 0;
  const errors = [];
  for (const m of mitglieder) {
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: m.email,
        from_name: 'Narrenzunft',
        subject,
        body: bodyHtml,
      });
      sent++;
    } catch (e) {
      errors.push(m.email);
    }
  }

  return Response.json({
    sent,
    total: mitglieder.length,
    errors,
    message: `${sent} von ${mitglieder.length} E-Mails erfolgreich versendet`,
  });
});