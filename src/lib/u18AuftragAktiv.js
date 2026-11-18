import { base44 } from '@/api/base44Client';

/**
 * Erziehungsaufträge gelten immer für GENAU EINE Veranstaltung (termin_id)
 * und genau eine Person (u18_mitglied_id).
 *
 * Wird das Kind von der Ausfahrt abgemeldet, ist der Auftrag hinfällig.
 * Die Abmeldung über meldeAbAusfahrtSicher löscht ihn serverseitig. Für
 * Wege, die direkt in der AusfahrtAnmeldung auf 'Abgemeldet' setzen
 * (z. B. "Entfernen" durch den Vorstand), filtert diese Funktion solche
 * Geisteraufträge zusätzlich im UI heraus.
 */
export async function nurAktiveAuftraege(liste) {
  const ergebnis = [];
  for (const e of (liste || [])) {
    if (e.typ !== 'ausfahrt' || !e.termin_id || !e.u18_mitglied_id) {
      ergebnis.push(e);
      continue;
    }
    try {
      const anmeldungen = await base44.entities.AusfahrtAnmeldung.filter({
        ausfahrt_id: e.termin_id,
        mitglied_id: e.u18_mitglied_id,
      });
      const aktiv = (anmeldungen || []).some(a => a.status !== 'Abgemeldet');
      if (aktiv) ergebnis.push(e);
    } catch {
      // Bei Abfragefehler lieber anzeigen als stillschweigend verschlucken.
      ergebnis.push(e);
    }
  }
  return ergebnis;
}
