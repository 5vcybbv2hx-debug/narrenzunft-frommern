/**
 * Rollen-System für Narrenzunft App
 *
 * Rollen (in user.role gespeichert):
 * - admin            (Plattform-Admin / Entwickler)
 * - vorstand
 * - stellv_vorstand
 * - kassierer
 * - spartenleiter
 * - mitglied
 * - elternkonto
 *
 * Ausschusszugang wird NICHT über die Rolle gesteuert,
 * sondern über AusschussMitglied-Einträge in der Datenbank.
 * Spartenleiter sind kein automatischer Ausschuss-Zugang.
 */

export const ROLLEN = {
  ADMIN:           'admin',
  VORSTAND:        'vorstand',
  STELLV_VORSTAND: 'stellv_vorstand',
  KASSIERER:       'kassierer',
  SPARTENLEITER:   'spartenleiter',
  MITGLIED:        'mitglied',
  ELTERNKONTO:     'elternkonto',
};

export const ROLLEN_LABELS = {
  vorstand:        'Vorstand',
  stellv_vorstand: 'Stv. Vorstand',
  kassierer:       'Kassierer',
  spartenleiter:   'Spartenleiter',
  mitglied:        'Mitglied',
  elternkonto:     'Elternkonto',
  // Legacy-Fallbacks (Base44 Standard-Rollen)
  admin:           'Admin',
  user:            'Mitglied',
};

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Developer-Status (Sonderstatus für App-Entwickler – nur diese Email) */
export function isDeveloper(user) {
  return user?.email === 'info@savo-lounge-club.de';
}

/** Vollzugriff: Vorstand + Stv. Vorstand + Developer */
export function isAdmin(user) {
  return ['vorstand', 'stellv_vorstand', 'admin'].includes(user?.role) || isDeveloper(user);
}

/** Nur Vorstand */
export function isVorstand(user) {
  return user?.role === 'vorstand';
}

/** Finanzzugriff: Vorstand + Kassierer + Developer */
export function kannBankdatenSehn(user) {
  return ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'].includes(user?.role) || isDeveloper(user);
}

export function kannBeitraegeVerwalten(user) {
  return ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'].includes(user?.role) || isDeveloper(user);
}

/** Mitgliederliste sehen */
export function kannMitgliederlisteSehn(user) {
  return ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter', 'admin'].includes(user?.role) || isDeveloper(user);
}

/** Arbeitsdienste verwalten */
export function kannArbeitsdiensteVerwalten(user) {
  return ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'].includes(user?.role) || isDeveloper(user);
}

/** Check-In bei Veranstaltungen */
export function kannCheckinDurchfuehren(user) {
  return ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'].includes(user?.role) || isDeveloper(user);
}

/** Ehrungen verwalten */
export function kannEhrungenVerwalten(user) {
  return ['vorstand', 'stellv_vorstand', 'admin'].includes(user?.role) || isDeveloper(user);
}

export function getRollenLabel(role) {
  return ROLLEN_LABELS[role] || role || 'Mitglied';
}

/** Nur einfaches Mitglied oder Elternkonto – kein erweiterter Zugriff (Developer hat Zugriff) */
export function istNurMitglied(user) {
  if (isDeveloper(user)) return false; // Developer hat immer Zugriff
  return ['mitglied', 'elternkonto', 'user'].includes(user?.role);
}

/** Darf dieses Mitglied-Profil sehen?
 *  - Admin/Vorstand: immer
 *  - Spartenleiter/Kassierer: immer
 *  - Elternkonto: nur wenn gleiche familie_id
 *  - Mitglied: nur eigenes Profil
 */
export function kannMitgliedProfilSehn(user, myMitglied, zielMitglied) {
  if (!istNurMitglied(user)) return true; // Admin etc. dürfen alles
  if (!myMitglied || !zielMitglied) return false;
  if (myMitglied.id === zielMitglied.id) return true; // eigenes Profil
  if (user?.role === 'elternkonto' && myMitglied.familie_id && myMitglied.familie_id === zielMitglied.familie_id) return true;
  return false;
}

/**
 * Ausschuss-Zugang:
 * Nur vorstand, stellv_vorstand, admin – NICHT pauschal spartenleiter.
 * Spartenleiter brauchen einen AusschussMitglied-Eintrag (wird serverseitig geprüft).
 */
export function kannAusschussSehn(user) {
  return ['vorstand', 'stellv_vorstand', 'admin'].includes(user?.role) || isDeveloper(user);
}

/** Darf Importe durchführen (nur Admin) */
export function kannImportieren(user) {
  return user?.role === 'admin' || isDeveloper(user);
}