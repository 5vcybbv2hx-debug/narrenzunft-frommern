import { base44 } from '@/api/base44Client';

/**
 * Erstellt automatisch Tagesordnungspunkte "Nachbesprechung: <Veranstaltung>"
 * für alle Veranstaltungen mit nachbereitung_status === 'Ausstehend',
 * die vor dem Sitzungstermin liegen.
 * Wird beim Anlegen einer Ausschusssitzung aufgerufen.
 *
 * @param {string} terminId  ID des neuen KalenderTermins (Sitzung)
 * @param {string} terminDatum ISO-Datum der Sitzung (optional)
 * @returns {number} Anzahl erstellter TOPs
 */
export async function erstelleNachbesprechungsTops(terminId, terminDatum) {
  if (!terminId) return 0;
  try {
    const alle = await base44.entities.Veranstaltung.list('datum', 500);
    const stichtag = terminDatum || new Date().toISOString().slice(0, 10);
    const faellige = alle
      .filter(v => v.nachbereitung_status === 'Ausstehend' && v.datum && v.datum < stichtag)
      .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));

    if (!faellige.length) return 0;

    await Promise.all(faellige.map((v, i) =>
      base44.entities.Tagesordnungspunkt.create({
        termin_id: terminId,
        veranstaltung_id: v.id,
        titel: `Nachbesprechung: ${v.titel}`,
        beschreibung: 'Automatisch erstellt: Zahlen & Erfahrungen im Tab "Nachbereitung" der Veranstaltung nachtragen.',
        reihenfolge: i + 1,
        status: 'Offen',
      })
    ));
    return faellige.length;
  } catch (e) {
    console.error('Nachbesprechungs-TOPs konnten nicht erstellt werden:', e);
    return 0;
  }
}
