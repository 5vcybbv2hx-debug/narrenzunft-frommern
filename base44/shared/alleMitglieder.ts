/**
 * Lädt ALLE Mitglieder seitenweise.
 *
 * Hintergrund: `Mitglied.list({ limit: 500 })` liefert in SDK 0.8.25 nur die
 * Standardseite (ca. 50 Datensätze) – der limit-Wert wird dabei ignoriert.
 * Dadurch wurden E-Mail-Zuordnungen nur gegen die ersten Profile geprüft und
 * schlugen für alle weiter hinten liegenden Mitglieder fehl (z. B. Simone
 * Eppler, Hanna Pelludat). Echtes Blättern über list(sort, limit, skip) behebt
 * das; die Sortierung nach 'id' hält die Seiten stabil.
 */
export async function ladeAlleMitglieder(S, seitenGroesse = 500) {
  const alle = [];
  let skip = 0;
  // Sicherheitsnetz gegen Endlosschleifen (bei ~50k Datensätzen abgebrochen)
  for (let runde = 0; runde < 100; runde++) {
    const seite = await S.entities.Mitglied.list('id', seitenGroesse, skip);
    const arr = Array.isArray(seite) ? seite : (seite?.items || []);
    alle.push(...arr);
    if (arr.length < seitenGroesse) break;
    skip += seitenGroesse;
  }
  return alle;
}