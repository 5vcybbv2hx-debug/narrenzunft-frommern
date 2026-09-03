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
 *  5. SpartenleiterHistorie        (Amtszeiten: von/bis, für Historie)
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

  // Gruppen-Namen für Historie-Snapshots laden
  let gruppeName = '';
  try {
    const gruppen = await base44.entities.Haesgruppe.filter({ id: gruppeId });
    gruppeName = gruppen?.[0]?.name || '';
  } catch (e) {
    console.error('Gruppe für Historie laden:', e);
  }

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

  const jetzt = new Date().toISOString();

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

  // Einzelne Updates statt bulkUpdate: bulkUpdate schlägt stillschweigend fehl,
  // wenn ein Datensatz nicht aktualisiert werden kann — dann bleiben Rolle und
  // Gruppen-IDs inkonsistent, ohne dass ein Fehler sichtbar wird. Einzeln können
  // wir Fehlschläge erkennen und melden.
  if (bulkPayload.length > 0) {
    const fehler = await Promise.all(bulkPayload.map(async p => {
      try {
        await base44.entities.Mitglied.update(p.id, {
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
      throw new Error(`Rolle/Gruppen konnten bei ${gescheitert.length} Mitglied(ern) nicht aktualisiert werden.`);
    }
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

  // ── 5) Spartenleiter-Historie führen ──
  // Neuer Verantwortlicher → Amtszeit beginnt (bis_datum leer)
  // Entfernt → offene Amtszeit wird mit heute geschlossen
  const historieTasks = [];

  for (const m of mitglieder) {
    const mitgliedName = [m.vorname, m.nachname].filter(Boolean).join(' ') || '';

    if (toAdd.includes(m.id)) {
      // Kein Duplikat anlegen, falls noch eine offene Amtszeit existiert
      historieTasks.push(
        (async () => {
          try {
            const offen = await base44.entities.SpartenleiterHistorie.filter({
              mitglied_id: m.id, haesgruppe_id: gruppeId, bis_datum: '',
            });
            if (offen?.length > 0) return;
            await base44.entities.SpartenleiterHistorie.create({
              mitglied_id: m.id,
              mitglied_name: mitgliedName,
              haesgruppe_id: gruppeId,
              haesgruppe_name: gruppeName,
              von_datum: jetzt,
              bis_datum: '',
            });
          } catch (e) {
            console.error('Historie (hinzufügen):', e);
          }
        })()
      );
    }

    if (toRemove.includes(m.id)) {
      historieTasks.push(
        (async () => {
          try {
            const offen = await base44.entities.SpartenleiterHistorie.filter({
              mitglied_id: m.id, haesgruppe_id: gruppeId, bis_datum: '',
            });
            await Promise.all((offen || []).map(h =>
              base44.entities.SpartenleiterHistorie.update(h.id, { bis_datum: jetzt })
            ));
          } catch (e) {
            console.error('Historie (entfernen):', e);
          }
        })()
      );
    }
  }

  await Promise.all(historieTasks);

  return {
    promoted: roleChanges.filter(r => r.neueRolle === 'spartenleiter').map(r => r.mitglied.id),
    demoted: roleChanges.filter(r => r.neueRolle === 'mitglied').map(r => r.mitglied.id),
  };
}
