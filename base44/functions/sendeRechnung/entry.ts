import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

/**
 * Verschickt eine bereits erzeugte Rechnungs-PDF (Upload-URL) per E-Mail
 * an den Rechnungsempfänger. Nur Verwaltung (admin/vorstand/stellv_vorstand).
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'vorstand', 'stellv_vorstand'].includes(user.role)) {
      return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { email, name, rechnungsnummer, pdf_url, pdf_uri, betrag, gegenstand, von, bis } = body;
    if (!email) return Response.json({ error: 'Keine Empfängeradresse' }, { status: 400 });
    if (!pdf_url && !pdf_uri) return Response.json({ error: 'Keine PDF-Datei übergeben' }, { status: 400 });

    // PDF liegt privat (Rechnungen enthalten Anschriften) – Link nur befristet gültig
    let pdfLink = pdf_url || '';
    if (pdf_uri) {
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri: pdf_uri,
        expires_in: 60 * 60 * 24 * 30,
      });
      pdfLink = signed_url;
    }

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const eur = (v) => Number(v || 0).toFixed(2).replace('.', ',') + ' €';
    const datumDe = (iso) => {
      const m = String(iso || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
    };

    const html = `
      <div style="background:#0a0a0a;padding:24px;font-family:Arial,sans-serif;">
        <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
          <div style="background:#EA2525;padding:16px 24px;">
            <p style="color:#fff;font-weight:700;margin:0;letter-spacing:2px;text-transform:uppercase;font-size:14px;">Rechnung ${esc(rechnungsnummer || '')}</p>
          </div>
          <div style="padding:24px;">
            <p style="color:#e2e8f0;font-size:15px;margin:0 0 16px;">Hallo ${esc(name || 'zusammen')},<br>
              anbei unsere Rechnung für <strong style="color:#EA2525;">${esc(gegenstand || 'den Ausleihgegenstand')}</strong>.</p>
            <table style="width:100%;color:#94a3b8;font-size:13px;border-collapse:collapse;">
              ${von || bis ? `<tr><td style="padding:6px 0;color:#6b7280;">Zeitraum</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;">${esc(datumDe(von))} bis ${esc(datumDe(bis))}</td></tr>` : ''}
              <tr><td style="padding:6px 0;color:#6b7280;">Betrag</td><td style="padding:6px 0;color:#e2e8f0;text-align:right;"><strong style="color:#EA2525;">${eur(betrag)}</strong></td></tr>
            </table>
            <p style="margin:20px 0 0;">
              <a href="${esc(pdfLink)}" style="display:inline-block;background:#EA2525;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">Rechnung als PDF öffnen</a>
            </p>
            <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;padding-top:16px;border-top:1px solid #2a2a2a;">
              Bei Fragen einfach auf diese Mail antworten.<br>Eure Narrenzunft Frommern 🎭
            </p>
          </div>
        </div>
      </div>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: `Rechnung ${rechnungsnummer || ''} – Narrenzunft Frommern`.trim(),
      body: html,
      from_name: 'Narrenzunft Frommern',
    });

    return Response.json({ ok: true, gesendet_an: email });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}