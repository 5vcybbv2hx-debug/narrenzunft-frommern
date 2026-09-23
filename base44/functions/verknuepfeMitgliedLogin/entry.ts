import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMitgliedUndRechte } from "../../shared/ausschussBerechtigung.ts";

/**
 * Verknüpft den authentifizierten Login mit einem Mitgliedsdatensatz.
 *
 * Matching-Reihenfolge:
 *  1. user_id (eindeutig, sicher)
 *  2. E-Mail — NUR bei genau einem eindeutigen Treffer.
 *     Geteilte/mehrdeutige E-Mails werden NICHT dem ersten Mitglied zugeordnet
 *     (Sicherheit: sonst könnte ein Angreifer durch Registrierung mit einer
 *      geteilten Adresse Zugriff auf fremde Mitgliederkonten erhalten).
 *  3. Case-insensitive E-Mail-Fallback (ebenfalls nur eindeutig).
 *
 * Namens-Matching wurde bewusst entfernt (Sicherheitsrisiko).
 *
 * Rollen werden NICHT automatisch aus app_rolle übernommen — app_rolle ist vom
 * Benutzer selbst beschreibbar (RLS) und eine automatische Übernahme wäre eine
 * Rechteausweitung. Rollen weist ein Admin manuell zu.
 *
 * Zurückgegeben wird u.a. das serverseitig abgeleitete Flag `ausschuss_berechtigt`
 * (aus aktiver Spartenleitung, Ausschussmitgliedschaft oder Zusatzrecht) sowie
 * `kann_verwalten` (Vorstand/Stellv./Admin).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let mitglied = null;
    let matchStrategy = null;
    let mehrdeutig = false;

    // 1. user_id
    if (user.id) {
      const byUserId = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
      if (byUserId.length === 1) {
        mitglied = byUserId[0];
        matchStrategy = 'user_id';
      } else if (byUserId.length > 1) {
        mehrdeutig = true;
      }
    }

    // 2. E-Mail (exakt)
    if (!mitglied && !mehrdeutig && user.email) {
      const byEmail = await base44.asServiceRole.entities.Mitglied.filter({ email: user.email });
      if (byEmail.length === 1) {
        mitglied = byEmail[0];
        matchStrategy = 'email';
      } else if (byEmail.length > 1) {
        mehrdeutig = true;
      }
    }

    // 3. E-Mail case-insensitive
    if (!mitglied && !mehrdeutig && user.email) {
      const alle = await base44.asServiceRole.entities.Mitglied.list({ limit: 1000 });
      const ciMatches = (alle || []).filter(
        (m) => m.email && m.email.toLowerCase() === user.email.toLowerCase()
      );
      if (ciMatches.length === 1) {
        mitglied = ciMatches[0];
        matchStrategy = 'email_ci';
      } else if (ciMatches.length > 1) {
        mehrdeutig = true;
      }
    }

    if (mehrdeutig) {
      return Response.json({
        linked: false,
        mehrdeutig: true,
        message: 'E-Mail/Verknüpfung ist mehreren Mitgliedern zugeordnet — ein Admin muss die Verknüpfung manuell vornehmen.',
        user_email: user.email,
      });
    }

    if (!mitglied) {
      return Response.json({
        linked: false,
        message: 'Kein passendes Mitglied gefunden',
        user_email: user.email,
        user_name: user.full_name,
      });
    }

    const updates = [];

    // user_id schreiben, falls noch nicht verknüpft — keine Überschreibung
    // bestehender Fremdverknüpfungen (Konto-Übernahme-Schutz).
    if (!mitglied.user_id) {
      await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { user_id: user.id });
      updates.push('user_id');
    }

    // E-Mail ergänzen, wenn das Mitglied noch keine hat und nicht per E-Mail gematcht wurde
    if (user.email && (!mitglied.email || mitglied.email === '') && matchStrategy === 'user_id') {
      await base44.asServiceRole.entities.Mitglied.update(mitglied.id, { email: user.email });
      updates.push('email');
    }

    // app_rolle nur als Vorschlag — NICHT automatisch übernehmen (RLS: app_rolle
    // ist selbst beschreibbar, Übernahme wäre Rechteausweitung).
    if (mitglied.app_rolle && mitglied.app_rolle !== user.role) {
      updates.push('role-pending (Admin-Zuweisung erforderlich: ' + mitglied.app_rolle + ')');
    }

    // Serverseitig abgeleitete Berechtigung aus shared Helper
    const ctx = await loeseMitgliedUndRechte(base44, user);

    return Response.json({
      linked: true,
      mitglied_id: mitglied.id,
      match_strategy: matchStrategy,
      updates,
      app_rolle: mitglied.app_rolle,
      zusatz_berechtigungen: mitglied.zusatz_berechtigungen || [],
      ausschuss_berechtigt: ctx.darfAusschuss,
      aktive_spartenleitung: ctx.aktiveSpartenleitung,
      kann_verwalten: ctx.kannVerwalten,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});