/**
 * Anmeldezeitfenster für Veranstaltungen (Typ: Umzug, Abendveranstaltung, Intern, ...).
 *
 * Reihenfolge der Prüfung:
 *  1. Anmeldung muss aktiv sein (anmeldung_aktiv)
 *  2. Fenster-Beginn: anmeldung_start (Datum) — vorher ist zu, Text "öffnet am ..."
 *  3. Fenster-Ende:   anmeldung_ende (Datum, inkl. Tag) — Fallback: alter anmeldeschluss
 *
 * Die Felder sind optional: Ohne Start gilt "sofort", ohne Ende (und ohne
 * alten Anmeldeschluss) gilt "unbegrenzt" — alte Veranstaltungen verhalten
 * sich also unverändert.
 */
export function istVeranstaltungAnmeldungOffen(v, jetzt = new Date()) {
  if (!v?.anmeldung_aktiv) return false;
  if (v.anmeldung_start && jetzt < new Date(v.anmeldung_start + 'T00:00:00')) return false;
  const ende = v.anmeldung_ende || v.anmeldeschluss;
  if (ende && jetzt > new Date(ende.length === 10 ? ende + 'T23:59:59.999' : ende)) return false;
  return true;
}

/** Kurzer Status-Text wenn die Anmeldung NICHT offen ist (null = offen, kein Text nötig). */
export function veranstaltungAnmeldeText(v, jetzt = new Date()) {
  if (!v?.anmeldung_aktiv) return 'Anmeldung deaktiviert';
  if (v.anmeldung_start && jetzt < new Date(v.anmeldung_start + 'T00:00:00'))
    return `Anmeldung öffnet am ${v.anmeldung_start.split('-').reverse().join('.')}`;
  const ende = v.anmeldung_ende || v.anmeldeschluss;
  if (ende && jetzt > new Date(ende.length === 10 ? ende + 'T23:59:59.999' : ende))
    return `Anmeldung geschlossen (seit ${ende.split('-').reverse().join('.')})`;
  return null;
}
