import { base44 } from '@/api/base44Client';

/**
 * Zentrale Synchronisation der Verantwortlichen einer Gruppe.
 *
 * Alle Schreib-Stellen (SparteFormModal, SpartenDashboard,
 * MitgliedDetail) MÜSSEN diese Funktion nutzen, damit folgende
 * Daten überall konsistent sind:
 *
 *  1. Haesgruppe.verantwortliche_ids (+ Legacy-Feld verantwortlicher_id)
 *  2. Mitglied.spartenleiter_haesgruppen_ids
 *  3. Mitglied.app_rolle          (mitglied ↔ spartenleiter)
 *  4. Verknüpfter User.role        (Login-Rolle, von roles.js geprüft!)
 *
 * Rollen werden dabei NUR bei eindeutigen Übergängen geändert:
 *  - Beförderung:  app_rolle 'mitglied' → 'spartenleiter'
 *  - Rückstufung:   app_rolle 'spartenleiter' → 'mitglied'
 *                  (nur wenn KEINE andere Gruppe mehr übrig ist)
 * Vorstände/Kassierer/Admins werden niemals angefasst.
 *
 * @param {Object} opts
 * @param {string}  opts.gruppeId   ID der Haesgruppe
 * @param {string[]} opts.alteIds   Bisherige verantwortliche_ids der Gruppe
 * @param {string[]} opts.neueIds   Neue verantwortliche_ids der Gruppe
 * @param {Array}    opts.mitglieder Betroffene Mitglied-Datensätze (mind. die geänderten)
 * @returns {Promise<{promoted: string[], demoted: string[]}>} IDs der promovierten/degradierten Mitglieder
 */
export async function syncVerantwortliche({ gruppeId, alteIds = [], neueIds = [], mitglieder = [] }) {
  alteIds = alteIds.filter(Boolean);
  neueIds = neueIds.filter(Boolean);

  // ── 1) Gruppe aktualisieren ──
  await base44.entities.Haesgruppe.update(gruppeId, {
    verantwortliche_ids: neueIds,
    verantwortlicher_id: neueIds[0] || '',
  });

  const toAdd = neueIds.filter(id => !alteIds.includes(id));
  const toRemove = alteIds.filter(id => !neueIds.includes(id));
  if (toAdd.length === 0 && toRemove.length === 0) {
    return { promoted: [], demoted: [] };
  }

  // ── 2) + 3) Betroffene Mitglieder aktualisieren ──
  const bulkPayload = [];
  const roleChanges = []; // { mitglied, neueRolle }
  const changedIds = new Set([...toAdd, ...toRemove]);

  for (const m of mitglieder) {
    if (!changedIds.has(m.id)) continue;

    const currentSplatIds = m.spartenleiter_haesgruppen_ids || (m.spartenleiter_haesgruppe_id ? [m.spartenleiter_haesgruppe_id] : []);
    const isNow = neueIds.includes(m.id);
    const updatedSplatIds = isNow
      ? [...new Set([...currentSplatIds, gruppeId])]
      : currentSplatIds.filter(gId => gId !== gruppeId);

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

  if (bulkPayload.length > 0) {
    await base44.entities.Mitglied.bulkUpdate(bulkPayload);
  }

  // ── 4) Verknüpfte Login-Rollen (User.role) synchronisieren ──
  // Nur bei eindeutigen Übergängen; Admins/Vorstände werden nie degradiert.
  await Promise.all(roleChanges.map(async ({ mitglied, neueRolle }) => {
    if (!mitglied.user_id) return;
    try {
      const users = await base44.entities.User.filter({ id: mitglied.user_id });
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
        await base44.entities.User.update(u.id, { role: neueUserRolle });
      }
    } catch (e) {
      // Login-Rolle konnte nicht syncronisiert werden (z. B. kein User verknüpft
      // oder keine Berechtigung) — Mitglied-Daten sind trotzdem konsistent.
      console.error('User-Rolle konnte nicht synchronisiert werden:', mitglied.id, e);
    }
  }));

  return {
    promoted: roleChanges.filter(r => r.neueRolle === 'spartenleiter').map(r => r.mitglied.id),
    demoted: roleChanges.filter(r => r.neueRolle === 'mitglied').map(r => r.mitglied.id),
  };
}
