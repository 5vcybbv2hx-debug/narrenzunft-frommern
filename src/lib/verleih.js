// Hilfsfunktionen für den öffentlichen Verleih (QR-Verleih)

/**
 * Liest die zuständigen Mitglieder-IDs aus dem Ausruestung-Feld
 * 'verleih_verantwortlicher_id'. Mehrere IDs sind komma-getrennt
 * gespeichert (rückwärtskompatibel zu einzelnen IDs).
 */
export const verleihZustaendigeIds = (feld) =>
  (feld || '').toString().split(',').map((s) => s.trim()).filter(Boolean);

/**
 * true, wenn das Mitglied die Verleih-Anfrage für diesen Gegenstand
 * genehmigen darf: leer = alle Vorstände/Admins (im Aufrufer geprüft),
 * sonst nur wenn in der Zuständigen-Liste enthalten.
 */
export const istVerleihZustaendig = (ausruestung, mitgliedId) => {
  const ids = verleihZustaendigeIds(ausruestung?.verleih_verantwortlicher_id);
  return ids.length === 0 || ids.includes(mitgliedId);
};
