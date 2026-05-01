import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STATUS_MAP = {
  'active': 'Aktiv',
  'passive': 'Passiv',
  'resigned': 'Aktiv',
  'twen': 'Jungaktive 15-17',
  'teen': 'Jugendliche 11-14',
  'child': 'Kinder 4-10',
  'infant': 'Kleinkind 0-3',
};

const STATUS_PRIORITY = ['active', 'twen', 'teen', 'child', 'infant', 'passive', 'resigned'];

function parseDate(str) {
  if (!str) return null;
  const m = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
}

function parsePlzOrt(plzOrt) {
  if (!plzOrt) return { plz: '', ort: '' };
  const m = plzOrt.match(/^(\d{5})\s+(.+)$/);
  if (m) return { plz: m[1], ort: m[2] };
  return { plz: '', ort: plzOrt };
}

function parseCsv(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const header = lines[0].split(';').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(';');
    const obj = {};
    header.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
    return obj;
  });
}

function buildPersonData(row) {
  const { plz, ort } = parsePlzOrt(row['PLZ & Ort']);
  const statusRaw = row['Status'];
  const mitgliedsstatus = STATUS_MAP[statusRaw] || 'Passiv';
  const telefon = (row['Handynummer'] || row['Telefonnummer'] || '').trim() || null;
  const email = (row['Email'] || '').trim() || null;
  const strasseRaw = (row['Straße & Nr'] || row['Strae & Nr'] || '').trim();
  const gebISO = parseDate(row['Geburtsdatum']);
  let austrittsdatum = null;
  if (statusRaw === 'resigned') {
    const austritt = row['Ausgetreten seit (Import)'];
    if (austritt && austritt !== '0') austrittsdatum = `${austritt}-01-01`;
  }
  return {
    vorname: row['Vorname'],
    nachname: row['Nachname'],
    strasse: strasseRaw || null,
    plz: plz || null,
    ort: ort || null,
    telefon,
    email,
    mitgliedsstatus,
    eintrittsdatum: row['Eintrittsdatum'] || null,
    ...(gebISO ? { geburtsdatum: gebISO } : {}),
    ...(austrittsdatum ? { austrittsdatum } : {}),
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch(e) {}
  if (user && user.role !== 'admin') {
    return Response.json({ error: 'Nur Admins dürfen importieren' }, { status: 403 });
  }

  const { csv_url, offset = 0, limit = 50, mode = 'all' } = await req.json();
  if (!csv_url) return Response.json({ error: 'csv_url fehlt' }, { status: 400 });

  // CSV laden
  const csvText = await fetch(csv_url).then(r => r.text());
  const rows = parseCsv(csvText);

  // Deduplizierung pro Person
  const personMap = {};
  for (const row of rows) {
    const key = `${row['Nachname']}|${row['Vorname']}|${row['Geburtsdatum']}`;
    const existing = personMap[key];
    if (!existing) {
      personMap[key] = row;
    } else {
      const newPrio = STATUS_PRIORITY.indexOf(row['Status']);
      const existPrio = STATUS_PRIORITY.indexOf(existing['Status']);
      if (newPrio < existPrio) personMap[key] = row;
    }
  }
  const allPersons = Object.values(personMap).filter(r => r['Vorname'] && r['Nachname']);
  const totalPersons = allPersons.length;

  // Nur den angeforderten Batch verarbeiten
  const batch = allPersons.slice(offset, offset + limit);

  // Alle bestehenden Mitglieder laden
  const existingList = await base44.asServiceRole.entities.Mitglied.list('nachname', 2000);
  const existingIndex = {};
  for (const m of existingList) {
    const geb = m.geburtsdatum || '';
    const key = `${m.nachname}|${m.vorname}|${geb}`;
    existingIndex[key] = m;
  }

  let updated = 0;
  let created = 0;

  // Sequentiell verarbeiten um Rate Limits zu vermeiden
  for (const row of batch) {
    const gebISO = parseDate(row['Geburtsdatum']);
    const matchKey = `${row['Nachname']}|${row['Vorname']}|${gebISO || ''}`;
    const matchKeyOhne = `${row['Nachname']}|${row['Vorname']}|`;
    const existMitglied = existingIndex[matchKey] || existingIndex[matchKeyOhne];
    const data = buildPersonData(row);

    if (existMitglied) {
      await base44.asServiceRole.entities.Mitglied.update(existMitglied.id, data);
      updated++;
    } else {
      await base44.asServiceRole.entities.Mitglied.create(data);
      created++;
    }
    // Kurze Pause
    await new Promise(r => setTimeout(r, 150));
  }

  const done = offset + batch.length >= totalPersons;

  return Response.json({
    success: true,
    updated,
    created,
    processed: batch.length,
    total: totalPersons,
    next_offset: done ? null : offset + limit,
    done,
    message: done
      ? `Fertig! Gesamt: ${updated} aktualisiert, ${created} neu angelegt`
      : `Batch ${offset}-${offset + batch.length} von ${totalPersons} verarbeitet`
  });
});