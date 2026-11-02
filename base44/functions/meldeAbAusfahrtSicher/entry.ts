import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Abmeldung einer Ausfahrt-Anmeldung durch Angehörige (Kinder ↔ Eltern).
 *
 * Hintergrund: Die AusfahrtAnmeldung-RLS erlaubt Updates nur dem Ersteller
 * sowie Verwaltung/Spartenleiter. Meldet ein Elternteil sich selbst an, kann
 * das Kind diese Anmeldung also nicht abmelden — obwohl es laut Vorstand
 * zulässig sein soll (und umgekehrt).
 *
 * Diese Function prüft die Berechtigung serverseitig:
 *  - eigenes Profil
 *  - Verwandtschaft in beide Richtungen: Kind, Elternteil, Ehepartner/in
 *  - Verwaltung (admin/vorstand/stellv_vorstand)
 * Danach wird die Anmeldung auf 'Abgemeldet' gesetzt.
 */
const VERWALTUNG = ['admin', 'vorstand', 'stellv_vorstand'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ erfolg: false, fehler: 'Nicht angemeldet.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anmeldungId = String(body.anmeldung_id || '');
    if (!anmeldungId) return Response.json({ erfolg: false, fehler: 'anmeldung_id fehlt.' }, { status: 400 });

    const S = base44.asServiceRole.entities;
    const anmeldung = (await S.AusfahrtAnmeldung.filter({ id: anmeldungId }).catch(() => []))?.[0];
    if (!anmeldung) return Response.json({ erfolg: false, fehler: 'Anmeldung nicht gefunden.' }, { status: 404 });
    if (anmeldung.status === 'Abgemeldet') return Response.json({ erfolg: true, bereitsAbgemeldet: true });

    // Eigenes Mitgliedsprofil
    let selbst = (await S.Mitglied.filter({ user_id: user.id }).catch(() => []))?.[0] || null;
    if (!selbst && user.email) {
      const byMail = await S.Mitglied.filter({ email: user.email }).catch(() => []);
      if (byMail?.length === 1 && (!byMail[0].user_id || byMail[0].user_id === user.id)) selbst = byMail[0];
    }

    const zielId = anmeldung.mitglied_id || '';
    let erlaubt = VERWALTUNG.includes(user.role);

    if (!erlaubt && selbst && zielId) {
      if (selbst.id === zielId) erlaubt = true;
      if (!erlaubt) {
        const [direkt, umgekehrt] = await Promise.all([
          S.Verwandtschaft.filter({ mitglied_id: selbst.id, verwandter_id: zielId }).catch(() => []),
          S.Verwandtschaft.filter({ mitglied_id: zielId, verwandter_id: selbst.id }).catch(() => []),
        ]);
        const erlaubteBeziehungen = ['Kind', 'Elternteil', 'Ehepartner/in'];
        erlaubt = [...(direkt || []), ...(umgekehrt || [])].some((v) => erlaubteBeziehungen.includes(v.beziehung));
      }
    }

    // Fremdanmeldungen (ohne Mitglied) darf nur die Verwaltung stornieren
    if (!erlaubt) {
      return Response.json({ erfolg: false, fehler: 'Keine Berechtigung für diese Abmeldung.' }, { status: 403 });
    }

    await S.AusfahrtAnmeldung.update(anmeldungId, {
      status: 'Abgemeldet',
      abgemeldet_am: new Date().toISOString().slice(0, 10),
    });

    return Response.json({ erfolg: true, abgemeldet: true });
  } catch (error) {
    return Response.json({ erfolg: false, fehler: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}
