/**
 * Zentrale Berechtigungs-Hilfsfunktionen für den Mitgliederbereich.
 * Wird von mehreren sicheren Backend-Functions geteilt, damit die
 * Eigentümer-/Eltern-/Verwaltungs-Prüfung nicht dupliziert wird.
 *
 * WICHTIG: Bank-/IBAN-/SEPA-Felder werden hier NIE freigegeben. Die
 * Feld-Whitelist für Änderungsanträge enthält nur Kontakt-/Adressfelder.
 */

export const VERWALTUNG_ROLEN = ["admin", "vorstand", "stellv_vorstand"];
export const VORSTAND_ROLEN = ["admin", "vorstand"];

/** Erlaubte Felder für Selbstpflege-Änderungsanträge (keine Bankdaten!). */
export const ERLAUBTE_AENDERUNGS_FELDER = [
  "strasse", "plz", "ort",
  "telefon", "email",
  "notfallkontakt_name", "notfallkontakt_telefon",
];

/** Löst das zum eingeloggten User gehörende Mitglied auf. */
export async function loeseMeinMitglied(base44, user) {
  if (!user?.id) return null;
  try {
    const byUserId = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    if (byUserId && byUserId.length > 0) return byUserId[0];
  } catch (e) { console.error("loeseMeinMitglied byUserId:", e); }
  if (user.email) {
    try {
      const byEmail = await base44.asServiceRole.entities.Mitglied.filter({ email: user.email });
      if (byEmail && byEmail.length > 0) return byEmail[0];
    } catch (e) { console.error("loeseMeinMitglied byEmail:", e); }
  }
  return null;
}

export function istVerwaltung(user) {
  return VERWALTUNG_ROLEN.includes(user?.role);
}

export function istVorstand(user) {
  return VORSTAND_ROLEN.includes(user?.role);
}

/** Ist elternMitgliedId ein (Verwandtschaft-)Elternteil von kindMitgliedId? */
export async function istElternVon(base44, elternMitgliedId, kindMitgliedId) {
  if (!elternMitgliedId || !kindMitgliedId) return false;
  try {
    const rels = await base44.asServiceRole.entities.Verwandtschaft.filter({ mitglied_id: elternMitgliedId });
    return (rels || []).some(v => v.verwandter_id === kindMitgliedId && v.beziehung === "Kind");
  } catch (e) {
    console.error("istElternVon:", e);
    return false;
  }
}

/**
 * Darf der User das Profil von zielMitgliedId sehen / sensible Daten sehen?
 * Verwaltung: alles. Eigenes Profil: alles. Eltern für verknüpftes Kind:
 * sehen ja, aber NICHT sensible (Bank-)Daten.
 */
export async function darfMitgliedVollSehn(base44, user, meinMitglied, zielMitgliedId) {
  if (istVerwaltung(user)) return { darf: true, darfSensitive: true };
  if (meinMitglied && meinMitglied.id === zielMitgliedId) return { darf: true, darfSensitive: true };
  if (meinMitglied) {
    const isParent = await istElternVon(base44, meinMitglied.id, zielMitgliedId);
    if (isParent) return { darf: true, darfSensitive: false };
  }
  return { darf: false, darfSensitive: false };
}

/** Berechnet das Alter aus einem ISO-Geburtsdatum. */
export function alterAusGeburtsdatum(geburtsdatum) {
  if (!geburtsdatum) return null;
  const geb = new Date(geburtsdatum);
  if (isNaN(geb.getTime())) return null;
  const heute = new Date();
  let alter = heute.getFullYear() - geb.getFullYear();
  const m = heute.getMonth() - geb.getMonth();
  if (m < 0 || (m === 0 && heute.getDate() < geb.getDate())) alter--;
  return alter;
}

/** Status-Grenzen (gemäß Vorgabe). */
export const STATUS_GRENZEN = {
  "Kleinkind 0-3": { min: 0, max: 3 },
  "Kinder 4-10": { min: 4, max: 10 },
  "Jugendliche 11-14": { min: 11, max: 14 },
  "Jungaktive 15-17": { min: 15, max: 17 },
};

/** Schlägt den altersgemäßen Status vor. Ab 18 NICHT automatisch Aktiv. */
export function vorschlagStatusFuerAlter(geburtsdatum) {
  const alter = alterAusGeburtsdatum(geburtsdatum);
  if (alter === null) return null;
  for (const [status, g] of Object.entries(STATUS_GRENZEN)) {
    if (alter >= g.min && alter <= g.max) return { status, alter };
  }
  // Ab 18: kein automatischer Vorschlag — Vorstand entscheidet
  if (alter >= 18) return { status: null, alter, hinweis: "Ab 18 entscheidet der Vorstand (meist Aktiv)" };
  return null;
}

/** Prüft ob ein Mitgliedsstatus zum Alter passt (für Handlungsbedarf-Kachel). */
export function statusPasstZuAlter(geburtsdatum, mitgliedsstatus) {
  const alter = alterAusGeburtsdatum(geburtsdatum);
  if (alter === null || !mitgliedsstatus) return null;
  const grenz = STATUS_GRENZEN[mitgliedsstatus];
  if (!grenz) return null; // Aktiv/Passiv/Ehrenmitglied etc. nicht altersgebunden
  if (alter < grenz.min || alter > grenz.max) {
    return `Alter ${alter} passt nicht zu „${mitgliedsstatus}"`;
  }
  return null;
}

/** Mitglieder, die bald in die nächste Altersstufe wechseln (within 6 months). */
export function baldStatuswechsel(geburtsdatum, mitgliedsstatus) {
  const alter = alterAusGeburtsdatum(geburtsdatum);
  if (alter === null) return null;
  const heute = new Date();
  const geb = new Date(geburtsdatum);
  if (isNaN(geb.getTime())) return null;
  // Nächster Geburtstag
  const naechste = new Date(heute.getFullYear(), geb.getMonth(), geb.getDate());
  if (naechste < heute) naechste.setFullYear(naechste.getFullYear() + 1);
  const tageBisGeburtstag = Math.ceil((naechste - heute) / (1000 * 60 * 60 * 24));
  const wirdAlter = alter + (naechste.getFullYear() > heute.getFullYear() ? 1 : 0);
  // Prüfe ob das werdende Alter eine Stufengrenze überschreitet
  let zielStatus = null;
  for (const [status, g] of Object.entries(STATUS_GRENZEN)) {
    if (wirdAlter === g.min && mitgliedsstatus !== status && (alter < g.min)) {
      zielStatus = status;
      break;
    }
  }
  // Sonderfall: 17 -> 18 (Jungaktiv -> Entscheidung Vorstand)
  if (alter === 17 && wirdAlter === 18 && mitgliedsstatus === "Jungaktive 15-17") {
    return { tageBisGeburtstag, wirdAlter, zielStatus: null, hinweis: "Volljährigkeit – Vorstand entscheidet über Aktiv-Status" };
  }
  if (zielStatus) {
    return { tageBisGeburtstag, wirdAlter, zielStatus };
  }
  return null;
}