import { base44 } from '@/api/base44Client';

/**
 * Zentrale Frontend-Hilfsfunktion für sichere Ausschuss-Aktionen.
 * Alle Lifecycle-/Verknüpfungs-/Audit-Aktionen laufen über die Backend-Function
 * ausschussAktionSicher, damit Nutzer mit Zusatzrecht 'ausschuss' nicht an der
 * Entity-RLS scheitern und jede Aktion serverseitig geprüft wird.
 *
 * @param {string} aktion - Allowlist-Aktion
 * @param {object} payload - Weitere Felder
 * @returns {Promise<object>} Response-Daten
 */
export async function ausschussAktion(aktion, payload = {}) {
  const res = await base44.functions.invoke('ausschussAktionSicher', { aktion, ...payload });
  if (res?.data?.error) throw new Error(res.data.message || res.data.error);
  return res.data || {};
}

export async function jahresplanGenerieren(jahr) {
  const res = await base44.functions.invoke('generiereJahresplanAufgabenSicher', { jahr });
  if (res?.data?.error) throw new Error(res.data.message || res.data.error);
  return res.data || {};
}