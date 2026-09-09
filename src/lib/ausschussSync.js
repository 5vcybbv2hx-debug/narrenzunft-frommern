import { base44 } from '@/api/base44Client';

/**
 * Synchronisiert den Ausschuss-Zugang eines Mitglieds (analog zu spartenSync.js).
 *
 * aktiv = true  → Mitglied erhält die Zusatz-Berechtigung 'ausschuss'
 *                 (automatischer Zugang zum Ausschussbereich inkl. Navigation).
 * aktiv = false → Zusatz-Berechtigung 'ausschuss' wird entfernt.
 *
 * Rollen (Vorstand, Stellv., Admin) werden bewusst NICHT angefasst —
 * der Sync ergänzt nur die Zusatz-Berechtigung.
 */
export async function syncAusschussZugang(mitgliedId, aktiv) {
  const treffer = await base44.entities.Mitglied.filter({ id: mitgliedId });
  const m = treffer?.[0];
  if (!m) throw new Error('Mitglied nicht gefunden (' + mitgliedId + ')');

  let zusatz = m.zusatz_berechtigungen || [];
  if (typeof zusatz === 'string') {
    zusatz = zusatz.split(',').map(s => s.trim()).filter(Boolean);
  } else if (!Array.isArray(zusatz)) {
    zusatz = [];
  }

  const neu = aktiv
    ? [...new Set([...zusatz, 'ausschuss'])]
    : zusatz.filter(z => z !== 'ausschuss');

  // Nichts zu tun — Berechtigung ist bereits korrekt
  if (JSON.stringify(neu.sort()) === JSON.stringify([...zusatz].sort())) return m;

  try {
    return await base44.entities.Mitglied.update(mitgliedId, { zusatz_berechtigungen: neu });
  } catch (e) {
    console.error('Ausschuss-Zugang-Sync fehlgeschlagen:', e);
    alert(
      `Der Ausschuss-Zugang für ${m.vorname || ''} ${m.nachname || ''} konnte nicht ` +
      `automatisch angepasst werden. Bitte die Berechtigungen im Mitgliederprofil prüfen.`
    );
    throw e;
  }
}
