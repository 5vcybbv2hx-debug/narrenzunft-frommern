import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Sichere Synchronisation der Verantwortlichen einer Gruppe.
 *
 * Erlaubt für:
 *  - Admin, Vorstand, Stv. Vorstand (volle Zuweisung)
 *  - Aktueller Spartenleiter der Gruppe (Mit-Verantwortliche benennen)
 *
 * Führt mit Service-Role aus, was clientseitig an RLS scheitern würde:
 *  1. Haesgruppe.verantwortliche_ids aktualisieren
 *  2. Mitglied.spartenleiter_haesgruppen_ids + app_rolle anpassen
 *  3. Verknüpften User.role synchronisieren
 *  4. SpartenleiterHistorie (Amtszeiten) führen
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    const body = await req.json();
    const { gruppeId, alteIds = [], neueIds = [] } = body;
    if (!gruppeId) return Response.json({ error: 'gruppeId fehlt' }, { status: 400 });

    const srv = base44.asServiceRole;

    // ── Autorisierung prüfen ──
    const gruppen = await srv.entities.Haesgruppe.filter({ id: gruppeId });
    const gruppe = gruppen?.[0];
    if (!gruppe) return Response.json({ error: 'Gruppe nicht gefunden' }, { status: 404 });

    const isFuehrung = ['admin', 'vorstand', 'stellv_vorstand'].includes(user.role);
    if (!isFuehrung) {
      // Spartenleiter: muss aktuelle(r) Verantwortliche(r) dieser Gruppe sein
      const meineMitglieder = await srv.entities.Mitglied.filter({ user_id: user.id });
      const meinMitglied = meineMitglieder?.[0];
      const aktuelleVerantwortliche = gruppe.verantwortliche_ids || (gruppe.verantwortlicher_id ? [gruppe.verantwortlicher_id] : []);
      const istVerantwortlich = meinMitglied && aktuelleVerantwortliche.includes(meinMitglied.id);
      if (!istVerantwortlich) {
        return Response.json({ error: 'Keine Berechtigung — nur Vorstand oder aktuelle Spartenleiter dürfen Verantwortliche zuweisen.' }, { status: 403 });
      }
    }

    const sauberAlt = (alteIds || []).filter(Boolean);
    const sauberNeu = (neueIds || []).filter(Boolean);

    // ── 1) Gruppe aktualisieren ──
    await srv.entities.Haesgruppe.update(gruppeId, {
      verantwortliche_ids: sauberNeu,
      verantwortlicher_id: sauberNeu[0] || '',
    });

    const toAdd = sauberNeu.filter((id) => !sauberAlt.includes(id));
    const toRemove = sauberAlt.filter((id) => !sauberNeu.includes(id));
    if (toAdd.length === 0 && toRemove.length === 0) {
      return Response.json({ ok: true, promoted: [], demoted: [], unchanged: true });
    }

    const jetzt = new Date().toISOString();

    // ── 2) Betroffene Mitglieder laden ──
    const changedIds = new Set([...toAdd, ...toRemove]);
    const betroffen = await srv.entities.Mitglied.filter({ id: { $in: Array.from(changedIds) } });
    const mitgliederById = new Map((betroffen || []).map((m) => [m.id, m]));

    const roleChanges = [];
    const bulkPayload = [];

    for (const id of changedIds) {
      const m = mitgliederById.get(id);
      if (!m) continue;
      const currentSplatIds = m.spartenleiter_haesgruppen_ids || (m.spartenleiter_haesgruppe_id ? [m.spartenleiter_haesgruppe_id] : []);
      const isNow = sauberNeu.includes(m.id);
      const updatedSplatIds = isNow
        ? [...new Set([...currentSplatIds, gruppeId])]
        : currentSplatIds.filter((gId) => gId !== gruppeId);

      const aktuelleRolle = m.app_rolle || 'mitglied';
      let neueRolle = aktuelleRolle;
      if (isNow && aktuelleRolle === 'mitglied') {
        neueRolle = 'spartenleiter';
      } else if (!isNow && aktuelleRolle === 'spartenleiter' && updatedSplatIds.length === 0) {
        neueRolle = 'mitglied';
      }

      bulkPayload.push({
        id: m.id,
        spartenleiter_haesgruppen_ids: updatedSplatIds,
        app_rolle: neueRolle,
      });

      if (neueRolle !== aktuelleRolle) {
        roleChanges.push({ mitglied: m, neueRolle });
      }
    }

    // ── 3) Mitglieder aktualisieren ──
    const fehler = await Promise.all(bulkPayload.map(async (p) => {
      try {
        await srv.entities.Mitglied.update(p.id, {
          spartenleiter_haesgruppen_ids: p.spartenleiter_haesgruppen_ids,
          app_rolle: p.app_rolle,
        });
        return null;
      } catch (e) {
        console.error('Mitglied-Sync fehlgeschlagen:', p.id, e);
        return p.id;
      }
    }));
    const gescheitert = fehler.filter(Boolean);
    if (gescheitert.length > 0) {
      return Response.json({ error: `Rolle/Gruppen konnten bei ${gescheitert.length} Mitglied(ern) nicht aktualisiert werden.` }, { status: 500 });
    }

    // ── 4) Verknüpfte Login-Rollen synchronisieren ──
    await Promise.all(roleChanges.map(async ({ mitglied, neueRolle }) => {
      if (!mitglied.user_id) return;
      try {
        const users = await srv.entities.User.filter({ id: mitglied.user_id });
        const u = users?.[0];
        if (!u) return;
        const userRolle = u.role || 'user';
        let neueUserRolle = null;
        if (neueRolle === 'spartenleiter' && (userRolle === 'mitglied' || userRolle === 'user')) {
          neueUserRolle = 'spartenleiter';
        } else if (neueRolle === 'mitglied' && userRolle === 'spartenleiter') {
          neueUserRolle = 'mitglied';
        }
        if (neueUserRolle) {
          await srv.entities.User.update(u.id, { role: neueUserRolle });
        }
      } catch (e) {
        console.error('User-Rolle konnte nicht synchronisiert werden:', mitglied.id, e);
      }
    }));

    // ── 5) Spartenleiter-Historie führen ──
    const historieTasks = [];
    for (const id of toAdd) {
      const m = mitgliederById.get(id);
      const mitgliedName = m ? [m.vorname, m.nachname].filter(Boolean).join(' ') : '';
      historieTasks.push((async () => {
        try {
          const offen = await srv.entities.SpartenleiterHistorie.filter({
            mitglied_id: id, haesgruppe_id: gruppeId, bis_datum: '',
          });
          if (offen?.length > 0) return;
          await srv.entities.SpartenleiterHistorie.create({
            mitglied_id: id,
            mitglied_name: mitgliedName,
            haesgruppe_id: gruppeId,
            haesgruppe_name: gruppe.name || '',
            von_datum: jetzt,
            bis_datum: '',
          });
        } catch (e) {
          console.error('Historie (hinzufügen):', e);
        }
      })());
    }
    for (const id of toRemove) {
      historieTasks.push((async () => {
        try {
          const offen = await srv.entities.SpartenleiterHistorie.filter({
            mitglied_id: id, haesgruppe_id: gruppeId, bis_datum: '',
          });
          await Promise.all((offen || []).map((h) =>
            srv.entities.SpartenleiterHistorie.update(h.id, { bis_datum: jetzt })
          ));
        } catch (e) {
          console.error('Historie (entfernen):', e);
        }
      })());
    }
    await Promise.all(historieTasks);

    return Response.json({
      ok: true,
      promoted: roleChanges.filter((r) => r.neueRolle === 'spartenleiter').map((r) => r.mitglied.id),
      demoted: roleChanges.filter((r) => r.neueRolle === 'mitglied').map((r) => r.mitglied.id),
    });
  } catch (error) {
    console.error('syncVerantwortlicheSicher Fehler:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}