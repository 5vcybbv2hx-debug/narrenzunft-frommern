/**
 * Rollen-System für Narrenzunft App
 * 
 * Rollen (in user.role gespeichert):
 * - superadmin
 * - admin (Vorstand)
 * - verantwortlicher
 * - busverantwortlicher
 * - dienstverantwortlicher
 * - mitglied
 * - eltern
 */

export const ROLLEN = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  VERANTWORTLICHER: 'verantwortlicher',
  BUSVERANTWORTLICHER: 'busverantwortlicher',
  DIENSTVERANTWORTLICHER: 'dienstverantwortlicher',
  MITGLIED: 'mitglied',
  ELTERN: 'eltern',
};

export const ROLLEN_LABELS = {
  superadmin: 'Superadmin',
  admin: 'Vorstand/Admin',
  verantwortlicher: 'Verantwortlicher',
  busverantwortlicher: 'Busverantwortlicher',
  dienstverantwortlicher: 'Dienstverantwortlicher',
  mitglied: 'Mitglied',
  eltern: 'Elternkonto',
  user: 'Mitglied', // Legacy-Fallback
};

// Hilfsfunktionen
export function isAdmin(user) {
  return user?.role === 'admin' || user?.role === 'superadmin';
}

export function isSuperAdmin(user) {
  return user?.role === 'superadmin';
}

export function isVerantwortlicher(user) {
  return ['admin', 'superadmin', 'verantwortlicher'].includes(user?.role);
}

export function isBusVerantwortlicher(user) {
  return ['admin', 'superadmin', 'busverantwortlicher'].includes(user?.role);
}

export function isDienstVerantwortlicher(user) {
  return ['admin', 'superadmin', 'dienstverantwortlicher', 'verantwortlicher'].includes(user?.role);
}

export function isEltern(user) {
  return user?.role === 'eltern';
}

export function kannMitgliederlisteSehn(user) {
  return ['admin', 'superadmin', 'verantwortlicher', 'dienstverantwortlicher', 'busverantwortlicher'].includes(user?.role);
}

export function kannBankdatenSehn(user) {
  return ['admin', 'superadmin'].includes(user?.role);
}

export function kannCheckinDurchfuehren(user) {
  return ['admin', 'superadmin', 'verantwortlicher', 'busverantwortlicher'].includes(user?.role);
}

export function kannArbeitsdiensteVerwalten(user) {
  return ['admin', 'superadmin', 'dienstverantwortlicher', 'verantwortlicher'].includes(user?.role);
}

export function getRollenLabel(role) {
  return ROLLEN_LABELS[role] || role || 'Mitglied';
}