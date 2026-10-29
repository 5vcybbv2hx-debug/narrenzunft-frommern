// Rechnungen aus Verleih-Daten: Vereinsdaten, fortlaufende Nummer, Betrag, PDF.
import { base44 } from '@/api/base44Client';

const SCHLUESSEL = 'rechnung';

export const STANDARD_RECHNUNGSDATEN = {
  firma: 'Narrenzunft Frommern e.V.',
  zusatz: '',
  strasse: '',
  plz: '',
  ort: '',
  telefon: '',
  email: '',
  steuernummer: '',
  ust_id: '',
  kleinunternehmer: true, // § 19 UStG: keine USt wird ausgewiesen
  iban: '',
  bic: '',
  bank: '',
  registergericht: '',
  registersnummer: '',
  vertreten_durch: '',
  zahlungsziel_tage: 14,
  fusstext: 'Vielen Dank für euren Auftrag und viel Freude mit dem Ausleihgegenstand!',
};

/** Gespeicherte Rechnungsdaten (AppEinstellung.schluessel = 'rechnung'). */
export async function ladeRechnungsdaten() {
  try {
    const treffer = await base44.entities.AppEinstellung.filter({ schluessel: SCHLUESSEL });
    const wert = treffer?.[0]?.wert_json;
    const daten = typeof wert === 'string' ? JSON.parse(wert || '{}') : (wert || {});
    return { ...STANDARD_RECHNUNGSDATEN, ...daten };
  } catch (e) {
    console.warn('Rechnungsdaten nicht lesbar:', e);
    return { ...STANDARD_RECHNUNGSDATEN };
  }
}

export async function speichereRechnungsdaten(daten) {
  const treffer = await base44.entities.AppEinstellung.filter({ schluessel: SCHLUESSEL });
  const inhalt = { wert_json: JSON.stringify(daten) };
  if (treffer?.[0]) return base44.entities.AppEinstellung.update(treffer[0].id, inhalt);
  return base44.entities.AppEinstellung.create({ schluessel: SCHLUESSEL, ...inhalt });
}

/** Fortlaufende Rechnungsnummer im Format JJJJ-NNNN (Zähler je Jahr). */
export async function naechsteRechnungsnummer() {
  const jahr = new Date().getFullYear();
  try {
    const treffer = await base44.entities.AppEinstellung.filter({ schluessel: 'rechnungszaehler' });
    const roh = treffer?.[0]?.wert_json;
    const zaehler = typeof roh === 'string' ? JSON.parse(roh || '{}') : (roh || {});
    const stand = Number(zaehler.jahr) === jahr ? Number(zaehler.naechste || 0) : 0;
    const naechste = stand + 1;
    const inhalt = { wert_json: JSON.stringify({ jahr, naechste }) };
    if (treffer?.[0]) await base44.entities.AppEinstellung.update(treffer[0].id, inhalt);
    else await base44.entities.AppEinstellung.create({ schluessel: 'rechnungszaehler', ...inhalt });
    return `${jahr}-${String(naechste).padStart(4, '0')}`;
  } catch (e) {
    console.warn('Rechnungsnummer:', e);
    return `${jahr}-${String(Date.now()).slice(-4)}`;
  }
}

/** Tage eines Ausleihzeitraums (mindestens 1). */
export function tageVon(von, bis) {
  if (!von || !bis) return 1;
  return Math.max(1, Math.round((new Date(bis) - new Date(von)) / 86400000) + 1);
}

/**
 * Betrag einer Ausleihe.
 * preis_modus = 'veranstaltung' → der Preis gilt pauschal für den Zeitraum,
 * sonst pro Tag (× Anzahl Tage).
 */
export function betragVon(ausleihe, ausruestung) {
  if (!ausleihe) return { modus: 'tag', einzelpreis: 0, tage: 1, gesamt: 0 };
  const modus = ausleihe.preis_modus === 'veranstaltung' ? 'veranstaltung' : 'tag';
  const vereinbart = Number(ausleihe.vereinbarter_preis);
  const einzelpreis = Number.isFinite(vereinbart) && vereinbart >= 0
    ? vereinbart
    : Number(ausruestung?.verleih_preis ?? 0);
  const tage = tageVon(ausleihe.von_datum, ausleihe.bis_datum);
  const gesamt = modus === 'veranstaltung' ? einzelpreis : einzelpreis * tage;
  return { modus, einzelpreis, tage, gesamt };
}

const eur = (v) => Number(v || 0).toFixed(2).replace('.', ',') + ' €';
const datumDe = (iso) => {
  if (!iso) return '';
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso);
};

/**
 * Rechnungs-PDF als jsPDF-Dokument (A4, Pflichtangaben nach § 14 UStG).
 * Gibt das doc-Objekt zurück; Speichern/Upload macht der Aufrufer.
 */
export async function erzeugeRechnungsPdf({
  daten, nummer, rechnungsdatum, empfaenger, zeitraum, position, gesamt, kaution = 0, zweck = '', notiz = '', modus = 'tag',
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const RAND = 18;
  const BREITE = 210 - 2 * RAND;
  let y = 20;

  // Kopf: Absender
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(daten.firma || 'Verein', RAND, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y += 5;
  const absenderZeilen = [
    daten.zusatz,
    [daten.strasse, [daten.plz, daten.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    [daten.telefon && `Tel. ${daten.telefon}`, daten.email].filter(Boolean).join(' · '),
  ].filter(Boolean);
  absenderZeilen.forEach((z) => { doc.text(String(z), RAND, y); y += 4.4; });

  // Titel rechts
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('RECHNUNG', 210 - RAND, 24, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Rechnungs-Nr. ${nummer}`, 210 - RAND, 30, { align: 'right' });
  doc.text(`Datum: ${datumDe(rechnungsdatum)}`, 210 - RAND, 34.5, { align: 'right' });

  y = Math.max(y, 42) + 8;

  // Empfänger
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Rechnungsempfänger', RAND, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  const empfZeilen = [
    empfaenger?.name, empfaenger?.strasse,
    [empfaenger?.plz, empfaenger?.ort].filter(Boolean).join(' '),
    empfaenger?.email,
  ].filter(Boolean);
  (empfZeilen.length ? empfZeilen : ['(keine Anschrift hinterlegt)']).forEach((z) => {
    doc.text(String(z), RAND, y); y += 4.6;
  });

  y += 8;

  // Tabelle
  const spVorn = RAND, spMitte = RAND + BREITE * 0.62, spHinten = 210 - RAND;
  doc.setFillColor(234, 37, 37);
  doc.rect(RAND, y, BREITE, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Leistung', spVorn + 2, y + 4.8);
  doc.text('Betrag', spHinten - 2, y + 4.8, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const beschreibung = [
    position || 'Ausleihgegenstand',
    `Zeitraum: ${datumDe(zeitraum?.von)} bis ${datumDe(zeitraum?.bis)}`,
    modus === 'veranstaltung'
      ? 'Abrechnung: pauschal für den Veranstaltungszeitraum'
      : `Abrechnung: ${eur(gesamt / Math.max(1, zeitraum?.tage || 1))} pro Tag × ${zeitraum?.tage || 1} Tag(e)`,
    zweck ? `Zweck: ${zweck}` : '',
  ].filter(Boolean);
  const textZeilen = beschreibung.flatMap((z) => doc.splitTextToSize(z, BREITE * 0.6));
  const zeilenHoehe = 4.6;
  const blockHoehe = Math.max(9, textZeilen.length * zeilenHoehe + 4);
  doc.rect(RAND, y, BREITE, blockHoehe);
  textZeilen.forEach((z, i) => doc.text(String(z), spVorn + 2, y + 5 + i * zeilenHoehe));
  doc.text(eur(gesamt), spHinten - 2, y + 5, { align: 'right' });
  y += blockHoehe + 4;

  // Summen
  const summeZeile = (label, wert, fett = false) => {
    doc.setFont('helvetica', fett ? 'bold' : 'normal');
    doc.setFontSize(fett ? 11 : 9.5);
    doc.text(label, spMitte, y);
    doc.text(wert, spHinten, y, { align: 'right' });
    y += fett ? 6.5 : 5;
  };
  summeZeile('Nettobetrag', eur(gesamt));
  if (daten.kleinunternehmer) {
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.text('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).', RAND, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  } else {
    summeZeile('Umsatzsteuer', 'gemäß gesetzlichem Steuersatz');
  }
  summeZeile('Rechnungsbetrag', eur(gesamt), true);
  if (kaution > 0) {
    doc.setFontSize(9);
    doc.text(`zzgl. Kaution (rückzahlbar): ${eur(kaution)}`, spMitte, y);
    y += 6;
  }

  y += 4;
  // Pflichtangaben
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  const pflicht = [
    daten.steuernummer ? `Steuernummer: ${daten.steuernummer}` : '',
    daten.ust_id ? `USt-IdNr.: ${daten.ust_id}` : '',
    daten.iban ? `Zahlung bis ${datumDe(new Date(Date.now() + Number(daten.zahlungsziel_tage || 14) * 86400000).toISOString())} auf: ${daten.firma} · IBAN ${daten.iban}${daten.bic ? ` · BIC ${daten.bic}` : ''}${daten.bank ? ` (${daten.bank})` : ''}` : '',
    notiz ? `Hinweis: ${notiz}` : '',
    [daten.registergericht, daten.registersnummer].filter(Boolean).length
      ? `Registereintrag: ${[daten.registergericht, daten.registersnummer].filter(Boolean).join(', ')}` : '',
    daten.vertreten_durch ? `Vertreten durch: ${daten.vertreten_durch}` : '',
  ].filter(Boolean);
  pflicht.forEach((z) => {
    const zeilen = doc.splitTextToSize(z, BREITE);
    zeilen.forEach((zz) => { doc.text(String(zz), RAND, y); y += 4.2; });
  });

  if (daten.fusstext) {
    y += 4;
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    doc.splitTextToSize(daten.fusstext, BREITE).forEach((zz) => { doc.text(String(zz), RAND, y); y += 4.4; });
  }

  return doc;
}