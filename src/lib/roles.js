/**
 * Rollen-System für Narrenzunft App
 *
 * Rollen (in user.role gespeichert):
 * - vorstand
 * - stellv_vorstand  (Stellvertretender Vorstand)
 * - kassierer
 * - spartenleiter
 * - mitglied
 *
 * Um weitere Rollen hinzuzufügen:
 * 1. Neuen Eintrag in ROLLEN und ROLLEN_LABELS ergänzen
 * 2. Gewünschte Berechtigungsfunktionen unten erweitern
 */

export const ROLLEN = {
  VORSTAND:       'vorstand',
  STELLV_VORSTAND:'stellv_vorstand',
  KASSIERER:      'kassierer',
  SPARTENLEITER:  'spartenleiter',
  MITGLIED:       'mitglied',
};

export const ROLLEN_LABELS = {
  vorstand:        'Vorstand',
  stellv_vorstand: 'Stv. Vorstand',
  kassierer:       'Kassierer',
  spartenleiter:   'Spartenleiter',
  mitglied:        'Mitglied',
  // Legacy-Fallbacks (Base44 Standard-Rollen)
  admin:           'Admin',
  user:            'Mitglied',
};

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Vollzugriff: Vorstand + Stv. Vorstand */
export function isAdmin(user) {
  return ['vorstand', 'stellv_vorstand', 'admin'].includes(user?.role);
}

/** Nur Vorstand */
export function isVorstand(user) {
  return user?.role === 'vorstand';
}

/** Finanzzugriff: Vorstand + Kassierer */
export function kannBankdatenSehn(user) {
  return ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'].includes(user?.role);
}

export function kannBeitraegeVerwalten(user) {
  return ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'].includes(user?.role);
}

/** Mitgliederliste sehen */
export function kannMitgliederlisteSehn(user) {
  return ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter', 'admin'].includes(user?.role);
}

/** Arbeitsdienste verwalten */
export function kannArbeitsdiensteVerwalten(user) {
  return ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'].includes(user?.role);
}

/** Check-In bei Veranstaltungen */
export function kannCheckinDurchfuehren(user) {
  return ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'].includes(user?.role);
}

/** Ehrungen verwalten */
export function kannEhrungenVerwalten(user) {
  return ['vorstand', 'stellv_vorstand', 'admin'].includes(user?.role);
}

export function getRollenLabel(role) {
  return ROLLEN_LABELS[role] || role || 'Mitglied';
}