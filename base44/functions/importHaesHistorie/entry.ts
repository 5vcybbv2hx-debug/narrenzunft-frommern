import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Importiert Häs-Historie aus einer Excel/CSV-Datei.
 * Erwartet Zeilen mit: haesnummer, vorname, nachname, von_datum, bis_datum, notizen
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

    // Alle Häs und Mitglieder laden
    const [alleHaes, alleMitglieder] = await Promise.all([
      base44.asServiceRole.entities.Haes.list('haesnummer', 5000),
      base44.asServiceRole.entities.Mitglied.list('nachname', 5000),
    ]);

    const results = { erfolg: 0, fehler: [], uebersprungen: 0 };

    for (const row of rows) {
      const haesnummer = String(row.haesnummer || '').trim();
      const vorname = String(row.vorname || '').trim();
      const nachname = String(row.nachname || '').trim();
      const von_datum = row.von_datum ? String(row.von_datum).trim() : null;
      const bis_datum = row.bis_datum ? String(row.bis_datum).trim() : null;
      const notizen = row.notizen ? String(row.notizen).trim() : '';

      if (!haesnummer || !nachname) {
        results.fehler.push({ row, grund: 'Häsnummer oder Nachname fehlt' });
        continue;
      }

      // Häs finden
      const haes = alleHaes.find(h => String(h.haesnummer).trim() === haesnummer);
      if (!haes) {
        results.fehler.push({ row, grund: `Häs #${haesnummer} nicht gefunden` });
        continue;
      }

      // Mitglied finden (Nachname + optional Vorname)
      let mitglied = alleMitglieder.find(m =>
        m.nachname?.toLowerCase() === nachname.toLowerCase() &&
        (vorname ? m.vorname?.toLowerCase() === vorname.toLowerCase() : true)
      );

      if (!mitglied && vorname) {
        // Fallback: nur Nachname
        mitglied = alleMitglieder.find(m => m.nachname?.toLowerCase() === nachname.toLowerCase());
      }

      if (!mitglied) {
        results.fehler.push({ row, grund: `Mitglied "${vorname} ${nachname}" nicht gefunden` });
        continue;
      }

      // Datum parsen (DD.MM.YYYY oder YYYY-MM-DD)
      const parseDate = (str) => {
        if (!str) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        const parts = str.split('.');
        if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        return null;
      };

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

      results.erfolg++;
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});