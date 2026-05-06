import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Wird aufgerufen wenn eine neue Nachricht erstellt wird.
 * Sendet eine Email an den Empfänger.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { nachricht_id } = await req.json();

    if (!nachricht_id) {
      return Response.json({ error: 'nachricht_id erforderlich' }, { status: 400 });
    }

    // Nachricht laden
    const nachricht = await base44.asServiceRole.entities.Nachricht.filter({ id: nachricht_id });
    if (!nachricht || nachricht.length === 0) {
      return Response.json({ error: 'Nachricht nicht gefunden' }, { status: 404 });
    }

    const msg = nachricht[0];

    // Absender & Empfänger laden
    const [absender, empfaenger] = await Promise.all([
      base44.asServiceRole.entities.Mitglied.filter({ id: msg.absender_mitglied_id }),
      base44.asServiceRole.entities.Mitglied.filter({ id: msg.empfaenger_mitglied_id }),
    ]);

    if (!empfaenger || empfaenger.length === 0 || !empfaenger[0].email) {
      return Response.json({ error: 'Empfänger oder Email nicht gefunden' }, { status: 400 });
    }

    const emp = empfaenger[0];
    const abs = absender?.[0];
    const absenderName = abs ? `${abs.vorname} ${abs.nachname}` : 'Unbekannt';

    // Email versenden
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: emp.email,
      subject: `Neue Nachricht: ${msg.betreff}`,
      body: `Hallo ${emp.vorname},

du hast eine neue Nachricht von ${absenderName} erhalten:

Betreff: ${msg.betreff}

---

${msg.inhalt}

---

Bitte melde dich in der App an um die vollständige Nachricht zu sehen und zu antworten.`,
    });

    return Response.json({ success: true, email_sent_to: emp.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});