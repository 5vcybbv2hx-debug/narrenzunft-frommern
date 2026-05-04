import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Status-Mapping aus den bereinigten CSV-Daten
const STATUS_MAP = {
  'active': 'Aktiv',
  'passive': 'Passiv',
  'resigned': 'Passiv', // Ausgetreten → Passiv (mit Austrittsdatum)
  'twen': 'Jungaktive 15-17',
  'teen': 'Jugendliche 11-14',
  'child': 'Kinder 4-10',
  'infant': 'Kleinkind 0-3',
};

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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Nur Admins dürfen importieren' }, { status: 403 });
  }

  const { personen_url, kontakte_url, adressen_url, mode = 'preview', offset = 0, limit = 20 } = await req.json();

  if (!personen_url) return Response.json({ error: 'personen_url fehlt' }, { status: 400 });

  // Alle CSV-Dateien parallel laden
  const [personenText, kontakteText, adressenText] = await Promise.all([
    fetch(personen_url).then(r => r.text()),
    kontakte_url ? fetch(kontakte_url).then(r => r.text()) : Promise.resolve(null),
    adressen_url ? fetch(adressen_url).then(r => r.text()) : Promise.resolve(null),
  ]);

  const personen = parseCsvSemicolon(personenText);
  const kontakte = kontakteText ? parseCsvSemicolon(kontakteText) : [];
  const adressen = adressenText ? parseCsvSemicolon(adressenText) : [];

  // Kontakte-Index: person_id -> { telefon, email, mobil }
  const kontakteIndex = {};
  for (const k of kontakte) {
    if (!kontakteIndex[k.person_id]) kontakteIndex[k.person_id] = {};
    if (k.typ === 'telefon') kontakteIndex[k.person_id].telefon = k.wert;
    if (k.typ === 'mobil') kontakteIndex[k.person_id].mobil = k.wert;
    if (k.typ === 'email') kontakteIndex[k.person_id].email = k.wert;
  }

  // Adressen-Index: person_id -> adresse
  const adressenIndex = {};
  for (const a of adressen) {
    adressenIndex[a.person_id] = a;
  }

  // Aktuelle Mitglieder seitenweise laden (Rate-Limit vermeiden)
  const existingByKey = {};
  let page = 0;
  const pageSize = 200;
  while (true) {
    const chunk = await base44.asServiceRole.entities.Mitglied.list('nachname', pageSize, page * pageSize);
    for (const m of chunk) {
      const geb = m.geburtsdatum || '';
      const key = `${m.nachname}|${m.vorname}|${geb}`;
      existingByKey[key] = m;
      const keyOhne = `${m.nachname}|${m.vorname}|`;
      if (!existingByKey[keyOhne]) existingByKey[keyOhne] = m;
    }
    if (chunk.length < pageSize) break;
    page++;
    await new Promise(r => setTimeout(r, 200));
  }

  const total = personen.length;
  const batch = personen.slice(offset, offset + limit);

  const preview = [];
  let updated = 0, created = 0, skipped = 0;

  for (const p of batch) {
    const gebISO = p.geburtsdatum || null;
    const matchKey = `${p.nachname}|${p.vorname}|${gebISO || ''}`;
    const matchKeyOhne = `${p.nachname}|${p.vorname}|`;
    const existing = existingByKey[matchKey] || existingByKey[matchKeyOhne];

    const kontakt = kontakteIndex[p.person_id] || {};
    const adresse = adressenIndex[p.person_id] || {};
    const telefon = kontakt.mobil || kontakt.telefon || null;

    let austrittsdatum = null;
    if (p.status_gesamt === 'resigned') {
      // Prüfe ob Austrittsdatum in Kommentaren – hier leer lassen, nur Status setzen
      austrittsdatum = null;
    }

    const data = {
      vorname: p.vorname,
      nachname: p.nachname,
      ...(gebISO ? { geburtsdatum: gebISO } : {}),
      mitgliedsstatus: STATUS_MAP[p.status_gesamt] || 'Passiv',
      ...(telefon ? { telefon } : {}),
      ...(kontakt.email ? { email: kontakt.email } : {}),
      ...(adresse.strasse_hausnr ? { strasse: adresse.strasse_hausnr } : {}),
      ...(adresse.plz ? { plz: adresse.plz } : {}),
      ...(adresse.ort ? { ort: adresse.ort } : {}),
    };

    if (mode === 'preview') {
      preview.push({
        person_id: p.person_id,
        vorname: p.vorname,
        nachname: p.nachname,
        geburtsdatum: gebISO,
        status: p.status_gesamt,
        match: existing ? `✓ ${existing.vorname} ${existing.nachname} (ID: ${existing.id})` : '➕ Neu anlegen',
        aktion: existing ? 'update' : 'create',
        daten: data,
      });
    } else {
      // Ausführen
      if (existing) {
        await base44.asServiceRole.entities.Mitglied.update(existing.id, data);
        updated++;
      } else {
        await base44.asServiceRole.entities.Mitglied.create(data);
        created++;
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const done = offset + batch.length >= total;

  return Response.json({
    success: true,
    mode,
    total,
    processed: batch.length,
    updated,
    created,
    skipped,
    done,
    next_offset: done ? null : offset + limit,
    ...(mode === 'preview' ? { preview } : {}),
    message: mode === 'preview'
      ? `Vorschau: ${batch.length} von ${total} Personen`
      : done
        ? `Fertig! ${updated} aktualisiert, ${created} neu angelegt`
        : `Batch ${offset}–${offset + batch.length} von ${total} verarbeitet`,
  });
});