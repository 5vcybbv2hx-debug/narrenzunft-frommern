/**
 * Frontend-Gegenstueck zu base44/shared/emailSchluessel.ts.
 *
 * Bei Google sind @googlemail.com und @gmail.com dasselbe Postfach, und Punkte
 * im Namen spielen keine Rolle. Genau daran scheitert sonst der Profilabgleich:
 * Profil mit max.mustermann@gmail.com, Login mit max.mustermann@googlemail.com.
 * Bei allen anderen Anbietern bleibt die Adresse unveraendert, dort zaehlen Punkte.
 */
export function emailSchluessel(email) {
  const roh = String(email || '').trim().toLowerCase();
  const at = roh.lastIndexOf('@');
  if (at < 1) return roh;
  let local = roh.slice(0, at);
  let domain = roh.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

/** Zwei Adressen gehoeren (aus Sicht des Logins) zum selben Postfach. */
export function gleicheAdresse(a, b) {
  return emailSchluessel(a) === emailSchluessel(b);
}
