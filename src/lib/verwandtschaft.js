import { base44 } from '@/api/base44Client';

/**
 * Verwandtschaften werden IMMER beidseitig gespeichert (Owner-Regel).
 *
 * Grund: An vielen Stellen wird nur eine Richtung ausgewertet — Elternrechte,
 * Familienanmeldungen bei Ausfahrten, Familien-Dashboard, Datenqualität.
 * Fehlt die Gegenrichtung, funktionieren diese Features für den Datensatz
 * nicht, ohne dass jemand den Fehler sieht (Fall Monika Schlegel / Lea Marie
 * Leopold: nur Elternteil -> Kind eingetragen).
 *
 * Diese Datei ist die EINZIGE Stelle, die Verwandtschaften schreibt oder
 * löscht; UI-Komponenten rufen ausschließlich sie auf.
 */

/** Gegenstück zu jeder Beziehungsart (aus Sicht der anderen Person). */
export const UMKEHR_BEZIEHUNG = {
  'Elternteil': 'Kind',
  'Kind': 'Elternteil',
  'Ehepartner/in': 'Ehepartner/in',
  'Geschwister': 'Geschwister',
  'Großelternteil': 'Enkel',
  'Enkel': 'Großelternteil',
  'Onkel/Tante': 'Nichte/Neffe',
  'Nichte/Neffe': 'Onkel/Tante',
  'Sonstige': 'Sonstige',
};

export function umkehrBeziehung(beziehung) {
  return UMKEHR_BEZIEHUNG[beziehung] || 'Sonstige';
}

/**
 * Legt eine Verwandtschaft in beiden Richtungen an (idempotent).
 * @returns {Promise<{erstellt: number, vorhanden: number}>}
 */
export async function legeVerwandtschaftBeidseitig({ mitglied_id, verwandter_id, beziehung, notizen }) {
  if (!mitglied_id || !verwandter_id || !beziehung) return { erstellt: 0, vorhanden: 0 };
  if (mitglied_id === verwandter_id) return { erstellt: 0, vorhanden: 0 };

  const paare = [
    { mitglied_id, verwandter_id, beziehung },
    { mitglied_id: verwandter_id, verwandter_id: mitglied_id, beziehung: umkehrBeziehung(beziehung) },
  ];

  let erstellt = 0;
  let vorhanden = 0;
  for (const paar of paare) {
    try {
      const bestehend = await base44.entities.Verwandtschaft.filter({
        mitglied_id: paar.mitglied_id,
        verwandter_id: paar.verwandter_id,
      });
      const schonDa = (bestehend || []).some(v => v.beziehung === paar.beziehung);
      if (schonDa) { vorhanden += 1; continue; }
      await base44.entities.Verwandtschaft.create({ ...paar, notizen: notizen || undefined });
      erstellt += 1;
    } catch (e) {
      console.error('Verwandtschaft anlegen fehlgeschlagen:', paar, e);
    }
  }
  return { erstellt, vorhanden };
}

/**
 * Entfernt eine Verwandtschaft in beiden Richtungen.
 * Ohne Gegenrichtung würde die Beziehung einseitig zurückbleiben.
 */
export async function loescheVerwandtschaftBeidseitig(verwandtschaft) {
  if (!verwandtschaft) return 0;
  const { mitglied_id, verwandter_id, beziehung } = verwandtschaft;
  let geloescht = 0;
  try {
    const hin = await base44.entities.Verwandtschaft.filter({ mitglied_id, verwandter_id });
    const zurueck = await base44.entities.Verwandtschaft.filter({ mitglied_id: verwandter_id, verwandter_id: mitglied_id });
    const alle = [...(hin || []), ...(zurueck || [])].filter(
      v => v.id === verwandtschaft.id || v.beziehung === beziehung || v.beziehung === umkehrBeziehung(beziehung),
    );
    const gesehen = new Set();
    for (const v of alle) {
      if (gesehen.has(v.id)) continue;
      gesehen.add(v.id);
      await base44.entities.Verwandtschaft.delete(v.id);
      geloescht += 1;
    }
  } catch (e) {
    console.error('Verwandtschaft löschen fehlgeschlagen:', e);
  }
  return geloescht;
}
