import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Importiert Häs + Häs-Historie aus einer Excel-Tabelle.
 * Jede Zeile repräsentiert einen Häs-Träger-Zeitraum.
 * Erwartet Spalten: haesnummer, vorname, nachname, von_datum, bis_datum, notizen
 * Optional: bezeichnung, haesgruppe (Name der Gruppe), vereinseigentum (ja/nein)
 *
 * Häs wird automatisch angelegt falls es noch nicht existiert.
 * Die letzte (aktive) Zuweisung setzt aktueller_besitzer_id am Häs.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Nur Admins dürfen Häs-Historien importieren' }, { status: 403 });
    }

    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ error: 'Keine Daten übergeben' }, { status: 400 });
    }

    // Alle Häs, Mitglieder und Gruppen laden
    const [alleHaes, alleMitglieder, alleGruppen] = await Promise.all([
      base44.asServiceRole.entities.Haes.list('haesnummer', 5000),
      base44.asServiceRole.entities.Mitglied.list('nachname', 5000),
      base44.asServiceRole.entities.Haesgruppe.list('name', 500),
    ]);

    // Datum parsen (DD.MM.YYYY oder YYYY-MM-DD oder nur Jahr)
    const parseDate = (str) => {
      if (!str) return null;
      const s = String(str).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
        const parts = s.split('.');
        return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      }
      if (/^\d{4}$/.test(s)) return `${s}-01-01`;
      return null;
    };

    const results = { erfolg: 0, haes_angelegt: 0, fehler: [], uebersprungen: 0 };

    // Häs-Cache für neu angelegte Häs (um doppeltes Anlegen zu vermeiden)
    const haesCache = {};
    for (const h of alleHaes) {
      haesCache[String(h.haesnummer).trim()] = h;
    }

    for (const row of rows) {
      const haesnummer = String(row.haesnummer || '').trim();
      const vorname = String(row.vorname || '').trim();
      const nachname = String(row.nachname || '').trim();
      const von_datum = row.von_datum ? String(row.von_datum).trim() : null;
      const bis_datum = row.bis_datum ? String(row.bis_datum).trim() : null;
      const notizen = row.notizen ? String(row.notizen).trim() : '';
      const bezeichnung = row.bezeichnung ? String(row.bezeichnung).trim() : '';
      const haesgruppeName = row.haesgruppe ? String(row.haesgruppe).trim() : '';
      const vereinseigentum = ['ja','yes','1','true'].includes(String(row.vereinseigentum || '').toLowerCase());

      if (!haesnummer) {
        results.fehler.push({ row, grund: 'Häsnummer fehlt' });
        continue;
      }

      // Mitglied ist optional (leere Zeilen = nur Häs ohne Träger)
      let mitglied = null;
      if (nachname) {
        mitglied = alleMitglieder.find(m =>
          m.nachname?.toLowerCase() === nachname.toLowerCase() &&
          (vorname ? m.vorname?.toLowerCase() === vorname.toLowerCase() : true)
        );
        if (!mitglied && vorname) {
          mitglied = alleMitglieder.find(m => m.nachname?.toLowerCase() === nachname.toLowerCase());
        }
        if (!mitglied) {
          results.fehler.push({ row, grund: `Mitglied "${vorname} ${nachname}" nicht gefunden` });
          continue;
        }
      }

      // Gruppe suchen
      let haesgruppe_id = null;
      if (haesgruppeName) {
        const gruppe = alleGruppen.find(g => g.name.toLowerCase() === haesgruppeName.toLowerCase());
        if (gruppe) haesgruppe_id = gruppe.id;
      }

      // Häs suchen oder anlegen
      let haes = haesCache[haesnummer];
      if (!haes) {
        haes = await base44.asServiceRole.entities.Haes.create({
          haesnummer,
          bezeichnung: bezeichnung || haesnummer,
          status: 'Frei',
          vereinseigentum,
          haesgruppe_id,
        });
        haesCache[haesnummer] = haes;
        results.haes_angelegt++;
      } else if (haesgruppe_id && !haes.haesgruppe_id) {
        // Gruppe nachtragen falls noch nicht gesetzt
        await base44.asServiceRole.entities.Haes.update(haes.id, { haesgruppe_id });
        haesCache[haesnummer] = { ...haes, haesgruppe_id };
        haes = haesCache[haesnummer];
      }

      // Nur Historieneintrag wenn Mitglied vorhanden
      if (mitglied) {
        const vonParsed = parseDate(von_datum);
        const bisParsed = parseDate(bis_datum);
        const istAktiv = !bisParsed;

        await base44.asServiceRole.entities.HaesHistorie.create({
          haes_id: haes.id,
          mitglied_id: mitglied.id,
          von_datum: vonParsed,
          bis_datum: bisParsed,
          aktiv: istAktiv,
          notizen,
        });

        // Wenn aktiv → aktueller Besitzer setzen
        if (istAktiv) {
          await base44.asServiceRole.entities.Haes.update(haes.id, {
            aktueller_besitzer_id: mitglied.id,
            status: 'Verliehen',
          });
          haesCache[haesnummer] = { ...haesCache[haesnummer], aktueller_besitzer_id: mitglied.id, status: 'Verliehen' };
        }
      }

      results.erfolg++;
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});