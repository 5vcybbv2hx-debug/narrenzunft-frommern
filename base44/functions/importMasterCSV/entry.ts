import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STATUS_MAP = {
  'active':   'Aktiv',
  'passive':  'Passiv',
  'resigned': 'Passiv',
  'twen':     'Jungaktive 15-17',
  'teen':     'Jugendliche 11-14',
  'child':    'Kinder 4-10',
  'infant':   'Kleinkind 0-3',
};

const GRUPPENART_MAP = {
  'Maskengruppe': 'Häsgruppe',
  'Tanzgruppe':   'Tanzgruppe',
};

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas inside
    const cols = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    const obj = {};
    header.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
    return obj;
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Nur Admins dürfen importieren' }, { status: 403 });
  }

  const { csv_text, mode = 'preview', offset = 0, limit = 30 } = await req.json();
  if (!csv_text) return Response.json({ error: 'csv_text fehlt' }, { status: 400 });

  const rows = parseCsv(csv_text);

  // ── 1. Personen deduplizieren: person_id → erste Zeile für Stammdaten, alle Zeilen für Gruppen/Häs
  const personMap = {}; // person_id → { stamm, gruppen: Set, haesNummern: Set }
  for (const row of rows) {
    const pid = row['person_id'];
    if (!pid) continue;
    if (!personMap[pid]) {
      personMap[pid] = {
        stamm: row,
        gruppen: new Set(),
        haesNummern: new Set(),
      };
    }
    // Gruppen sammeln
    const gname = row['gruppe_gruppenname']?.trim();
    const gart  = row['gruppe_gruppenart']?.trim();
    if (gname) personMap[pid].gruppen.add(JSON.stringify({ name: gname, art: gart }));

    // Häs-Nummern (können pipe-getrennt oder " & " getrennt sein)
    const haesRaw = row['haes_haesnummer']?.trim();
    if (haesRaw) {
      haesRaw.split(/[|&]/).map(s => s.trim()).filter(Boolean).forEach(h => {
        // Nur reine Zahlen oder alphanumerische Nummern (keine Leerzeichen-Fragmente)
        if (h) personMap[pid].haesNummern.add(h);
      });
    }
  }

  const personIds = Object.keys(personMap);
  const total = personIds.length;

  // ── 2. DB-Daten laden
  const [dbMitglieder, dbHaes, dbGruppen] = await Promise.all([
    base44.asServiceRole.entities.Mitglied.list('nachname', 2000),
    base44.asServiceRole.entities.Haes.list('haesnummer', 2000),
    base44.asServiceRole.entities.Haesgruppe.list('name', 500),
  ]);

  // Mitglieder-Index
  const mitgliedByKey = {};
  const mitgliedByOhne = {};
  for (const m of dbMitglieder) {
    const key = `${m.nachname}|${m.vorname}|${m.geburtsdatum || ''}`;
    mitgliedByKey[key] = m;
    const ko = `${m.nachname}|${m.vorname}|`;
    if (!mitgliedByOhne[ko]) mitgliedByOhne[ko] = m;
  }

  // Häs-Index
  const haesIndex = {};
  for (const h of dbHaes) {
    haesIndex[h.haesnummer] = h;
    haesIndex[String(parseInt(h.haesnummer))] = h;
  }

  // Gruppen-Index
  const gruppeByName = {};
  for (const g of dbGruppen) {
    const key = g.name.toLowerCase();
    if (!gruppeByName[key] || g.aktiv) gruppeByName[key] = g;
  }

  // ── 3. Gruppen anlegen (alle eindeutigen)
  const alleGruppen = new Set();
  for (const p of Object.values(personMap)) {
    for (const gj of p.gruppen) alleGruppen.add(gj);
  }

  const gruppenErgebnis = [];
  for (const gj of alleGruppen) {
    const { name, art } = JSON.parse(gj);
    const typ = GRUPPENART_MAP[art] || 'Sonstige';
    const existing = gruppeByName[name.toLowerCase()];
    if (!existing) {
      if (mode === 'execute') {
        const neu = await base44.asServiceRole.entities.Haesgruppe.create({ name, typ, aktiv: true });
        gruppeByName[name.toLowerCase()] = neu;
        gruppenErgebnis.push({ name, aktion: 'erstellt', typ });
      } else {
        gruppenErgebnis.push({ name, aktion: 'würde erstellt werden', typ });
      }
    } else if (!existing.aktiv) {
      if (mode === 'execute') {
        await base44.asServiceRole.entities.Haesgruppe.update(existing.id, { aktiv: true });
        gruppeByName[name.toLowerCase()] = { ...existing, aktiv: true };
        gruppenErgebnis.push({ name, aktion: 'reaktiviert', typ: existing.typ });
      } else {
        gruppenErgebnis.push({ name, aktion: 'würde reaktiviert werden', typ: existing.typ });
      }
    } else {
      gruppenErgebnis.push({ name, aktion: 'bereits vorhanden', typ: existing.typ });
    }
  }

  // ── 4. Personen in Batches verarbeiten
  const batch = personIds.slice(offset, offset + limit);
  const preview = [];
  let updated = 0, created = 0, haesZugewiesen = 0, nichtGefunden = 0;

  for (const pid of batch) {
    const { stamm, gruppen, haesNummern } = personMap[pid];

    const geb = stamm['geburtsdatum'] || null;
    const matchKey = `${stamm['nachname']}|${stamm['vorname']}|${geb || ''}`;
    const matchKeyOhne = `${stamm['nachname']}|${stamm['vorname']}|`;
    let mitglied = mitgliedByKey[matchKey] || mitgliedByOhne[matchKeyOhne];

    // Telefon: mobil bevorzugt
    const mobil = stamm['mobil']?.split('|')?.[0]?.trim() || '';
    const telefon = stamm['telefon']?.split('|')?.[0]?.trim() || '';
    const tel = mobil || telefon || null;

    // Adresse: erste Adresse wenn mehrere (pipe-getrennt)
    const strasse = stamm['adresse_strasse_hausnr']?.split('|')?.[0]?.trim() || '';
    const plz     = stamm['adresse_plz']?.split('|')?.[0]?.trim() || '';
    const ort     = stamm['adresse_ort']?.split('|')?.[0]?.trim() || '';

    // Gruppen-IDs
    const gruppenIds = [];
    for (const gj of gruppen) {
      const { name } = JSON.parse(gj);
      const dbG = gruppeByName[name.toLowerCase()];
      if (dbG) gruppenIds.push(dbG.id);
    }

    // Austrittsdatum aus Kommentar
    let austrittsdatum = null;
    if (stamm['status_gesamt'] === 'resigned' && stamm['kommentar_text']) {
      const m = stamm['kommentar_text'].match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (m) austrittsdatum = `${m[3]}-${m[2]}-${m[1]}`;
    }

    const mitgliedData = {
      vorname: stamm['vorname'],
      nachname: stamm['nachname'],
      ...(geb ? { geburtsdatum: geb } : {}),
      mitgliedsstatus: STATUS_MAP[stamm['status_gesamt']] || 'Passiv',
      ...(tel ? { telefon: tel } : {}),
      ...(stamm['email'] ? { email: stamm['email'] } : {}),
      ...(strasse ? { strasse } : {}),
      ...(plz ? { plz } : {}),
      ...(ort ? { ort } : {}),
      ...(stamm['eintrittsdatum'] ? { eintrittsdatum: stamm['eintrittsdatum'] } : {}),
      ...(austrittsdatum ? { austrittsdatum } : {}),
    };

    const haesInfo = [...haesNummern].map(hn => {
      const h = haesIndex[hn] || haesIndex[String(parseInt(hn))];
      return { nummer: hn, gefunden: !!h, haes: h || null };
    });

    const aktion = mitglied ? 'update' : 'create';

    if (mode === 'preview') {
      preview.push({
        person_id: pid,
        name: `${stamm['vorname']} ${stamm['nachname']}`,
        geburtsdatum: geb,
        status: stamm['status_gesamt'],
        aktion,
        gruppen: [...gruppen].map(gj => JSON.parse(gj).name).join(', '),
        haes: haesInfo.map(h => `${h.nummer}${h.gefunden ? '✓' : '✗'}`).join(', '),
        match: mitglied ? `✓ ${mitglied.vorname} ${mitglied.nachname}` : '➕ Neu',
      });
    } else {
      // Mitglied anlegen oder aktualisieren
      if (mitglied) {
        // Gruppen mergen
        const aktuelle = mitglied.haesgruppen_ids || (mitglied.haesgruppe_id ? [mitglied.haesgruppe_id] : []);
        const merged = [...new Set([...aktuelle, ...gruppenIds])];
        await base44.asServiceRole.entities.Mitglied.update(mitglied.id, {
          ...mitgliedData,
          haesgruppen_ids: merged,
        });
        updated++;
      } else {
        mitglied = await base44.asServiceRole.entities.Mitglied.create({
          ...mitgliedData,
          haesgruppen_ids: gruppenIds,
        });
        // Index aktualisieren für spätere Zeilen
        mitgliedByKey[matchKey] = mitglied;
        mitgliedByOhne[matchKeyOhne] = mitglied;
        created++;
      }

      // Häs zuweisen
      const heute = new Date().toISOString().split('T')[0];
      for (const { haes } of haesInfo) {
        if (!haes) continue;
        // Gruppe des Häs bestimmen (anhand erster Gruppe des Mitglieds)
        const haesGruppeId = gruppenIds[0] || null;
        await base44.asServiceRole.entities.Haes.update(haes.id, {
          aktueller_besitzer_id: mitglied.id,
          status: 'Verliehen',
          vereinseigentum: false,
          privat_eigentuemer_id: mitglied.id,
          ...(haesGruppeId ? { haesgruppe_id: haesGruppeId } : {}),
        });
        const bestehende = await base44.asServiceRole.entities.HaesHistorie.filter({ haes_id: haes.id, aktiv: true });
        if (bestehende.length === 0) {
          await base44.asServiceRole.entities.HaesHistorie.create({
            haes_id: haes.id,
            mitglied_id: mitglied.id,
            von_datum: heute,
            aktiv: true,
            notizen: 'Import Master-CSV',
          });
        }
        haesZugewiesen++;
        await new Promise(r => setTimeout(r, 80));
      }

      await new Promise(r => setTimeout(r, 200));
    }

    if (!mitglied && mode === 'execute') nichtGefunden++;
  }

  const done = offset + batch.length >= total;

  return Response.json({
    success: true,
    mode,
    total,
    processed: batch.length,
    updated,
    created,
    haesZugewiesen,
    nichtGefunden,
    gruppen: mode === 'preview' ? gruppenErgebnis : undefined,
    done,
    next_offset: done ? null : offset + limit,
    ...(mode === 'preview' ? { preview: preview.slice(0, 50) } : {}),
    message: mode === 'preview'
      ? `Vorschau: ${Math.min(50, batch.length)} von ${total} Personen`
      : done
        ? `Fertig! ${updated} aktualisiert, ${created} neu, ${haesZugewiesen} Häs zugewiesen`
        : `Batch ${offset}–${offset + batch.length} / ${total}`,
  });
});