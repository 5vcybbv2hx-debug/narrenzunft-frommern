import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let mitglied = null;
    let matchStrategy = null;

    if (user.id) {
      const byUserId = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
      if (byUserId.length > 0) { mitglied = byUserId[0]; matchStrategy = 'user_id'; }
    }

    if (!mitglied && user.email) {
      const byEmail = await base44.asServiceRole.entities.Mitglied.filter({ email: user.email });
      if (byEmail.length > 0) { mitglied = byEmail[0]; matchStrategy = 'email'; }
      // Case-insensitive Fallback: Auth-Provider geben Emails oft lowercase zurück,
      // aber in der DB können sie mit Großbuchstaben gespeichert sein (z.B. NZFrommern@gmx.de)
      if (!mitglied) {
        const allByEmailDomain = await base44.asServiceRole.entities.Mitglied.list({ limit: 500 });
        const ciMatch = allByEmailDomain.find(m => m.email && m.email.toLowerCase() === user.email.toLowerCase());
        if (ciMatch) { mitglied = ciMatch; matchStrategy = 'email_ci'; }
      }
    }

    // Namens-Matching bewusst entfernt — Sicherheitsrisiko: ein Angreifer konnte sich
    // mit dem Namen eines Vorstands-Mitglieds registrieren und dessen Rolle übernehmen.
    // Verknüpfung ausschließlich über user_id oder verifizierte E-Mail-Adresse.

    if (!mitglied) return Response.json({ linked: false, message: 'Kein passendes Mitglied gefunden', user_email: user.email, user_name: user.full_name });

    const updates = [];

    if (!mitglied.user_id) {
      await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { user_id: user.id });
      updates.push('user_id');
    }
    // Bewusst KEINE Überschreibung bestehender user_id-Verknüpfungen mehr —
    // selbst bei Email-Match könnte ein Edge-Case zur Konto-Übernahme führen.
    // Ein Admin kann veraltete Verknüpfungen manuell korrigieren.

    if (user.email && mitglied.email !== user.email && matchStrategy !== 'email') {
      if (!mitglied.email || mitglied.email === '') {
        await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { email: user.email });
        updates.push('email');
      }
    }

    // Rolle wird NICHT mehr automatisch aus app_rolle übertragen — das Feld app_rolle auf
    // der Mitglied-Entität ist vom Benutzer selbst beschreibbar (RLS: data.user_id == user.id),
    // was eine Rechteausweitung ermöglichen würde. Rollen müssen von einem Admin manuell
    // über die Berechtigungen-Seite zugewiesen werden. app_rolle dient nur als Vorschlag.
    if (mitglied.app_rolle && mitglied.app_rolle !== user.role) {
      updates.push('role-pending (Admin-Zuweisung erforderlich: ' + mitglied.app_rolle + ')');
    }

    return Response.json({ linked: true, mitglied_id: mitglied.id, match_strategy: matchStrategy, updates, app_rolle: mitglied.app_rolle, zusatz_berechtigungen: mitglied.zusatz_berechtigungen || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});