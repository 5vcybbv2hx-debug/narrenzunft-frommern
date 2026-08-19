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

    if (!mitglied && user.full_name) {
      const parts = user.full_name.trim().split(/\s+/);
      if (parts.length >= 2) {
        const byName = await base44.asServiceRole.entities.Mitglied.filter({ vorname: parts[0], nachname: parts[parts.length - 1] });
        if (byName.length === 1) { mitglied = byName[0]; matchStrategy = 'name'; }
      }
    }

    if (!mitglied) return Response.json({ linked: false, message: 'Kein passendes Mitglied gefunden', user_email: user.email, user_name: user.full_name });

    const updates = [];

    if (!mitglied.user_id) {
      await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { user_id: user.id });
      updates.push('user_id');
    } else if (mitglied.user_id !== user.id && matchStrategy !== 'user_id') {
      await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { user_id: user.id });
      updates.push('user_id (überschrieben)');
    }

    if (user.email && mitglied.email !== user.email && matchStrategy !== 'email') {
      if (!mitglied.email || mitglied.email === '') {
        await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { email: user.email });
        updates.push('email');
      }
    }

    // 3. Rolle vom Mitglied-Datensatz übertragen (nur wenn Admin die app_rolle gesetzt hat)
    // Nicht-fatal: App-Owner können ihre Rolle nicht per API ändern lassen (Systemschutz) -
    // das darf die restliche Verknüpfung nicht crashen lassen.
    const gewuenschteRolle = mitglied.app_rolle;
    if (gewuenschteRolle && gewuenschteRolle !== user.role) {
      const erlaubteRollen = ['mitglied', 'spartenleiter', 'kassierer', 'stellv_vorstand', 'vorstand'];
      if (erlaubteRollen.includes(gewuenschteRolle)) {
        try {
          await base44.asServiceRole.entities.User.update(user.id, { role: gewuenschteRolle });
          updates.push('role → ' + gewuenschteRolle);
        } catch (roleError) {
          // z.B. "You cannot update the role of the owner of the app" - ignorieren, Verknüpfung geht trotzdem durch
          updates.push('role-update fehlgeschlagen (' + roleError.message + ')');
        }
      }
    }

    return Response.json({ linked: true, mitglied_id: mitglied.id, match_strategy: matchStrategy, updates, app_rolle: mitglied.app_rolle, zusatz_berechtigungen: mitglied.zusatz_berechtigungen || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});