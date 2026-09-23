import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { istAktuellerSpartenleiter } from '../../shared/ausschussBerechtigung.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let mitglied = null;
    let matchStrategy = null;

    if (user.id) {
      const byUserId = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
      if (byUserId.length > 1) return Response.json({ linked: false, message: 'Mehrere Mitgliedsprofile mit diesem Login verknüpft. Bitte vom Vorstand prüfen lassen.' });
      if (byUserId.length === 1) { mitglied = byUserId[0]; matchStrategy = 'user_id'; }
    }

    if (!mitglied && user.email) {
      // Nur eindeutige E-Mail, inklusive Groß-/Kleinschreibvarianten.
      const alle = await base44.asServiceRole.entities.Mitglied.list({ limit: 500 });
      if (alle.length < 500) {
        const norm = String(user.email).trim().toLowerCase();
        const matches = alle.filter(m => m.email && m.email.trim().toLowerCase() === norm);
        if (matches.length === 1) {
          mitglied = matches[0];
          matchStrategy = mitglied.email === user.email ? 'email' : 'email_ci';
        }
      }
    }

    // Namens-Matching bewusst entfernt — Sicherheitsrisiko: ein Angreifer konnte sich
    // mit dem Namen eines Vorstands-Mitglieds registrieren und dessen Rolle übernehmen.
    // Verknüpfung ausschließlich über user_id oder verifizierte E-Mail-Adresse.

    if (!mitglied || (mitglied.user_id && mitglied.user_id !== user.id)) {
      return Response.json({ linked: false, message: 'Keine eindeutige, freie Mitgliedsverknüpfung. Bitte vom Vorstand prüfen lassen.' });
    }

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

    const ausschuss = await base44.asServiceRole.entities.AusschussMitglied.filter({ mitglied_id: mitglied.id, aktiv: true });
    const zusatz = Array.isArray(mitglied.zusatz_berechtigungen) ? mitglied.zusatz_berechtigungen :
      String(mitglied.zusatz_berechtigungen || '').split(',').map(x => x.trim()).filter(Boolean);
    const ausschuss_berechtigt = ['vorstand', 'stellv_vorstand', 'admin'].includes(user.role) ||
      zusatz.includes('ausschuss') || ausschuss.length > 0 ||
      await istAktuellerSpartenleiter(base44, mitglied.id);
    return Response.json({ linked: true, mitglied_id: mitglied.id, match_strategy: matchStrategy, updates,
      app_rolle: mitglied.app_rolle, zusatz_berechtigungen: zusatz, ausschuss_berechtigt });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});