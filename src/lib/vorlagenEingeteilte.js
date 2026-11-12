/**
 * Eingeteilte Personen aus Veranstaltungsvorlagen auflösen.
 *
 * Die Vorlagen (Veranstaltungsvorlage.eingeteilte_je_dienst) enthalten die
 * Personen je Arbeitsdienst als Namen, so wie sie in den historischen
 * Arbeitseinteilungen standen. Beim Anlegen einer Veranstaltung werden sie hier
 * gegen die Mitgliederliste aufgelöst und als ArbeitsdienstZuweisung angelegt.
 *
 * Warum Namen und keine IDs: Die Vorlagen stammen aus PDFs, in denen
 * Schreibweisen schwanken (Reuss/Reuß, Faiss/Faiß, Leo/Leonard). Eine
 * Auflösung zur Laufzeit gegen die echte Mitgliederliste ist robuster als
 * einmal gespeicherte IDs. Mehrdeutige Namen werden NICHT geraten, sondern
 * zurückgemeldet, damit der Vorstand sie einmal antippt.
 */

export function normalisiereName(wert) {
  return String(wert || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/ph/g, 'f')      // Stephanie -> Stefanie
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

/** Editierabstand (Levenshtein) für Tippfehler und Schreibvarianten. */
function abstand(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let vorher = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const aktuell = [i];
    for (let j = 1; j <= n; j++) {
      aktuell[j] = Math.min(
        vorher[j] + 1,
        aktuell[j - 1] + 1,
        vorher[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    vorher = aktuell;
  }
  return vorher[n];
}

/** Kandidaten für einen Namensstring (kann auch "Kim Eppler (Leiter)" sein). */
export function findeMitglieder(name, mitglieder) {
  const ziel = normalisiereName(name);
  if (!ziel) return [];
  const alle = mitglieder || [];

  // 1) Exakte Volltreffer
  const exakt = alle.filter(m => normalisiereName(`${m.vorname || ''} ${m.nachname || ''}`) === ziel);
  if (exakt.length) return exakt;

  // 2) Nachname exakt enthalten, Vorname mit gleichem Anfang (Leo → Leonard)
  const teile = ziel.split(' ').filter(Boolean);
  const stufe2 = alle.filter(m => {
    const nn = normalisiereName(m.nachname);
    const vn = normalisiereName(m.vorname);
    if (!nn || !vn) return false;
    const nachnamePasst = teile.includes(nn) || nn.split(' ').some(t => teile.includes(t));
    const vornamePasst = teile.some(t => t === vn || (t.length > 2 && vn.startsWith(t)) || (vn.length > 2 && t.startsWith(vn)));
    return nachnamePasst && vornamePasst;
  });
  if (stufe2.length) return stufe2;

  // 3) Schreibvarianten und Tippfehler: Nachname exakt, Vorname maximal 2
  //    Buchstaben entfernt (Luis/Louis, Maik/Mike, Luippold/Luipold).
  return alle.filter(m => {
    const nn = normalisiereName(m.nachname);
    const vn = normalisiereName(m.vorname);
    if (!nn || !vn) return false;
    const nachnamePasst = teile.includes(nn) || abstand(nn, teile[teile.length - 1]) <= 1;
    if (!nachnamePasst) return false;
    return teile.some(t => t !== nn && abstand(vn, t) <= 2);
  });
}

/**
 * @param {Array<{titel:string, eingeteilte_namen?:string[]}>} dienste
 * @param {Array} mitglieder
 * @returns {{zuweisungen: Array<{dienst_titel:string, mitglied_id:string, mitglied_name:string}>,
 *            mehrdeutig: Array<{dienst_titel:string, name:string, kandidaten:string[]}>,
 *            unbekannt: Array<{dienst_titel:string, name:string}>}}
 */
export function loeseEingeteilteAuf(dienste, mitglieder) {
  const zuweisungen = [];
  const mehrdeutig = [];
  const unbekannt = [];
  const gesehen = new Set();

  (dienste || []).forEach(dienst => {
    const titel = dienst.titel || '';
    (dienst.eingeteilte_namen || []).forEach(name => {
      const kandidaten = findeMitglieder(name, mitglieder);
      if (kandidaten.length === 1) {
        const m = kandidaten[0];
        const schluessel = `${titel}|${m.id}`;
        if (gesehen.has(schluessel)) return;
        gesehen.add(schluessel);
        zuweisungen.push({
          dienst_titel: titel,
          mitglied_id: m.id,
          mitglied_name: `${m.vorname || ''} ${m.nachname || ''}`.trim(),
        });
      } else if (kandidaten.length > 1) {
        mehrdeutig.push({
          dienst_titel: titel,
          name,
          kandidaten: kandidaten.map(k => `${k.vorname || ''} ${k.nachname || ''}`.trim()),
        });
      } else {
        unbekannt.push({ dienst_titel: titel, name });
      }
    });
  });

  return { zuweisungen, mehrdeutig, unbekannt };
}
