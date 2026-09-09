import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

/**
 * Öffentliche Verleih-Anfrage (aufgerufen von der QR-Seite /verleih/:id — KEINE Authentifizierung).
 * Legt eine VerleihAnfrage an, benachrichtigt den Zuständigen + Vorstand in der App und per E-Mail.
 * Validiert alle Eingaben serverseitig; Honeypot-Feld wehrt Spam-Bots ab.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { id, website, name, telefon, email, von_datum, bis_datum, zweck } = body;

    // Honeypot: nur Bots füllen das unsichtbare Feld — still erfolgsreich antworten
    if (website && String(website).trim()) {
      return Response.json({ ok: true });
    }

    // Validierung
    if (!id || !String(name || '').trim() || !String(telefon || '').trim() || !von_datum || !bis_datum) {
      return Response.json({ error: 'Bitte alle Pflichtfelder ausfüllen.' }, { status: 400 });
    }
    const n = String(name).trim().slice(0, 80);
    const tel = String(telefon).trim().slice(0, 40);
    const em = String(email || '').trim().slice(0, 120);
    const daten = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!daten(von_datum) || !daten(bis_datum)) {
      return Response.json({ error: 'Ungültiges Datum.' }, { status: 400 });
    }
    if (von_datum > bis_datum) {
      return Response.json({ error: 'Das Rückgabedatum liegt vor dem Abholdatum.' }, { status: 400 });
    }
    if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
      return Response.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 });
    }

    // Gegenstand prüfen (muss öffentlich verleihbar sein)
    const treffer = await base44.asServiceRole.entities.Ausruestung.filter({ id });
    const a = treffer?.[0];
    if (!a || a.aktiv === false || !a.verleihbar) {
      return Response.json({ error: 'Dieser Gegenstand ist nicht für den Verleih freigegeben.' }, { status: 404 });
    }

    // Anfrage speichern
    const anfrage = await base44.asServiceRole.entities.VerleihAnfrage.create({
      ausruestung_id: a.id,
      ausruestung_name: a.name || 'Gegenstand',
      name: n,
      telefon: tel,
      email: em,
      von_datum,
      bis_datum,
      zweck: String(zweck || '').trim().slice(0, 400),
      status: 'Offen',
    });

    // Empfänger bestimmen: Zuständiger + Vorstand (app_rolle vorstand/stellv_vorstand/admin)
    const empfaenger = [];
    const gesehen = new Set();
    if (a.verleih_verantwortlicher_id) {
      const z = await base44.asServiceRole.entities.Mitglied.filter({ id: a.verleih_verantwortlicher_id });
      const zm = z?.[0];
      if (zm) { empfaenger.push(zm); gesehen.add(zm.id); }
    }
    const alleM = await base44.asServiceRole.entities.Mitglied.list('nachname', 1000);
    for (const m of alleM) {
      if (gesehen.has(m.id)) continue;
      if (['vorstand', 'stellv_vorstand', 'admin'].includes(m.app_rolle)) {
        empfaenger.push(m); gesehen.add(m.id);
      }
    }

    const zusammenfassung = `${n} möchte „${a.name}" vom ${von_datum} bis ${bis_datum} ausleihen.`;

    // In-App-Benachrichtigungen
    for (const m of empfaenger) {
      try {
        await base44.asServiceRole.entities.Benachrichtigung.create({
          mitglied_id: m.id,
          titel: 'Neue Verleih-Anfrage',
          nachricht: `${zusammenfassung}${anfrage.zweck ? ` Zweck: ${anfrage.zweck}` : ''}`,
          typ: 'Info',
          link: '/inventar',
        });
      } catch (e) {
        console.error('Benachrichtigung fehlgeschlagen:', e?.message);
      }
    }

    // E-Mail-Weiterleitung an Vorstand & Zuständige
    const emailHtml = `
      <div style="background:#0a0a0a;padding:24px;font-family:Arial,sans-serif;">
        <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
          <div style="background:#EA2525;padding:16px 24px;">
            <p style="color:#ffffff;font-weight:700;margin:0;letter-spacing:2px;text-transform:uppercase;font-size:14px;">🎭 Neue Verleih-Anfrage</p>
          </div>
          <div style="padding:24px;">
            <p style="color:#e2e8f0;font-size:15px;margin:0 0 16px;">${zusammenfassung}</p>
            <table style="width:100%;color:#94a3b8;font-size:13px;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#6b7280;">Gegenstand</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${a.name}</td></tr>
              ${a.verleih_preis > 0 ? `<tr><td style="padding:6px 0;color:#6b7280;">Miete pro Tag</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${Number(a.verleih_preis).toFixed(2).replace('.', ',')} €</td></tr>` : ''}
              ${a.verleih_kaution > 0 ? `<tr><td style="padding:6px 0;color:#6b7280;">Kaution</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${Number(a.verleih_kaution).toFixed(2).replace('.', ',')} €</td></tr>` : ''}
              <tr><td style="padding:6px 0;color:#6b7280;">Zeitraum</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${von_datum} → ${bis_datum}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Anfrage von</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${n}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Telefon</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${tel}</td></tr>
              ${em ? `<tr><td style="padding:6px 0;color:#6b7280;">E-Mail</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${em}</td></tr>` : ''}
              ${anfrage.zweck ? `<tr><td style="padding:6px 0;color:#6b7280;">Zweck</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${anfrage.zweck}</td></tr>` : ''}
            </table>
            <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;padding-top:16px;border-top:1px solid #2a2a2a;">
              Anfrage in der App unter <span style="color:#EA2525;font-weight:600;">Inventar &amp; Verleih → Anfragen</span> genehmigen oder ablehnen.
            </p>
          </div>
        </div>
      </div>`;
    let mailsGesendet = 0;
    for (const m of empfaenger) {
      if (!m.email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: m.email,
          from_name: 'Narrenzunft',
          subject: `Neue Verleih-Anfrage: ${a.name} (${von_datum} – ${bis_datum})`,
          body: emailHtml,
        });
        mailsGesendet++;
      } catch (e) {
        console.error('E-Mail fehlgeschlagen für', m.email, ':', e?.message);
      }
    }

    return Response.json({ ok: true, anfrage_id: anfrage.id, benachrichtigt: empfaenger.length, mails: mailsGesendet });
  } catch (e) {
    console.error('stelleVerleihAnfrage Fehler:', e?.message);
    return Response.json({ error: 'Anfrage konnte nicht gesendet werden.' }, { status: 500 });
  }
});
