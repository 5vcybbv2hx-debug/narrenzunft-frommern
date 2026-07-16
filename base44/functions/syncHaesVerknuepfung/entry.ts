import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Synchronisiert Häs ↔ Mitglied Verknüpfungen bidirektional anhand einer CSV-Datei.
 *
 * - Setzt Haes.aktueller_besitzer_id (Vorwärts-Verknüpfung)
 * - Setzt Mitglied.haes_ids (Rückwärts-Verknüpfung)
 * - Entfernt Verknüpfungen von Häs, die in der CSV einem anderen Mitglied zugeordnet sind
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['vorstand', 'stellv_vorstand', 'admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { csv_url } = body;
    if (!csv_url) return Response.json({ error: 'csv_url fehlt' }, { status: 400 });

    // ── CSV herunterladen und parsen ──
    const csvRes = await fetch(csv_url);
    const csvText = await csvRes.text();
    const clean = csvText.replace(/^\ufeff/, '');
    const lines = clean.split('\n').filter(l => l.trim());
    if (lines.length < 2) return Response.json({ error: 'CSV leer' }, { status: 400 });

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });
      rows.push(row);
    }

    // ── Alle Häs laden, Index nach haesnummer ──
    const alleHaes = await base44.asServiceRole.entities.Haes.list('haesnummer', 1000);
    const haesByNummer = {};
    alleHaes.forEach(h => { haesByNummer[h.haesnummer] = h; });

    // ── Alle Mitglieder laden, Index nach Name ──
    const alleMitglieder = await base44.asServiceRole.entities.Mitglied.list('nachname', 1000);
    const nameMap = {};
    alleMitglieder.forEach(m => {
      const key = `${(m.vorname || '').toLowerCase().trim()}|${(m.nachname || '').toLowerCase().trim()}`;
      if (!nameMap[key]) nameMap[key] = [];
      nameMap[key].push(m);
    });

    // ── Häs-Spalten identifizieren (Häsnummer, 2. Häsnummer, ...) ──
    const haesSpalten = headers.filter(h => h.toLowerCase().includes('häs') || h.toLowerCase().includes('haes'));

    // ── CSV-Zeilen verarbeiten: pro Mitglied alle Häs-Nummern sammeln ──
    // Map: haesnummer → { mitgliedId, mitgliedName, csvStatus }
    const haesZuordnung = {}; // haesnummer → mitgliedId
    const mitgliedHaesMap = {}; // mitgliedId → [haesIds]
    let notFoundHaes = [];
    let notFoundMitglied = [];
    let ambiguousMitglied = [];

    for (const row of rows) {
      const vorname = (row['Vorname'] || '').trim();
      const nachname = (row['Nachname'] || '').trim();
      const key = `${vorname.toLowerCase()}|${nachname.toLowerCase()}`;

      let candidates = nameMap[key] || [];
      if (candidates.length > 1) {
        const csvGeb = (row['Geburtsdatum'] || '').trim();
        const csvAddr = (row['Anschrift'] || '').trim().toLowerCase();
        if (csvGeb) {
          const byGeb = candidates.filter(m => (m.geburtsdatum || '').startsWith(csvGeb));
          if (byGeb.length === 1) candidates = byGeb;
        }
        if (candidates.length > 1 && csvAddr) {
          const byAddr = candidates.filter(m => (m.strasse || '').toLowerCase().includes(csvAddr) || csvAddr.includes((m.strasse || '').toLowerCase()));
          if (byAddr.length === 1) candidates = byAddr;
        }
      }

      if (candidates.length === 0) {
        if (haesSpalten.some(s => row[s])) notFoundMitglied.push(`${vorname} ${nachname}`);
        continue;
      }
      if (candidates.length > 1) {
        if (haesSpalten.some(s => row[s])) ambiguousMitglied.push(`${vorname} ${nachname} (${candidates.length})`);
        continue;
      }

      const m = candidates[0];
      const haesIds = [];

      for (const spalte of haesSpalten) {
        const raw = (row[spalte] || '').trim();
        if (!raw) continue;

        // Format: "0105G (aktiv)" → Nummer "0105", Gruppe "G", Status "aktiv"
        const match = raw.match(/^(\d{4})[A-Z]/);
        if (!match) {
          notFoundHaes.push(`${raw} (ungültiges Format bei ${vorname} ${nachname})`);
          continue;
        }
        const nummer = match[1];
        const haes = haesByNummer[nummer];
        if (!haes) {
          notFoundHaes.push(`${nummer} (nicht in DB, bei ${vorname} ${nachname})`);
          continue;
        }

        haesZuordnung[nummer] = m.id;
        haesIds.push(haes.id);
      }

      if (haesIds.length > 0) {
        mitgliedHaesMap[m.id] = haesIds;
      }
    }

    // ── Häs aktualisieren (Vorwärts-Verknüpfung) ──
    const haesUpdates = [];
    let haesGeaendert = 0;
    let haesBereits = 0;

    for (const haes of alleHaes) {
      const sollBesitzer = haesZuordnung[haes.haesnummer];
      if (sollBesitzer) {
        if (haes.aktueller_besitzer_id !== sollBesitzer) {
          haesUpdates.push({
            id: haes.id,
            aktueller_besitzer_id: sollBesitzer,
          });
          haesGeaendert++;
        } else {
          haesBereits++;
        }
      } else {
        // Häs ist in CSV keinem Mitglied zugeordnet
        // → nur Berechtigung leeren wenn es aktuell jemand hat, der nicht in CSV steht
        if (haes.aktueller_besitzer_id) {
          haesUpdates.push({
            id: haes.id,
            aktueller_besitzer_id: '',
          });
          haesGeaendert++;
        }
      }
    }

    // Bulk-Update Häs
    let haesUpdated = 0;
    const batchSize = 450;
    for (let i = 0; i < haesUpdates.length; i += batchSize) {
      const batch = haesUpdates.slice(i, i + batchSize);
      try {
        await base44.asServiceRole.entities.Haes.bulkUpdate(batch);
        haesUpdated += batch.length;
      } catch (e) {
        // ignore batch errors
      }
    }

    // ── Mitglieder aktualisieren (Rückwärts-Verknüpfung: haes_ids) ──
    const mitgliedUpdates = [];
    let mitgliedGeaendert = 0;

    for (const m of alleMitglieder) {
      const sollHaesIds = mitgliedHaesMap[m.id] || [];
      const aktuelleHaesIds = m.haes_ids || [];

      // Vergleichen (als sortierte Strings)
      const sollSet = [...sollHaesIds].sort().join(',');
      const aktuellSet = [...aktuelleHaesIds].sort().join(',');

      if (sollSet !== aktuellSet) {
        mitgliedUpdates.push({
          id: m.id,
          haes_ids: sollHaesIds,
        });
        mitgliedGeaendert++;
      }
    }

    // Bulk-Update Mitglieder
    let mitgliedUpdated = 0;
    for (let i = 0; i < mitgliedUpdates.length; i += batchSize) {
      const batch = mitgliedUpdates.slice(i, i + batchSize);
      try {
        await base44.asServiceRole.entities.Mitglied.bulkUpdate(batch);
        mitgliedUpdated += batch.length;
      } catch (e) {
        // ignore
      }
    }

    return Response.json({
      status: 'success',
      haes_total: alleHaes.length,
      haes_bereits_korrekt: haesBereits,
      haes_geaendert: haesGeaendert,
      haes_updated: haesUpdated,
      mitglieder_mit_haes: Object.keys(mitgliedHaesMap).length,
      mitglieder_geaendert: mitgliedGeaendert,
      mitglieder_updated: mitgliedUpdated,
      haes_nicht_gefunden: notFoundHaes.length,
      haes_nicht_gefunden_details: notFoundHaes.slice(0, 15),
      mitglieder_nicht_gefunden: notFoundMitglied.length,
      mitglieder_ambiguus: ambiguousMitglied.length,
      ambiguous_details: ambiguousMitglied.slice(0, 5),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}