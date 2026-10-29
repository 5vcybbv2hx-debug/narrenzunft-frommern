// Bankverbindung/SEPA liegt in der eigenen, geschützten Entity 'MitgliedBankverbindung'.
// Grund: Die Mitglied-Entity ist für alle angemeldeten Konten lesbar — Bankdaten dürfen
// dort nicht mehr stehen. RLS der neuen Entity: nur admin, vorstand, stellv_vorstand, kassierer.
//
// Übergang: Solange die alten Felder auf 'Mitglied' noch existieren und die Migration
// noch nicht gelaufen ist, wird als Fallback von dort gelesen.
import { base44 } from '@/api/base44Client';

export const BANK_FELDER = ['kontoinhaber', 'bankname', 'iban', 'bic', 'sepa_mandatnummer', 'sepa_mandatdatum'];

const pick = (quelle) => {
  const out = {};
  BANK_FELDER.forEach((f) => { if (quelle?.[f] != null && quelle[f] !== '') out[f] = quelle[f]; });
  return out;
};

/** Bankdaten eines Mitglieds (null, wenn nichts hinterlegt oder keine Berechtigung). */
export async function ladeBankdaten(mitgliedId, altDaten = null) {
  if (!mitgliedId) return pick(altDaten);
  try {
    const treffer = await base44.entities.MitgliedBankverbindung.filter({ mitglied_id: mitgliedId });
    const daten = pick(treffer?.[0]);
    if (Object.keys(daten).length) return { ...daten, _quelle: 'neu' };
  } catch (e) {
    // Keine Berechtigung → bewusst leer (Mitglieder sehen keine Bankdaten)
    if (e?.response?.status === 403) return {};
    console.warn('Bankdaten laden:', e);
  }
  const alt = pick(altDaten);
  return Object.keys(alt).length ? { ...alt, _quelle: 'alt' } : {};
}

/** Bankdaten speichern (anlegen oder aktualisieren). */
export async function speichereBankdaten(mitgliedId, daten) {
  const inhalt = { mitglied_id: mitgliedId, ...pick(daten) };
  const treffer = await base44.entities.MitgliedBankverbindung.filter({ mitglied_id: mitgliedId });
  if (treffer?.[0]) return base44.entities.MitgliedBankverbindung.update(treffer[0].id, inhalt);
  return base44.entities.MitgliedBankverbindung.create(inhalt);
}

/** Alle Bankdatensätze (nur für Berechtigte) — für Exporte und Prüfungen. */
export async function ladeAlleBankdaten() {
  const alle = [];
  try {
    for (let skip = 0; skip < 5000; skip += 500) {
      const seite = await base44.entities.MitgliedBankverbindung.list('mitglied_id', 500, skip);
      if (!Array.isArray(seite) || !seite.length) break;
      seite.forEach((b) => alle.push(b));
      if (seite.length < 500) break;
    }
  } catch (e) {
    console.warn('Bankdaten-Liste:', e);
  }
  return alle;
}

/** Map mitglied_id → Bankdaten (für CSV-Export & Datenqualität). */
export async function bankdatenMap() {
  const alle = await ladeAlleBankdaten();
  const map = new Map();
  alle.forEach((b) => map.set(b.mitglied_id, b));
  return map;
}
