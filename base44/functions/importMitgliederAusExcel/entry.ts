import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { file_url } = await req.json();

    if (!file_url) {
      return Response.json({ error: "file_url erforderlich" }, { status: 400 });
    }

    // XLSX laden
    const xlsx = await import("npm:xlsx@0.18.5");
    const response = await fetch(file_url);
    const buffer = await response.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "array" });
    const sheet = workbook.Sheets["AdresseExcel"];
    
    if (!sheet) {
      return Response.json({ error: "Sheet 'AdresseExcel' nicht gefunden" }, { status: 400 });
    }

    const data = xlsx.utils.sheet_to_json(sheet);

    // Lade alle Häsgruppen und aktuellen Mitglieder
    const [allGruppen, allMitglieder, allHaes] = await Promise.all([
      base44.entities.Haesgruppe.list("name", 100),
      base44.entities.Mitglied.list("nachname", 500),
      base44.entities.Haes.list("haesnummer", 1000),
    ]);

    const gruppeMap = new Map(allGruppen.map(g => [g.name.toLowerCase(), g.id]));
    const mitgliedMap = new Map(allMitglieder.map(m => [
      `${m.nachname.toLowerCase()}|${m.vorname.toLowerCase()}`,
      m.id
    ]));

    let results = {
      mitglieder_created: 0,
      mitglieder_updated: 0,
      mitglieder_failed: 0,
      haes_assigned: 0,
      haes_failed: 0,
      processed: 0,
    };

    // Verarbeite Zeilen
    for (const row of data) {
      const vorname = (row.Vorname || "").trim();
      const nachname = (row.Name || "").trim();
      const sparte = (row.Sparte || "").trim(); // = Maskengruppe
      const haesnummer = row.Häsnummer ? String(row.Häsnummer).trim() : null;

      if (!vorname || !nachname) continue;

      const key = `${nachname.toLowerCase()}|${vorname.toLowerCase()}`;
      let mitgliedId = mitgliedMap.get(key);

      // Erstelle Mitglied wenn nicht vorhanden
      if (!mitgliedId) {
        try {
          const neu = await base44.entities.Mitglied.create({
            vorname,
            nachname,
            mitgliedsstatus: "Aktiv",
          });
          mitgliedId = neu.id;
          results.mitglieder_created++;
          mitgliedMap.set(key, mitgliedId);
        } catch (e) {
          results.mitglieder_failed++;
          continue;
        }
      } else {
        results.mitglieder_updated++;
      }

      // Häs-Zuordnung wenn Häsnummer und Sparte vorhanden
      if (haesnummer && sparte) {
        try {
          const haes = allHaes.find(h => h.haesnummer === haesnummer);
          if (haes) {
            const gruppeId = gruppeMap.get(sparte.toLowerCase());
            const heute = new Date().toISOString().split('T')[0];

            // Historia anlegen
            await base44.entities.HaesHistorie.create({
              haes_id: haes.id,
              mitglied_id: mitgliedId,
              von_datum: heute,
              aktiv: true,
              notizen: "",
            });

            // Häs aktualisieren
            await base44.entities.Haes.update(haes.id, {
              aktueller_besitzer_id: mitgliedId,
              haesgruppe_id: gruppeId || undefined,
              status: "Verliehen",
            });

            results.haes_assigned++;
          }
        } catch (e) {
          results.haes_failed++;
        }
      }

      results.processed++;
    }

    return Response.json({
      success: true,
      ...results,
      total_rows: data.length,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});