/**
 * Zentrale Ehrungsberechnungslogik – Narrenzunft App
 *
 * Diese Datei ist die einzige Wahrheitsquelle für alle Ehrungsberechnungen.
 * Sie wird im Mitgliederprofil, Ehrungs-Dashboard, Admin-Dashboard und Export genutzt.
 */

import { differenceInYears, differenceInDays, parseISO, isValid, isAfter } from 'date-fns';

// ── Konstanten ────────────────────────────────────────────────────────────────

export const MITGLIEDSJAHRE_STUFEN = [10, 20, 30, 40, 50, 60, 70, 80];
export const UMZUGS_STUFEN = [66, 99, 133, 166, 199, 222, 266, 299, 333];

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return isValid(d) ? d : null;
}

// ── Mitgliedsjahre berechnen ─────────────────────────────────────────────────

/**
 * Berechnet anrechenbare Mitgliedsjahre (ab 18. Geburtstag).
 *
 * @returns {Object} { jahre, startdatum, enddatum, fehler }
 */
export function berechneAnrechenbareMitgliedsjahre(mitglied) {
  const geburtsdatum = parseDate(mitglied?.geburtsdatum);
  const eintrittsdatum = parseDate(mitglied?.eintrittsdatum);
  const austrittsdatum = parseDate(mitglied?.austrittsdatum);
  const heute = new Date();

  if (!geburtsdatum) {
    return { jahre: null, startdatum: null, enddatum: null, fehler: 'Geburtsdatum fehlt' };
  }
  if (!eintrittsdatum) {
    return { jahre: null, startdatum: null, enddatum: null, fehler: 'Eintrittsdatum fehlt' };
  }

  // 18. Geburtstag berechnen
  const achtzehnterGeburtstag = new Date(
    geburtsdatum.getFullYear() + 18,
    geburtsdatum.getMonth(),
    geburtsdatum.getDate()
  );

  // Startdatum = max(eintrittsdatum, 18. Geburtstag)
  const startdatum = isAfter(eintrittsdatum, achtzehnterGeburtstag)
    ? eintrittsdatum
    : achtzehnterGeburtstag;

  // Enddatum = austrittsdatum oder heute
  const enddatum = austrittsdatum || heute;

  // Wenn Startdatum noch in der Zukunft liegt (Person noch keine 18)
  if (isAfter(startdatum, enddatum)) {
    return { jahre: 0, startdatum, enddatum, fehler: null };
  }

  const jahre = differenceInYears(enddatum, startdatum);

  return { jahre, startdatum, enddatum, fehler: null };
}

// ── Mitgliedsehrungen ────────────────────────────────────────────────────────

/**
 * Berechnet Ehrungsstatus für Mitgliedsjahre.
 *
 * @param {Object} mitglied
 * @param {Array} verlieheneEhrungen - Ehrung-Entitäten mit status="Verliehen" und typ="Mitgliedsjahre"
 * @returns {Object} Ehrungsstatus
 */
export function berechneMitgliedsEhrungen(mitglied, verlieheneEhrungen = []) {
  const { jahre, fehler } = berechneAnrechenbareMitgliedsjahre(mitglied);

  const verlieheneStuden = verlieheneEhrungen
    .filter(e => e.typ === 'Mitgliedsjahre' && e.status === 'Verliehen')
    .map(e => Number(e.wert));

  const faelligeStufen = [];
  const geplanteStuden = verlieheneEhrungen
    .filter(e => e.typ === 'Mitgliedsjahre' && e.status === 'Geplant')
    .map(e => Number(e.wert));

  let letzteStufe = null;
  let naechsteStufe = null;
  let jahreZurNaechsten = null;

  if (jahre !== null && !fehler) {
    for (const stufe of MITGLIEDSJAHRE_STUFEN) {
      if (jahre >= stufe) {
        letzteStufe = stufe;
        if (!verlieheneStuden.includes(stufe) && !geplanteStuden.includes(stufe)) {
          faelligeStufen.push(stufe);
        }
      } else {
        if (!naechsteStufe) {
          naechsteStufe = stufe;
          jahreZurNaechsten = stufe - jahre;
        }
      }
    }
  }

  return {
    jahre,
    fehler,
    letzteStufe,
    naechsteStufe,
    jahreZurNaechsten,
    faelligeStufen,
    verlieheneStuden,
  };
}

// ── Umzugsteilnahmen zählen ──────────────────────────────────────────────────

/**
 * Prüft ob eine Teilnahme als anwesend gilt (nur bestätigte Anwesenheit zählt).
 */
export function istBestaetigt(teilnahme) {
  return teilnahme.status === 'Anwesend';
}

/**
 * Zählt Jugend- und Erwachsenen-Umzüge getrennt.
 *
 * @param {Object} mitglied - mit geburtsdatum
 * @param {Array} teilnahmen - Teilnahme-Entitäten mit status
 * @param {Array} veranstaltungen - Veranstaltungs-Entitäten (für Datum)
 * @returns {Object} { jugendUmzuege, erwachsenenUmzuege, fehler }
 */
export function zaehleUmzugsteilnahmen(mitglied, teilnahmen, veranstaltungen) {
  const geburtsdatum = parseDate(mitglied?.geburtsdatum);

  if (!geburtsdatum) {
    return { jugendUmzuege: 0, erwachsenenUmzuege: 0, fehler: 'Geburtsdatum fehlt' };
  }

  const veranstaltungMap = {};
  for (const v of veranstaltungen) {
    veranstaltungMap[v.id] = v;
  }

  let jugendUmzuege = 0;
  let erwachsenenUmzuege = 0;
  const datumFehler = [];

  for (const t of teilnahmen) {
    if (!istBestaetigt(t)) continue;

    const v = veranstaltungMap[t.veranstaltung_id];
    if (!v) {
      datumFehler.push(`Veranstaltung ${t.veranstaltung_id} nicht gefunden`);
      continue;
    }
    if (v.typ !== 'Umzug') continue;

    const umzugDatum = parseDate(v.datum);
    if (!umzugDatum) {
      datumFehler.push(`Umzug ${v.id} hat kein Datum`);
      continue;
    }

    const alterAmUmzug = differenceInYears(umzugDatum, geburtsdatum);

    if (alterAmUmzug < 18) {
      jugendUmzuege += 1;
    } else {
      erwachsenenUmzuege += 1;
    }
  }

  return {
    jugendUmzuege,
    erwachsenenUmzuege,
    fehler: datumFehler.length > 0 ? datumFehler : null,
  };
}

// ── Umzugsehrungen ────────────────────────────────────────────────────────────

/**
 * Berechnet Umzugsehrungsstatus.
 *
 * @param {number} erwachsenenUmzuege
 * @param {Array} verlieheneEhrungen - Ehrung-Entitäten
 * @returns {Object} Ehrungsstatus
 */
export function berechneUmzugsEhrungen(erwachsenenUmzuege, verlieheneEhrungen = []) {
  const verlieheneStuden = verlieheneEhrungen
    .filter(e => e.typ === 'Umzugsteilnahmen' && e.status === 'Verliehen')
    .map(e => Number(e.wert));

  const geplanteStuden = verlieheneEhrungen
    .filter(e => e.typ === 'Umzugsteilnahmen' && e.status === 'Geplant')
    .map(e => Number(e.wert));

  const faelligeStufen = [];
  let letzteStufe = null;
  let naechsteStufe = null;
  let fehlendeBisNaechste = null;

  for (const stufe of UMZUGS_STUFEN) {
    if (erwachsenenUmzuege >= stufe) {
      letzteStufe = stufe;
      if (!verlieheneStuden.includes(stufe) && !geplanteStuden.includes(stufe)) {
        faelligeStufen.push(stufe);
      }
    } else {
      if (!naechsteStufe) {
        naechsteStufe = stufe;
        fehlendeBisNaechste = stufe - erwachsenenUmzuege;
      }
    }
  }

  return {
    erwachsenenUmzuege,
    letzteStufe,
    naechsteStufe,
    fehlendeBisNaechste,
    faelligeStufen,
    verlieheneStuden,
  };
}

// ── Vollständige Mitgliederauswertung ─────────────────────────────────────────

/**
 * Berechnet alle Ehrungsdaten für ein Mitglied.
 * Zentrale Funktion – wird überall genutzt.
 *
 * @param {Object} mitglied
 * @param {Array} teilnahmen - nur Teilnahmen dieses Mitglieds
 * @param {Array} veranstaltungen - alle Veranstaltungen
 * @param {Array} ehrungen - nur Ehrungen dieses Mitglieds
 * @returns {Object} Vollständiger Ehrungsstatus
 */
export function berechneEhrungsstatusGesamt(mitglied, teilnahmen, veranstaltungen, ehrungen) {
  const mitgliedsEhrungen = berechneMitgliedsEhrungen(mitglied, ehrungen);

  const { jugendUmzuege, erwachsenenUmzuege, fehler: umzugFehler } =
    zaehleUmzugsteilnahmen(mitglied, teilnahmen, veranstaltungen);

  const umzugsEhrungen = berechneUmzugsEhrungen(erwachsenenUmzuege, ehrungen);

  // Datenwarnungen sammeln
  const warnungen = [];
  if (!mitglied?.geburtsdatum) warnungen.push('Geburtsdatum fehlt');
  if (!mitglied?.eintrittsdatum) warnungen.push('Eintrittsdatum fehlt');
  if (mitgliedsEhrungen.fehler && mitgliedsEhrungen.fehler !== 'Geburtsdatum fehlt' &&
      mitgliedsEhrungen.fehler !== 'Eintrittsdatum fehlt') {
    warnungen.push(mitgliedsEhrungen.fehler);
  }
  if (umzugFehler && Array.isArray(umzugFehler)) {
    warnungen.push(...umzugFehler);
  }

  return {
    mitglied,
    mitgliedsEhrungen,
    jugendUmzuege,
    umzugsEhrungen,
    warnungen,
    hatFaelligeEhrungen:
      mitgliedsEhrungen.faelligeStufen.length > 0 ||
      umzugsEhrungen.faelligeStufen.length > 0,
  };
}

// ── Datenprobleme prüfen ──────────────────────────────────────────────────────

/**
 * Prüft alle Mitglieder und Teilnahmen auf Datenfehler.
 */
export function findeDataProbleme(mitglieder, teilnahmen, veranstaltungen, ehrungen) {
  const probleme = [];

  for (const m of mitglieder) {
    if (!m.geburtsdatum) {
      probleme.push({ typ: 'mitglied_kein_geburtstag', mitglied: m, text: `${m.vorname} ${m.nachname}: Geburtsdatum fehlt` });
    }
    if (!m.eintrittsdatum) {
      probleme.push({ typ: 'mitglied_kein_eintritt', mitglied: m, text: `${m.vorname} ${m.nachname}: Eintrittsdatum fehlt` });
    }
  }

  const veranstaltungMap = {};
  for (const v of veranstaltungen) veranstaltungMap[v.id] = v;
  const mitgliedMap = {};
  for (const m of mitglieder) mitgliedMap[m.id] = m;

  for (const t of teilnahmen) {
    if (!t.mitglied_id || !mitgliedMap[t.mitglied_id]) {
      probleme.push({ typ: 'teilnahme_ohne_mitglied', teilnahme: t, text: `Teilnahme ${t.id}: Mitglied nicht gefunden` });
    }
    const v = veranstaltungMap[t.veranstaltung_id];
    if (!v) {
      probleme.push({ typ: 'teilnahme_ohne_veranstaltung', teilnahme: t, text: `Teilnahme ${t.id}: Veranstaltung nicht gefunden` });
    } else if (!v.datum && v.typ === 'Umzug') {
      probleme.push({ typ: 'umzug_kein_datum', veranstaltung: v, text: `Umzug "${v.titel}": Datum fehlt` });
    }
  }

  // Doppelte Ehrungen prüfen
  const ehrungKeys = {};
  for (const e of ehrungen) {
    const key = `${e.mitglied_id}-${e.typ}-${e.wert}-${e.status}`;
    if (ehrungKeys[key]) {
      const m = mitgliedMap[e.mitglied_id];
      probleme.push({ typ: 'ehrung_doppelt', ehrung: e, text: `Doppelte Ehrung: ${m ? m.nachname : e.mitglied_id} ${e.typ} ${e.wert}` });
    }
    ehrungKeys[key] = true;
  }

  return probleme;
}

// ── Bald fällige Ehrungen ─────────────────────────────────────────────────────

/**
 * Prüft ob eine Mitgliedsehrung bald fällig ist (max. 2 Jahre).
 */
export function isMitgliedsEhrungBaldFaellig(ehrungsStatus) {
  return (
    ehrungsStatus.jahreZurNaechsten !== null &&
    ehrungsStatus.jahreZurNaechsten <= 2 &&
    ehrungsStatus.jahreZurNaechsten > 0
  );
}

/**
 * Prüft ob eine Umzugsehrung bald fällig ist (max. 5 Umzüge).
 */
export function isUmzugsEhrungBaldFaellig(umzugsStatus) {
  return (
    umzugsStatus.fehlendeBisNaechste !== null &&
    umzugsStatus.fehlendeBisNaechste <= 5 &&
    umzugsStatus.fehlendeBisNaechste > 0
  );
}

// ── CSV Export ───────────────────────────────────────────────────────────────

export function exportiereAlsCSV(daten, dateiname) {
  if (!daten || daten.length === 0) return;
  const header = Object.keys(daten[0]).join(';');
  const rows = daten.map(row =>
    Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiname;
  link.click();
  URL.revokeObjectURL(url);
}