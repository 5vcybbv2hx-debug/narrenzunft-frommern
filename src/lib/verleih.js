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

/**
 * Zentrale Verleih-Zuständige (für alle Gegenstände). Wird aus
 * AppEinstellung 'verleih' geladen und ergänzt die pro Gegenstand
 * eingetragenen Personen.
 */
export const ladeZentraleVerleihZustaendige = async (base44) => {
  try {
    const res = await base44.functions.invoke('verwalteVerleihZustaendigeSicher', { aktion: 'holen' });
    const d = res?.data || {};
    return Array.isArray(d.zustaendige_ids) ? d.zustaendige_ids : [];
  } catch (e) {
    return [];
  }
};

/** Darf das Mitglied diese Anfrage sehen/genehmigen (Gegenstand ODER zentral)? */
export const istVerleihZustaendigFuerAnfrage = (ausruestung, mitgliedId, zentraleIds = []) => {
  if (!mitgliedId) return false;
  if ((zentraleIds || []).includes(mitgliedId)) return true;
  const ids = verleihZustaendigeIds(ausruestung?.verleih_verantwortlicher_id);
  return ids.length === 0 || ids.includes(mitgliedId);
};
