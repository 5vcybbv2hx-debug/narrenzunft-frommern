import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

/**
 * Sendet eine Buchungs-Bestätigungsmail für eine Ausleihe (Verleih).
 * Wird aufgerufen: 1) beim Genehmigen einer externen Verleih-Anfrage,
 * 2) beim Buchen einer internen Ausleihe (Mitglied / interner Gebrauch).
 * Nur für angemeldete Nutzer; Preise: Mitglieder-Preis (verleih_preis_mitglied,
 * Fallback verleih_preis) bzw. externer Preis (verleih_preis).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Nicht angemeldet.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ausleihe_id, email_override, notiz } = body;
    if (!ausleihe_id) return Response.json({ error: 'ausleihe_id fehlt.' }, { status: 400 });

    // Ausleihe + Gegenstand laden
    const alArr = await base44.asServiceRole.entities.Ausleihe.filter({ id: ausleihe_id });
    const al = alArr?.[0];
    if (!al) return Response.json({ error: 'Ausleihe nicht gefunden.' }, { status: 404 });
    const aArr = await base44.asServiceRole.entities.Ausruestung.filter({ id: al.ausruestung_id });
    const a = aArr?.[0];

    // Empfänger bestimmen: explizite E-Mail (z.B. aus Verleih-Anfrage) > Mitglied > ExternePerson
    let empfaengerEmail = String(email_override || '').trim();
    let empfaengerName = '';
    if (!empfaengerEmail) {
      if (al.ausleiher_typ === 'extern' && al.ausleiher_extern_id) {
        const epArr = await base44.asServiceRole.entities.ExternePerson.filter({ id: al.ausleiher_extern_id });
        const ep = epArr?.[0];
        empfaengerEmail = String(ep?.email || '').trim();
        empfaengerName = ep?.name || '';
      } else if (al.ausleiher_mitglied_id) {
        const mArr = await base44.asServiceRole.entities.Mitglied.filter({ id: al.ausleiher_mitglied_id });
        const m = mArr?.[0];
        empfaengerEmail = String(m?.email || '').trim();
        empfaengerName = m ? `${m.vorname || ''} ${m.nachname || ''}`.trim() : '';
      }
    }
    if (!empfaengerEmail) {
      return Response.json({ ok: true, sent: 0, grund: 'Keine E-Mail-Adresse des Empfängers vorhanden.' });
    }

    // Preis: Mitglied oder Extern; Tagespreis inkl. Rückgabetag
    const istMitglied = al.ausleiher_typ !== 'extern';
    const preisProTag = istMitglied
      ? Number(a?.verleih_preis_mitglied ?? a?.verleih_preis ?? 0)
      : Number(a?.verleih_preis ?? 0);
    const kaution = Number(a?.verleih_kaution ?? 0);
    const tage = al.von_datum && al.bis_datum
      ? Math.max(1, Math.round((new Date(al.bis_datum) - new Date(al.von_datum)) / 86400000) + 1)
      : 1;
    const gesamt = preisProTag * tage;

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const eur = (v) => Number(v || 0).toFixed(2).replace('.', ',') + ' €';

    const emailHtml = `
      <div style="background:#0a0a0a;padding:24px;font-family:Arial,sans-serif;">
        <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
          <div style="background:#EA2525;padding:16px 24px;">
            <p style="color:#ffffff;font-weight:700;margin:0;letter-spacing:2px;text-transform:uppercase;font-size:14px;">🎭 Ausleihe bestätigt</p>
          </div>
          <div style="padding:24px;">
            <p style="color:#e2e8f0;font-size:15px;margin:0 0 16px;">
              Hallo ${esc(empfaengerName || 'und hallo')},<br>
              eure Ausleihe von <strong style="color:#EA2525;">${esc(a?.name || 'Gegenstand')}</strong> ist bestätigt und gebucht. 🎉
            </p>
            <table style="width:100%;color:#94a3b8;font-size:13px;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#6b7280;">Zeitraum</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${esc(al.von_datum)} → ${esc(al.bis_datum)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Mietpreis</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${eur(preisProTag)} / Tag · ${tage} Tag${tage > 1 ? 'e' : ''} = <strong style="color:#EA2525;">${eur(gesamt)}</strong></td></tr>
              ${kaution > 0 ? `<tr><td style="padding:6px 0;color:#6b7280;">Kaution</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${eur(kaution)}</td></tr>` : ''}
              ${al.zweck ? `<tr><td style="padding:6px 0;color:#6b7280;">Zweck</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${esc(al.zweck)}</td></tr>` : ''}
              ${notiz ? `<tr><td style="padding:6px 0;color:#6b7280;">Notiz</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${esc(notiz)}</td></tr>` : ''}
            </table>
            <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;padding-top:16px;border-top:1px solid #2a2a2a;">
              Bei Fragen zur Abholung und Rückgabe meldet euch einfach bei uns.<br>
              Eure Narrenzunft Frommern 🎭
            </p>
          </div>
        </div>
      </div>`;

    let sent = 0;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: empfaengerEmail,
        from_name: 'Narrenzunft Frommern',
        subject: `Ausleihe bestätigt: ${a?.name || 'Gegenstand'} (${al.von_datum} – ${al.bis_datum})`,
        body: emailHtml,
      });
      sent = 1;
    } catch (e) {
      console.error('Bestätigungsmail fehlgeschlagen:', e?.message);
      return Response.json({ ok: true, sent: 0, fehler: 'Mailversand fehlgeschlagen.' });
    }

    return Response.json({ ok: true, sent: 1 });
  } catch (e) {
    console.error('sendeVerleihBestaetigung Fehler:', e?.message);
    return Response.json({ error: 'Bestätigung konnte nicht gesendet werden.' }, { status: 500 });
  }
});
