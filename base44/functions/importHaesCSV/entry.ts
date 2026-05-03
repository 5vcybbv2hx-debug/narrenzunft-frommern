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

// Gruppenname -> Häsgruppen-Typ-Mapping
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
    haes_url,
    personen_url,
    gruppen_url,
    mitgliedschaft_gruppen_url,
    mode = 'preview',
    offset = 0,
    limit = 50
  } = await req.json();

  if (!haes_url || !personen_url) {
    return Response.json({ error: 'haes_url und personen_url sind Pflicht' }, { status: 400 });
  }

  // Alle Daten parallel laden
  const [haesText, personenText, gruppenText, mgruppenText] = await Promise.all([
    fetch(haes_url).then(r => r.text()),
    fetch(personen_url).then(r => r.text()),
    gruppen_url ? fetch(gruppen_url).then(r => r.text()) : Promise.resolve(null),
    mitgliedschaft_gruppen_url ? fetch(mitgliedschaft_gruppen_url).then(r => r.text()) : Promise.resolve(null),
  ]);

  const haesRows = parseCsvSemicolon(haesText);
  const personenRows = parseCsvSemicolon(personenText);
  const gruppenRows = gruppenText ? parseCsvSemicolon(gruppenText) : [];
  const mgruppenRows = mgruppenText ? parseCsvSemicolon(mgruppenText) : [];

  // Personen-Index: person_id -> { vorname, nachname, geburtsdatum }
  const personenIndex = {};
  for (const p of personenRows) {
    personenIndex[p.person_id] = p;
  }

  // Gruppen-Index: gruppe_id -> gruppenname
  const gruppenIndex = {};
  for (const g of gruppenRows) {
    gruppenIndex[g.gruppe_id] = g;
  }

  // Mitgliedschaft-Gruppen-Index: person_id -> [gruppe_id, ...]
  const personGruppenIndex = {};
  for (const mg of mgruppenRows) {
    if (!personGruppenIndex[mg.person_id]) personGruppenIndex[mg.person_id] = [];
    if (!personGruppenIndex[mg.person_id].includes(mg.gruppe_id)) {
      personGruppenIndex[mg.person_id].push(mg.gruppe_id);
    }
  }

  // Aktuelle DB-Daten laden
  const [dbMitglieder, dbHaes, dbGruppen] = await Promise.all([
    base44.asServiceRole.entities.Mitglied.list('nachname', 2000),
    base44.asServiceRole.entities.Haes.list('haesnummer', 2000),
    base44.asServiceRole.entities.Haesgruppe.list('name', 200),
  ]);

  // Mitglieder-Index: "nachname|vorname|geburtsdatum" -> mitglied
  const mitgliedByKey = {};
  const mitgliedByGebKey = {};
  for (const m of dbMitglieder) {
    const key = `${m.nachname}|${m.vorname}|${m.geburtsdatum || ''}`;
    mitgliedByKey[key] = m;
    const keyOhne = `${m.nachname}|${m.vorname}|`;
    if (!mitgliedByGebKey[keyOhne]) mitgliedByGebKey[keyOhne] = m;
  }

  // Häs-Index: haesnummer -> haes
  const haesIndex = {};
  for (const h of dbHaes) {
    haesIndex[h.haesnummer] = h;
    // Auch ohne führende Nullen
    haesIndex[String(parseInt(h.haesnummer))] = h;
  }

  // Häsgruppen-Index: name.toLowerCase() -> gruppe
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

    // Häs in DB suchen
    const haesInDb = haesIndex[haesnummer] || haesIndex[String(parseInt(haesnummer))];

    // Mitglied in DB suchen
    const matchKey = `${person.nachname}|${person.vorname}|${person.geburtsdatum || ''}`;
    const matchKeyOhne = `${person.nachname}|${person.vorname}|`;
    const mitglied = mitgliedByKey[matchKey] || mitgliedByGebKey[matchKeyOhne];

    // Gruppe des Mitglieds ermitteln (erste Gruppe aus mitgliedschaft_gruppen)
    const gruppenIds = personGruppenIndex[personId] || [];
    let haesgruppe = null;
    for (const gid of gruppenIds) {
      const g = gruppenIndex[gid];
      if (g) {
        // Gruppe in DB suchen
        haesgruppe = gruppeByName[g.name.toLowerCase()];
        if (haesgruppe) break;
      }
    }

    const matchInfo = {
      haesnummer,
      person_id: personId,
      person_name: `${person.vorname} ${person.nachname}`,
      haes_in_db: haesInDb ? `✓ ${haesInDb.haesnummer} (${haesInDb.status})` : '✗ Nicht gefunden',
      mitglied_in_db: mitglied ? `✓ ${mitglied.vorname} ${mitglied.nachname} (ID: ${mitglied.id})` : '✗ Nicht gefunden',
      haesgruppe: haesgruppe ? `✓ ${haesgruppe.name}` : gruppenIds.length > 0 ? `✗ "${gruppenIds.map(id => gruppenIndex[id]?.name).join(', ')}" nicht in DB` : '– keine Gruppe',
      aktion: haesInDb && mitglied ? 'zuweisen' : 'überspringen',
    };

    if (mode === 'preview') {
      preview.push(matchInfo);
    } else if (mode === 'execute') {
      if (haesInDb && mitglied) {
        const heute = new Date().toISOString().split('T')[0];
        // Häs aktualisieren
        await base44.asServiceRole.entities.Haes.update(haesInDb.id, {
          aktueller_besitzer_id: mitglied.id,
          status: 'Verliehen',
          vereinseigentum: false,
          privat_eigentuemer_id: mitglied.id,
          ...(haesgruppe ? { haesgruppe_id: haesgruppe.id } : {}),
        });

        // HaesHistorie anlegen (wenn noch keine aktive existiert)
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