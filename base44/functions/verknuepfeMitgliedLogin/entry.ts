import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { istAktuellerSpartenleiter } from '../../shared/ausschussBerechtigung.ts';
import { sendePush } from '../../shared/pushSenden.ts';
import { ladeAlleMitglieder } from '../../shared/alleMitglieder.ts';

// Einziger Empfänger der Erst-Login-Benachrichtigung (Nur-Pierre-Regel):
// Pierre Hugendubel (Vorstand). Er will bei jedem ERSTEN Login eines eingeladenen
// Mitglieds Name, ID und den Verknüpfungs-Status sehen — auch (und gerade) wenn
// die Verknüpfung scheitert (Emma-Wager-Fall soll nie wieder still passieren).
const ERSTLOGIN_EMPFAENGER_ID = '69f3b8c88f81a46608cfc431';

/**
 * Erst-Login eines User-Kontos protokollieren und per Push melden.
 * Dedupe über ErstLoginProtokoll (user_id): genau EINE Meldung pro Konto.
 * Läuft absichtlich auch bei GESCHEITERTER Verknüpfung — genau dann muss
 * der Vorstand manuell verknüpfen.
 */
async function erstLoginMelden(base44, user, mitglied, problem) {
  try {
    const S = base44.asServiceRole;
    const bereits = await S.entities.ErstLoginProtokoll.filter({ user_id: user.id }).catch(() => []);
    if (Array.isArray(bereits) && bereits.length > 0) return null; // kein Erst-Login

    const verknuepft = !!mitglied;
    const name = mitglied
      ? String(mitglied.vorname || '').trim() + ' ' + String(mitglied.nachname || '').trim()
      : '';

    await S.entities.ErstLoginProtokoll.create({
      user_id: user.id,
      login_email: user.email || '',
      mitglied_id: mitglied ? mitglied.id : '',
      mitgliedsname: name.trim(),
      verknuepft,
      problem: problem || '',
    }).catch(() => {});

    let titel, nachricht;
    if (mitglied) {
      titel = 'Erst-Login — Profil verknüpft';
      nachricht = name + ' (ID: ' + mitglied.id + ') hat sich erstmals eingeloggt. Login ' +
        (user.email || '(ohne E-Mail)') + ' ist verknüpft.';
    } else {
      titel = 'Erst-Login — Profil FEHLT';
      nachricht = (user.email || user.id) + ' ist KEINEM Mitgliedsprofil zugeordnet (' +
        (problem || 'keine Übereinstimmung') + '). Bitte unter Berechtigungen verknüpfen. User-ID: ' + user.id;
    }
    const push = await sendePush([ERSTLOGIN_EMPFAENGER_ID], titel, nachricht, { route: '/berechtigungen' });
    return push;
  } catch (e) {
    console.error('erstLoginMelden:', e);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const S = base44.asServiceRole;

    let mitglied = null;
    let matchStrategy = null;
    let problem = null;

    if (user.id) {
      const byUserId = await S.entities.Mitglied.filter({ user_id: user.id });
      if (byUserId.length > 1) { problem = 'mehrere Profile tragen diese user_id'; }
      else if (byUserId.length === 1) { mitglied = byUserId[0]; matchStrategy = 'user_id'; }
    }

    if (!mitglied && !problem && user.email) {
      // Nur eindeutige E-Mail, inklusive Groß-/Kleinschreibvarianten (case-insensitive).
      const alle = await ladeAlleMitglieder(S);
      const norm = String(user.email).trim().toLowerCase();
      const matches = alle.filter(m => m.email && m.email.trim().toLowerCase() === norm);
      if (matches.length === 1) {
        mitglied = matches[0];
        matchStrategy = mitglied.email === user.email ? 'email' : 'email_ci';
      } else if (matches.length > 1) {
        problem = 'mehrere Profile mit derselben E-Mail';
      }
    }

    // Namens-Matching bewusst entfernt — Sicherheitsrisiko: ein Angreifer konnte sich mit
    // dem Namen eines Vorstands-Mitglieds registrieren und dessen Rolle übernehmen.
    // Verknüpfung ausschließlich über user_id oder verifizierte E-Mail-Adresse.

    if (!mitglied || (mitglied.user_id && mitglied.user_id !== user.id)) {
      // Erst-Login trotzdem melden — der Vorstand muss manuell verknüpfen
      await erstLoginMelden(base44, user, null, problem || 'keine eindeutige, freie Übereinstimmung');
      const msg = problem === 'mehrere Profile tragen diese user_id'
        ? 'Mehrere Mitgliedsprofile mit diesem Login verknüpft. Bitte vom Vorstand prüfen lassen.'
        : 'Keine eindeutige, freie Mitgliedsverknüpfung. Bitte vom Vorstand prüfen lassen.';
      return Response.json({ linked: false, message: msg });
    }

    const updates = [];

    if (!mitglied.user_id) {
      await S.entities.Mitglied.update(mitglied.id, { user_id: user.id });
      updates.push('user_id');
      mitglied.user_id = user.id;
    }
    // Bewusst KEINE Überschreibung bestehender user_id-Verknüpfungen mehr —
    // selbst bei Email-Match könnte ein Edge-Case zur Konto-Übernahme führen.
    // Ein Admin kann veraltete Verknüpfungen manuell korrigieren.

    if (user.email && mitglied.email !== user.email && matchStrategy !== 'email') {
      if (!mitglied.email || mitglied.email === '') {
        await S.entities.Mitglied.update(mitglied.id, { email: user.email });
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

    // Erst-Login melden (dedupliziert) — jetzt mit verknüpftem Profil
    const erstloginPush = await erstLoginMelden(base44, user, mitglied, null);

    const ausschuss = await S.entities.AusschussMitglied.filter({ mitglied_id: mitglied.id, aktiv: true });
    const zusatz = Array.isArray(mitglied.zusatz_berechtigungen) ? mitglied.zusatz_berechtigungen :
      String(mitglied.zusatz_berechtigungen || '').split(',').map(x => x.trim()).filter(Boolean);
    const ausschuss_berechtigt = ['vorstand', 'stellv_vorstand', 'admin'].includes(user.role) ||
      zusatz.includes('ausschuss') || ausschuss.length > 0 ||
      await istAktuellerSpartenleiter(base44, mitglied.id);
    return Response.json({ linked: true, mitglied_id: mitglied.id, match_strategy: matchStrategy, updates,
      app_rolle: mitglied.app_rolle, zusatz_berechtigungen: zusatz, ausschuss_berechtigt, erstlogin_gemeldet: !!erstloginPush });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
});