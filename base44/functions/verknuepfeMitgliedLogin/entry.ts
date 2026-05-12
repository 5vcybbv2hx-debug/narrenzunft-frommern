/**
 * Wird beim Login aufgerufen um:
 * 1. Den eingeloggten User mit dem Mitglied-Datensatz (gleiche Email) zu verknüpfen
 * 2. Die app_rolle vom Mitglied-Datensatz auf den User zu übertragen
 *
 * SICHERHEIT: Läuft serverseitig mit Service-Role.
 * Der User kann seine eigene Rolle NICHT selbst setzen – nur der Server liest
 * die vom Admin vorab gesetzte `app_rolle` aus dem Mitglied-Datensatz und überträgt sie.
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

    // Mitglied mit gleicher Email suchen (Service-Role: sicher, nur Server liest)
    const mitglieder = await base44.asServiceRole.entities.Mitglied.filter({ email: user.email });
    const mitglied = mitglieder[0];

    if (!mitglied) {
      // Kein Mitglied gefunden – kein Fehler, einfach nichts tun
      return Response.json({ linked: false, message: 'Kein Mitglied mit dieser Email gefunden' });
    }

    const updates = [];

    // 1. user_id verknüpfen falls noch nicht gesetzt
    if (!mitglied.user_id) {
      await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { user_id: user.id });
      updates.push('user_id');
    } else if (mitglied.user_id !== user.id) {
      // Sicherheits-Check: Email bereits von anderem User verwendet – NICHT überschreiben
      return Response.json({
        linked: false,
        error: 'Mitglied-Email ist bereits mit einem anderen Account verknüpft'
      }, { status: 409 });
    }

    // 2. Rolle vom Mitglied-Datensatz übertragen (nur wenn Admin die app_rolle gesetzt hat)
    const gewuenschteRolle = mitglied.app_rolle;
    if (gewuenschteRolle && gewuenschteRolle !== user.role) {
      // Nur gültige Rollen erlauben
      const erlaubteRollen = ['mitglied', 'elternkonto', 'spartenleiter', 'kassierer', 'stellv_vorstand', 'vorstand'];
      if (erlaubteRollen.includes(gewuenschteRolle)) {
        await base44.asServiceRole.entities.User.update(user.id, { role: gewuenschteRolle });
        updates.push('role → ' + gewuenschteRolle);
      }
    }

    return Response.json({
      linked: true,
      mitglied_id: mitglied.id,
      updates,
      app_rolle: mitglied.app_rolle,
      zusatz_berechtigungen: mitglied.zusatz_berechtigungen || [],
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});