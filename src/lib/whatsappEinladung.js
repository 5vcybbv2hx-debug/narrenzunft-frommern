// WhatsApp-Einladungen: Link + Textbaustein für wa.me.
// Die App kann WhatsApp nicht selbst anschreiben (kein Opt-in) —
// dieser Helfer öffnet WhatsApp mit fertiger Nachricht an die hinterlegte
// Nummer; gesendet wird bewusst aus dem eigenen WhatsApp des Vorstands.

export const APP_URL = 'https://narrenzunft-frommern.base44.app';

// Anleitung als PDF (Registrieren + Installieren, mit QR-Code). Wird in der
// Einladung mitgeschickt, weil wa.me nur Text uebertragen kann, keine Anhaenge.
export const ANLEITUNG_PDF_URL = 'https://media.base44.com/files/public/6a216d71b6fcba886566ffb1/a0b1b629abb7e8e52e8b76d355eaef99_Zunft-App-Anleitung.pdf';

/** Normalisiert eine deutsche Telefonnummer auf internationale Ziffern (wa.me-Format). */
export function waNummer(telefon) {
  if (!telefon) return null;
  let c = String(telefon).replace(/[^\d]/g, '');
  if (c.startsWith('00')) c = c.substring(2);
  if (c.startsWith('0')) c = '49' + c.substring(1);
  return c.length >= 8 ? c : null;
}

/** Einladungstext – mit E-Mail-Adresse, wenn vorhanden. */
export function baueEinladungstext({ vorname = '', email = '' } = {}) {
  const anrede = vorname ? `Hallo ${vorname},` : 'Hallo,';
  const mailZeile = email
    ? `2. Registriere dich mit dieser E-Mail-Adresse: ${email}`
    : '2. Registriere dich mit deiner E-Mail-Adresse';
  return `${anrede}

wir laden dich herzlich in die neue Narrenzunft-Frommern-App ein! Dort findest du Termine, Ausfahrten, Arbeitsdienste und dein Profil.

1. Öffne: ${APP_URL}
${mailZeile}
3. Danach wird dein Profil automatisch zugeordnet.

Anleitung zum Installieren (PDF, mit QR-Code): ${ANLEITUNG_PDF_URL}

Viele Grüße
Narrenzunft Frommern`;
}

/** wa.me-Link mit vorausgefüllter Einladung; null, wenn keine gültige Nummer.
 *  Akzeptiert beide Aufrufarten: waEinladungsLink({ telefon, vorname }) und waEinladungsLink(telefon, vorname). */
export function waEinladungsLink(daten = {}, vornameAlt = '') {
  const { telefon, vorname = vornameAlt, email = '' } = typeof daten === 'string' || typeof daten === 'number'
    ? { telefon: daten, vorname: vornameAlt }
    : (daten || {});
  const nr = waNummer(telefon);
  if (!nr) return null;
  return `https://wa.me/${nr}?text=${encodeURIComponent(baueEinladungstext({ vorname, email }))}`;
}