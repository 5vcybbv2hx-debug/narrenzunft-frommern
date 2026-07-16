import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

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

    // ── Haesgruppen laden ──
    const gruppen = await base44.asServiceRole.entities.Haesgruppe.list('name', 100);
    const sparteMap = {};
    gruppen.forEach(g => { sparteMap[g.name.toLowerCase()] = g.id; });
    if (sparteMap['brennnesseln']) sparteMap['brennnessel'] = sparteMap['brennnesseln'];

    // ── Alle Mitglieder laden (für Namens-Matching) ──
    const alleMitglieder = await base44.asServiceRole.entities.Mitglied.list('nachname', 1000);

    // Lookup-Map: (vorname|nachname lowercase) → [mitglieder]
    const nameMap = {};
    alleMitglieder.forEach(m => {
      const key = `${(m.vorname || '').toLowerCase().trim()}|${(m.nachname || '').toLowerCase().trim()}`;
      if (!nameMap[key]) nameMap[key] = [];
      nameMap[key].push(m);
    });

    // ── Updates vorbereiten ──
    const updates = [];
    let matched = 0;
    let ambiguous = 0;
    let notFound = 0;
    const notFoundNames = [];
    const ambiguousNames = [];

    for (const row of rows) {
      const vorname = (row['Vorname'] || '').trim();
      const nachname = (row['Nachname'] || '').trim();
      const key = `${vorname.toLowerCase()}|${nachname.toLowerCase()}`;

      let candidates = nameMap[key] || [];

      // Wenn mehrere Kandidaten: nach Geburtsdatum oder Adresse disambiguieren
      if (candidates.length > 1) {
        const csvGeb = (row['Geburtsdatum'] || '').trim();
        const csvAddr = (row['Anschrift'] || '').trim().toLowerCase();

        // Versuch 1: Geburtsdatum
        if (csvGeb) {
          const byGeb = candidates.filter(m => (m.geburtsdatum || '').startsWith(csvGeb));
          if (byGeb.length === 1) candidates = byGeb;
        }
        // Versuch 2: Adresse
        if (candidates.length > 1 && csvAddr) {
          const byAddr = candidates.filter(m => (m.strasse || '').toLowerCase().includes(csvAddr) || csvAddr.includes((m.strasse || '').toLowerCase()));
          if (byAddr.length === 1) candidates = byAddr;
        }
      }

      if (candidates.length === 0) {
        notFound++;
        notFoundNames.push(`${vorname} ${nachname}`);
        continue;
      }
      if (candidates.length > 1) {
        ambiguous++;
        ambiguousNames.push(`${vorname} ${nachname} (${candidates.length} Treffer)`);
        continue;
      }

      const m = candidates[0];

      // Sparte mappen
      const sparteRaw = (row['Sparte'] || '').trim();
      let haesgruppen_ids = [];
      if (sparteRaw) {
        const gid = sparteMap[sparteRaw.toLowerCase()];
        if (gid) haesgruppen_ids = [gid];
      }

      // Telefon
      let telefon = '';
      const telPrivat = (row['Tel. Privat'] || '').trim();
      const handy = (row['Handy'] || '').trim();
      const telGeschaeft = (row['Tel. Geschäft'] || '').trim();
      if (telPrivat) telefon = telPrivat;
      else if (handy) telefon = handy;
      else if (telGeschaeft) telefon = telGeschaeft;

      const email = (row['E-Mail'] || '').trim();
      const umzuege = parseInt((row['Umzugsteilnahmen'] || '').trim()) || 0;

      let geburtsdatum = (row['Geburtsdatum'] || '').trim();
      if (!geburtsdatum) geburtsdatum = null;

      let eintrittsdatum = (row['Eintrittsdatum'] || '').trim();
      if (!eintrittsdatum) eintrittsdatum = null;

      let austrittsdatum = (row['Austrittsdatum'] || '').trim();
      if (!austrittsdatum) austrittsdatum = null;

      let mitgliedsstatus = (row['Status'] || '').trim();
      if (!mitgliedsstatus) mitgliedsstatus = 'Aktiv';

      const update = {
        id: m.id,
        vorname,
        nachname,
        strasse: (row['Anschrift'] || '').trim(),
        plz: (row['PLZ'] || '').trim(),
        ort: (row['Ort'] || '').trim(),
        telefon,
        email,
        geburtsdatum,
        eintrittsdatum,
        austrittsdatum,
        mitgliedsstatus,
        umzuege_vor_digitalisierung: umzuege,
      };

      if (haesgruppen_ids.length > 0) {
        update.haesgruppen_ids = haesgruppen_ids;
        update.haesgruppe_id = haesgruppen_ids[0];
      }

      // Verstorbene archivieren
      if (mitgliedsstatus === 'Verstorben') {
        update.archiviert = true;
        update.archiviert_grund = 'Verstorben';
        update.archiviert_am = new Date().toISOString().split('T')[0];
      }

      updates.push(update);
      matched++;
    }

    // ── Bulk-Update ──
    const batchSize = 450;
    let updated = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      try {
        await base44.asServiceRole.entities.Mitglied.bulkUpdate(batch);
        updated += batch.length;
      } catch (e) {
        failed += batch.length;
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${e.message}`);
      }
    }

    return Response.json({
      status: 'success',
      total_rows: rows.length,
      matched,
      updated,
      failed,
      notFound,
      ambiguous,
      notFoundNames: notFoundNames.slice(0, 10),
      ambiguousNames: ambiguousNames.slice(0, 10),
      errors: errors.slice(0, 5),
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