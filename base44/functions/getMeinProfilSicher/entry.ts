/**
 * Liefert das eigene Mitgliedsprofil (inkl. Häs, Ehrungen, Teilnahmen) für den
 * eingeloggten Nutzer - läuft mit Service-Role, um RLS-Probleme zu vermeiden.
 * (Mitglieds-Datensätze wurden beim Import von einem Admin-Account erstellt,
 * daher greift die normale RLS-Regel "nur eigene created_by-Records" nicht.)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Versuch: exakte user_id-Verknüpfung
    let mitglied = null;
    const byUserId = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    if (byUserId.length > 0) { mitglied = byUserId[0]; }

    // 2. Versuch: exakte Email-Übereinstimmung
    if (!mitglied && user.email) {
      const byEmail = await base44.asServiceRole.entities.Mitglied.filter({ email: user.email });
      if (byEmail.length > 0) { mitglied = byEmail[0]; }
    }

    // 3. Versuch: case-insensitive Email (Auth-Provider → lowercase, DB → mixed case)
    if (!mitglied && user.email) {
      const all = await base44.asServiceRole.entities.Mitglied.list({ limit: 500 });
      mitglied = all.find(m => m.email && m.email.toLowerCase() === user.email.toLowerCase());
    }

    // Namens-Matching bewusst entfernt — Sicherheitsrisiko: ein Angreifer konnte sich
    // mit dem Namen eines anderen Mitglieds registrieren und deren IBAN, SEPA-Mandate
    // und Notfallkontakte einsehen. Verknüpfung nur über user_id oder verifizierte E-Mail.

    if (!mitglied) {
      return Response.json({ gefunden: false, mitglied: null, haes: [], ehrungen: [], teilnahmen: [] });
    }

    // Auto-Verknüpfung: user_id speichern falls noch nicht vorhanden
    if (!mitglied.user_id) {
      try {
        await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { user_id: user.id });
      } catch (e) { /* nicht fatal */ }
    }

    const [haes, ehrungen, teilnahmen] = await Promise.all([
      base44.asServiceRole.entities.Haes.filter({ aktueller_besitzer_id: mitglied.id }),
      base44.asServiceRole.entities.Ehrung.filter({ mitglied_id: mitglied.id }),
      base44.asServiceRole.entities.Teilnahme.filter({ mitglied_id: mitglied.id }),
    ]);

    return Response.json({
      gefunden: true,
      mitglied,
      haes: haes || [],
      ehrungen: ehrungen || [],
      teilnahmen: teilnahmen || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});