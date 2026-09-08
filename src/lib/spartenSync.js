import { base44 } from '@/api/base44Client';

/**
 * Zentrale Synchronisation der Verantwortlichen einer Gruppe.
 *
 * Ruft die sichere Backend-Funktion auf, die mit Service-Role arbeitet
 * und die Autorisierung prüft (Vorstand/Admin ODER aktuelle Spartenleiter
 * der Gruppe). Dadurch können auch Spartenleiter Mit-Verantwortliche
 * benennen, obwohl RLS direkte Schreibzugriffe blockiert.
 *
 * @param {Object} opts
 * @param {string}  opts.gruppeId   ID der Haesgruppe
 * @param {string[]} opts.alteIds   Bisherige verantwortliche_ids der Gruppe
 * @param {string[]} opts.neueIds   Neue verantwortliche_ids der Gruppe
 * @param {Array}    opts.mitglieder (wird nicht mehr benötigt — bleibt für Kompatibilität)
 * @returns {Promise<{promoted: string[], demoted: string[]}>}
 */
export async function syncVerantwortliche({ gruppeId, alteIds = [], neueIds = [], mitglieder = [] }) {
  const res = await base44.functions.invoke('syncVerantwortlicheSicher', {
    gruppeId,
    alteIds,
    neueIds,
  });
  const data = res.data || res;
  if (data?.error) {
    throw new Error(data.error);
  }
  return {
    promoted: data.promoted || [],
    demoted: data.demoted || [],
  };
}