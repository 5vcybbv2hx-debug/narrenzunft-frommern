/**
 * Rollen-System für Narrenzunft App
 *
 * Rollen (in user.role gespeichert):
 * - admin            (Plattform-Admin / Entwickler)
 * - vorstand
 * - stellv_vorstand
 * - kassierer
 * - kassenpruefer   (Kassenprüfer: nur Lesen, kein Buchen)
 * - spartenleiter
 * - mitglied
 *
 * Ausschusszugang: Spartenleiter sind automatisch Ausschussmitglieder.
 */

export const ROLLEN = {
  ADMIN:           'admin',
  VORSTAND:        'vorstand',
  STELLV_VORSTAND: 'stellv_vorstand',
  KASSIERER:       'kassierer',
  KASSENPRUEFER:   'kassenpruefer',
  SPARTENLEITER:   'spartenleiter',
  MITGLIED:        'mitglied',
};

export const ROLLEN_LABELS = {
  vorstand:        'Vorstand',
  stellv_vorstand: 'Stv. Vorstand',
  kassierer:       'Kassierer',
  kassenpruefer:   'Kassenprüfer',
  spartenleiter:   'Spartenleiter',
  mitglied:        'Mitglied',
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
/**
 * Effektive Rolle für Rechteprüfungen.
 *
 * Die Login-Rolle wird von der Verwaltung gesetzt; bei Spartenleiter-Konten
 * steht dort häufig noch 'user'/'mitglied', obwohl das Mitgliedsprofil
 * app_rolle = 'spartenleiter' trägt. Für Gruppenrechte zählt die tatsächliche
 * Gruppenverantwortung. Deshalb wird hier ausschließlich 'spartenleiter'
 * nachgezogen – Vorstands- und Adminrechte werden NIE aus app_rolle abgeleitet.
 */
export function effektiveRolle(user) {
  const rolle = user?.role || 'mitglied';
  const appRolle = user?._mitglied?.app_rolle;
  if (appRolle === 'spartenleiter' && ['', 'user', 'mitglied'].includes(rolle)) return 'spartenleiter';
  return rolle;
}

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

/** Kassenbuch lesen: Finanzrollen + Kassenprüfer (Prüfer nur lesend). */
export function kannKasseSehn(user) {
  return ['vorstand', 'stellv_vorstand', 'kassierer', 'kassenpruefer', 'admin'].includes(user?.role) || isDeveloper(user);
}

/** Kassenbuch buchen/stornieren: Kassenprüfer bewusst NICHT. */
export function kannKasseBuchen(user) {
  return ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'].includes(user?.role) || isDeveloper(user);
}

/** Ist die Person ausschließlich prüfend (dann nur Leserechte prüfen)? */
export function istKassenpruefer(user) {
  return user?.role === 'kassenpruefer';
}

export function kannBeitraegeVerwalten(user) {
  return ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'].includes(user?.role) || isDeveloper(user);
}

/** Mitgliederliste sehen */
export function kannMitgliederlisteSehn(user) {
  return ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter', 'admin'].includes(effektiveRolle(user)) || isDeveloper(user);
}

/** Arbeitsdienste verwalten */
export function kannArbeitsdiensteVerwalten(user) {
  return ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'].includes(effektiveRolle(user)) || isDeveloper(user);
}

/** Check-In bei Veranstaltungen */
export function kannCheckinDurchfuehren(user) {
  return ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'].includes(effektiveRolle(user)) || isDeveloper(user);
}

/**
 * Check-In bei AUSFAHRTEN: nur Vorstand, Stellv. Vorstand und Admin.
 * Busverantwortliche kommen pro Ausfahrt hinzu (ausfahrt.bus_verantwortliche,
 * geprüft in der jeweiligen Seite). Spartenleiter sind bewusst NICHT enthalten.
 */
export function kannAusfahrtCheckin(user) {
  return ['vorstand', 'stellv_vorstand', 'admin'].includes(user?.role) || isDeveloper(user);
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
  // effektiveRolle: Gruppenverantwortliche mit Login-Rolle 'user'/'mitglied'
  // gelten als Spartenleiter und dürfen die Profile ihrer Gruppe öffnen.
  return ['mitglied', 'user'].includes(effektiveRolle(user));
}

/** Darf dieses Mitglied-Profil sehen?
 *  - Admin/Vorstand: immer
 *  - Spartenleiter/Kassierer: immer
 *  - Elternkonto: nur wenn gleiche familie_id
 *  - Mitglied: nur eigenes Profil
 */
export function kannMitgliedProfilSehn(user, myMitglied, zielMitglied, meineKinder = []) {
  if (!istNurMitglied(user)) return true; // Admin etc. dürfen alles
  if (!myMitglied || !zielMitglied) return false;
  if (myMitglied.id === zielMitglied.id) return true; // eigenes Profil
  // Eltern können Profile ihrer Kinder sehen (auf Basis Verwandtschaft)
  if (meineKinder.some(k => k === zielMitglied.id)) return true;
  return false;
}

/**
 * Ausschuss-Zugang:
 * Vorstand, Stv. Vorstand, Spartenleiter und Admin haben automatisch Ausschusszugang.
 * Ausschussmitglieder erhalten die Zusatz-Berechtigung 'ausschuss'
 * (wird beim Hinzufügen/Entfernen im Ausschuss automatisch synchronisiert, s. lib/ausschussSync.js).
 */
export function kannAusschussSehn(user) {
  if (isDeveloper(user)) return true;
  if (['vorstand', 'stellv_vorstand', 'admin'].includes(user?.role)) return true;
  if ((user?._mitglied?.zusatz_berechtigungen || []).includes('ausschuss')) return true;
  // Trainer:innen gehören nicht zum Ausschuss – auch nicht über den
  // abgeleiteten Zugang (Gruppenverantwortung). Ausdrückliche Freigabe
  // oben (Rolle/Zusatzrecht) sticht weiterhin.
  if (user?._mitglied?.ist_trainer === true) return false;
  return user?._mitglied?.ausschuss_berechtigt === true;
}

/** Darf Importe durchführen (nur Admin) */
export function kannImportieren(user) {
  return user?.role === 'admin' || isDeveloper(user);
}

/** Internen Bedarf / Shop verwalten (Vorstand + Admin + zugewiesene Zuständige) */
export function kannShopVerwalten(user) {
  return ['vorstand', 'admin'].includes(user?.role)
    || isDeveloper(user)
    || (user?._mitglied?.zusatz_berechtigungen || []).includes('shop');
}

/** Inventar & Verleih sehen/verwalten */
export function kannInventarSehn(user) {
  return ['vorstand', 'stellv_vorstand', 'admin'].includes(user?.role) ||
    isDeveloper(user) ||
    (user?._mitglied?.zusatz_berechtigungen || []).includes('inventar');
}

/** Hilfsfunktion: Hat Mitglied eine bestimmte Zusatz-Berechtigung? */
export function hatZusatzBerechtigung(mitglied, berechtigung) {
  return (mitglied?.zusatz_berechtigungen || []).includes(berechtigung);
}