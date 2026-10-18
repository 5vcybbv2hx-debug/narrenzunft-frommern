import { differenceInYears } from 'date-fns';

/**
 * U18-Begleitbestätigung: Helper.
 * Eine Person gilt als U18, wenn sie am EVENT-Datum unter 18 ist.
 */
export function istU18(geburtsdatum, eventDatum) {
  if (!geburtsdatum || !eventDatum) return false;
  try {
    const geb = new Date(geburtsdatum + 'T00:00:00');
    const ev = new Date(eventDatum + 'T00:00:00');
    if (isNaN(geb) || isNaN(ev)) return false;
    return differenceInYears(ev, geb) < 18;
  } catch { return false; }
}
