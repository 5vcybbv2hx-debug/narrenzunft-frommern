/**
 * E-Mail-Schluessel fuer den Profilabgleich.
 *
 * Bei Google sind @googlemail.com und @gmail.com dasselbe Postfach, und Punkte
 * im Namen sind egal (max.mustermann == maxmustermann). Genau daran scheiterte
 * die Auto-Verknuepfung (Fall Melanie Glaser-Selg: Profil @gmail.com, Login
 * @googlemail.com). Andere Anbieter bleiben unveraendert, dort zaehlen Punkte.
 */
export function emailSchluessel(email) {
  const roh = String(email || "").trim().toLowerCase();
  const at = roh.lastIndexOf("@");
  if (at < 1) return roh;
  let local = roh.slice(0, at);
  let domain = roh.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}
