import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function parseCsvSemicolon(text) {
  const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
  const header = lines[0].split(';').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(';');
    const obj = {};
    header.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
    return obj;
  });
}

const GRUPPEN_TYP_MAP = {
  'Maskengruppe': 'Häsgruppe',
  'Tanzgruppe': 'Tanzgruppe',
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Nur Admins dürfen importieren' }, { status: 403 });
  }

  const {
    haes_text,
    personen_text,
    gruppen_text,
    mitgliedschaft_gruppen_text,
    mode = 'preview',
    offset = 0,
    limit = 50
  } = await req.json();

  if (!haes_text || !personen_text) {
    return Response.json({ error: 'haes_text und personen_text sind Pflicht' }, { status: 400 });
  }

  const haesRows = parseCsvSemicolon(haes_text);
  const personenRows = parseCsvSemicolon(personen_text);
  const gruppenRows = gruppen_text ? parseCsvSemicolon(gruppen_text) : [];
  const mgruppenRows = mitgliedschaft_gruppen_text ? parseCsvSemicolon(mitgliedschaft_gruppen_text) : [];

  const personenIndex = {};
  for (const p of personenRows) {
    personenIndex[p.person_id] = p;
  }

  const gruppenIndex = {};
  for (const g of gruppenRows) {
    gruppenIndex[g.gruppe_id] = g;
  }

  const personGruppenIndex = {};
  for (const mg of mgruppenRows) {
    if (!personGruppenIndex[mg.person_id]) personGruppenIndex[mg.person_id] = [];
    if (!personGruppenIndex[mg.person_id].includes(mg.gruppe_id)) {
      personGruppenIndex[mg.person_id].push(mg.gruppe_id);
    }
  }

  const [dbMitglieder, dbHaes, dbGruppen] = await Promise.all([
    base44.asServiceRole.entities.Mitglied.list('nachname', 2000),
    base44.asServiceRole.entities.Haes.list('haesnummer', 2000),
    base44.asServiceRole.entities.Haesgruppe.list('name', 200),
  ]);

  const mitgliedByKey = {};
  const mitgliedByGebKey = {};
  for (const m of dbMitglieder) {
    const key = `${m.nachname}|${m.vorname}|${m.geburtsdatum || ''}`;
    mitgliedByKey[key] = m;
    const keyOhne = `${m.nachname}|${m.vorname}|`;
    if (!mitgliedByGebKey[keyOhne]) mitgliedByGebKey[keyOhne] = m;
  }

  const haesIndex = {};
  for (const h of dbHaes) {
    haesIndex[h.haesnummer] = h;
    haesIndex[String(parseInt(h.haesnummer))] = h;
  }

  const gruppeByName = {};
  for (const g of dbGruppen) {
    gruppeByName[g.name.toLowerCase()] = g;
  }

  const total = haesRows.length;
  const batch = haesRows.slice(offset, offset + limit);
  const preview = [];
  let haesZugewiesen = 0, haesNichtGefunden = 0, mitgliedNichtGefunden = 0;

  for (const row of batch) {
    const haesnummer = row.haesnummer;
    const personId = row.person_id;
    const person = personenIndex[personId];

    if (!person || !haesnummer) continue;

    const haesInDb = haesIndex[haesnummer] || haesIndex[String(parseInt(haesnummer))];
    const matchKey = `${person.nachname}|${person.vorname}|${person.geburtsdatum || ''}`;
    const matchKeyOhne = `${person.nachname}|${person.vorname}|`;
    const mitglied = mitgliedByKey[matchKey] || mitgliedByGebKey[matchKeyOhne];

    const gruppenIds = personGruppenIndex[personId] || [];
    let haesgruppe = null;
    for (const gid of gruppenIds) {
      const g = gruppenIndex[gid];
      if (g) {
        haesgruppe = gruppeByName[g.name.toLowerCase()];
        if (haesgruppe) break;
      }
    }

    const matchInfo = {
      haesnummer,
      person_id: personId,
      person_name: `${person.vorname} ${person.nachname}`,
      haes_in_db: haesInDb ? `✓ ${haesInDb.haesnummer} (${haesInDb.status})` : '✗ Nicht gefunden',
      mitglied_in_db: mitglied ? `✓ ${mitglied.vorname} ${mitglied.nachname}` : '✗ Nicht gefunden',
      haesgruppe: haesgruppe ? `✓ ${haesgruppe.name}` : '– keine Gruppe',
      aktion: haesInDb && mitglied ? 'zuweisen' : 'überspringen',
    };

    if (mode === 'preview') {
      preview.push(matchInfo);
    } else if (mode === 'execute') {
      if (haesInDb && mitglied) {
        const heute = new Date().toISOString().split('T')[0];
        await base44.asServiceRole.entities.Haes.update(haesInDb.id, {
          aktueller_besitzer_id: mitglied.id,
          status: 'Verliehen',
          vereinseigentum: false,
          privat_eigentuemer_id: mitglied.id,
          ...(haesgruppe ? { haesgruppe_id: haesgruppe.id } : {}),
        });
        const bestehende = await base44.asServiceRole.entities.HaesHistorie.filter({ haes_id: haesInDb.id, aktiv: true });
        if (bestehende.length === 0) {
          await base44.asServiceRole.entities.HaesHistorie.create({
            haes_id: haesInDb.id,
            mitglied_id: mitglied.id,
            von_datum: heute,
            aktiv: true,
            notizen: 'Import aus bereinigter Mitgliederliste',
          });
        }
        haesZugewiesen++;
        await new Promise(r => setTimeout(r, 100));
      } else {
        if (!haesInDb) haesNichtGefunden++;
        if (!mitglied) mitgliedNichtGefunden++;
      }
    }
  }

  const done = offset + batch.length >= total;

  return Response.json({
    success: true,
    mode,
    total,
    processed: batch.length,
    haesZugewiesen,
    haesNichtGefunden,
    mitgliedNichtGefunden,
    done,
    next_offset: done ? null : offset + limit,
    ...(mode === 'preview' ? { preview } : {}),
    message: mode === 'preview'
      ? `Vorschau: ${batch.length} von ${total} Häs-Zeilen`
      : done
        ? `Fertig! ${haesZugewiesen} Häs zugewiesen`
        : `Batch ${offset}–${offset + batch.length} von ${total} verarbeitet`,
  });
});