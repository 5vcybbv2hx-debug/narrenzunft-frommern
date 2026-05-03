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

const GRUPPENART_MAP = {
  'Maskengruppe': 'Häsgruppe',
  'Tanzgruppe': 'Tanzgruppe',
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Nur Admins dürfen importieren' }, { status: 403 });
  }

  const { gruppen_url, personen_url, mitgliedschaft_gruppen_url, mode = 'preview' } = await req.json();

  if (!gruppen_url || !personen_url || !mitgliedschaft_gruppen_url) {
    return Response.json({ error: 'gruppen_url, personen_url und mitgliedschaft_gruppen_url sind Pflicht' }, { status: 400 });
  }

  const [gruppenText, personenText, mgruppenText] = await Promise.all([
    fetch(gruppen_url).then(r => r.text()),
    fetch(personen_url).then(r => r.text()),
    fetch(mitgliedschaft_gruppen_url).then(r => r.text()),
  ]);

  const gruppenRows = parseCsvSemicolon(gruppenText);
  const personenRows = parseCsvSemicolon(personenText);
  const mgruppenRows = parseCsvSemicolon(mgruppenText);

  // Personen-Index
  const personenIndex = {};
  for (const p of personenRows) {
    personenIndex[p.person_id] = p;
  }

  // Pro Person: welche Gruppen?
  // person_id -> [{ gruppe_id, gruppenname, gruppenart }]
  const personGruppen = {};
  for (const mg of mgruppenRows) {
    if (!personGruppen[mg.person_id]) personGruppen[mg.person_id] = [];
    if (!personGruppen[mg.person_id].find(g => g.gruppe_id === mg.gruppe_id)) {
      personGruppen[mg.person_id].push({
        gruppe_id: mg.gruppe_id,
        gruppenname: mg.gruppenname,
        gruppenart: mg.gruppenart,
      });
    }
  }

  // DB-Daten laden
  const [dbMitglieder, dbGruppen] = await Promise.all([
    base44.asServiceRole.entities.Mitglied.list('nachname', 2000),
    base44.asServiceRole.entities.Haesgruppe.list('name', 200),
  ]);

  // Mitglieder-Index
  const mitgliedByKey = {};
  const mitgliedByOhneGeb = {};
  for (const m of dbMitglieder) {
    const key = `${m.nachname}|${m.vorname}|${m.geburtsdatum || ''}`;
    mitgliedByKey[key] = m;
    const keyOhne = `${m.nachname}|${m.vorname}|`;
    if (!mitgliedByOhneGeb[keyOhne]) mitgliedByOhneGeb[keyOhne] = m;
  }

  // Gruppen-Index: name.toLowerCase() -> gruppe
  const gruppeByName = {};
  for (const g of dbGruppen) {
    gruppeByName[g.name.toLowerCase()] = g;
  }

  // Schritt 1: Gruppen anlegen falls nicht vorhanden
  const gruppenErgebnis = [];
  for (const g of gruppenRows) {
    const existing = gruppeByName[g.name.toLowerCase()];
    const typ = GRUPPENART_MAP[g.gruppenart] || 'Sonstige';
    if (!existing) {
      if (mode === 'execute') {
        const neu = await base44.asServiceRole.entities.Haesgruppe.create({
          name: g.name,
          typ,
          aktiv: true,
        });
        gruppeByName[g.name.toLowerCase()] = neu;
        gruppenErgebnis.push({ name: g.name, aktion: 'erstellt', typ });
      } else {
        gruppenErgebnis.push({ name: g.name, aktion: 'würde erstellt werden', typ });
      }
    } else {
      gruppenErgebnis.push({ name: g.name, aktion: 'bereits vorhanden', typ: existing.typ });
    }
  }

  // Schritt 2: Mitglieder den Gruppen zuordnen
  const zuordnungen = [];
  let zugeordnet = 0, nichtGefunden = 0;

  const allePersonIds = Object.keys(personGruppen);

  for (const personId of allePersonIds) {
    const person = personenIndex[personId];
    if (!person) continue;

    const matchKey = `${person.nachname}|${person.vorname}|${person.geburtsdatum || ''}`;
    const matchKeyOhne = `${person.nachname}|${person.vorname}|`;
    const mitglied = mitgliedByKey[matchKey] || mitgliedByOhneGeb[matchKeyOhne];

    const gruppen = personGruppen[personId];
    const gruppenIdsZuweisen = [];

    for (const g of gruppen) {
      const dbGruppe = gruppeByName[g.gruppenname.toLowerCase()];
      if (dbGruppe) gruppenIdsZuweisen.push(dbGruppe.id);
    }

    const info = {
      person: `${person.vorname} ${person.nachname}`,
      gruppen: gruppen.map(g => g.gruppenname).join(', '),
      mitglied_match: mitglied ? `✓ ${mitglied.vorname} ${mitglied.nachname}` : '✗ Nicht gefunden',
      gruppen_ids: gruppenIdsZuweisen,
      aktion: mitglied && gruppenIdsZuweisen.length > 0 ? 'zuordnen' : 'überspringen',
    };

    if (mode === 'execute' && mitglied && gruppenIdsZuweisen.length > 0) {
      // Bestehende IDs mergen
      const aktuelle = mitglied.haesgruppen_ids || (mitglied.haesgruppe_id ? [mitglied.haesgruppe_id] : []);
      const merged = [...new Set([...aktuelle, ...gruppenIdsZuweisen])];

      await base44.asServiceRole.entities.Mitglied.update(mitglied.id, {
        haesgruppen_ids: merged,
      });
      zugeordnet++;
      await new Promise(r => setTimeout(r, 80));
    } else if (!mitglied) {
      nichtGefunden++;
    }

    zuordnungen.push(info);
  }

  return Response.json({
    success: true,
    mode,
    gruppen: gruppenErgebnis,
    zuordnungen_gesamt: zuordnungen.length,
    zugeordnet,
    nichtGefunden,
    ...(mode === 'preview' ? { zuordnungen: zuordnungen.slice(0, 100) } : {}),
    message: mode === 'preview'
      ? `Vorschau: ${zuordnungen.length} Personen-Gruppen-Zuordnungen`
      : `Fertig! ${zugeordnet} Mitglieder Gruppen zugeordnet, ${nichtGefunden} nicht gefunden`,
  });
});