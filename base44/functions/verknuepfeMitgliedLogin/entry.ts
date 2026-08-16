/**
 * Wird beim Login aufgerufen um:
 * 1. Den eingeloggten User mit dem Mitglied-Datensatz zu verknüpfen
 * 2. Die app_rolle vom Mitglied-Datensatz auf den User zu übertragen
 *
 * Match-Strategie (in dieser Reihenfolge):
 * a) user_id — bereits verknüpft (Email kann sich geändert haben, z.B. Apple Sign-In)
 * b) email — klassischer Match
 * c) Name + Geburtsdatum — Fallback für Apple Relay-Emails etc.
 *
 * SICHERHEIT: Läuft serverseitig mit Service-Role.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authentifizierten User ermitteln
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // a) Versuche Match via user_id (bereits verknüpft)
    let mitglied = null;
    let matchStrategy = null;

    if (user.id) {
      const byUserId = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
      if (byUserId.length > 0) {
        mitglied = byUserId[0];
        matchStrategy = 'user_id';
      }
    }

    // b) Versuche Match via Email
    if (!mitglied && user.email) {
      const byEmail = await base44.asServiceRole.entities.Mitglied.filter({ email: user.email });
      if (byEmail.length > 0) {
        mitglied = byEmail[0];
        matchStrategy = 'email';
      }
    }

    // c) Fallback: Match via Name (vorname + nachname aus user.full_name)
    if (!mitglied && user.full_name) {
      const parts = user.full_name.trim().split(/\s+/);
      if (parts.length >= 2) {
        const vorname = parts[0];
        const nachname = parts[parts.length - 1];
        const byName = await base44.asServiceRole.entities.Mitglied.filter({
          vorname: vorname,
          nachname: nachname
        });
        if (byName.length === 1) {
          // Eindeutiger Match!
          mitglied = byName[0];
          matchStrategy = 'name';
        }
      }
    }

    if (!mitglied) {
      return Response.json({ linked: false, message: 'Kein passendes Mitglied gefunden', user_email: user.email, user_name: user.full_name });
    }

    const updates = [];

    // 1. user_id verknüpfen falls noch nicht gesetzt oder unterschiedlich
    if (!mitglied.user_id) {
      await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { user_id: user.id });
      updates.push('user_id');
    } else if (mitglied.user_id !== user.id && matchStrategy !== 'user_id') {
      // user_id war auf einen anderen User gesetzt — aber wir haben via Name/Email gematcht
      // → überschreibe mit dem aktuellen User (z.B. Apple Login ersetzt alten Login)
      await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { user_id: user.id });
      updates.push('user_id (überschrieben)');
    }

    // 2. Email im Mitglied-Datensatz aktualisieren falls leer oder abweichend
    if (user.email && mitglied.email !== user.email && matchStrategy !== 'email') {
      // Nur aktualisieren wenn die Mitglieds-Email leer ist oder wir via Name/ID gematcht haben
      if (!mitglied.email || mitglied.email === '') {
        await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { email: user.email });
        updates.push('email');
      }
    }

    // 3. Rolle vom Mitglied-Datensatz übertragen (nur wenn Admin die app_rolle gesetzt hat)
    const gewuenschteRolle = mitglied.app_rolle;
    if (gewuenschteRolle && gewuenschteRolle !== user.role) {
      const erlaubteRollen = ['mitglied', 'spartenleiter', 'kassierer', 'stellv_vorstand', 'vorstand'];
      if (erlaubteRollen.includes(gewuenschteRolle)) {
        await base44.asServiceRole.entities.User.update(user.id, { role: gewuenschteRolle });
        updates.push('role → ' + gewuenschteRolle);
      }
    }

    return Response.json({
      linked: true,
      mitglied_id: mitglied.id,
      match_strategy: matchStrategy,
      updates,
      app_rolle: mitglied.app_rolle,
      zusatz_berechtigungen: mitglied.zusatz_berechtigungen || [],
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
