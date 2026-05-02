import { parse } from "npm:csv-parse@5";
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { csv_url, offset = 0, limit = 50 } = await req.json();

    if (!csv_url) {
      return Response.json({ error: "csv_url erforderlich" }, { status: 400 });
    }

    const csvResponse = await fetch(csv_url);
    const csvText = await csvResponse.text();

    const records = [];
    await new Promise((resolve, reject) => {
      parse(csvText, {
        columns: true,
        delimiter: ";",
        skip_empty_lines: true,
        on_record: (record) => records.push(record),
        on_error: reject,
        on_end: resolve,
      });
    });

    // Verarbeite nur ein Batch
    const batch = records.slice(offset, offset + limit);
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      processed: 0,
    };

    for (const record of batch) {
      if (!record.Mitgliedsnummer || !record["Hsnummer(n)"]) continue;

      const hasnummern = record["Hsnummer(n)"]
        .split("&")
        .map((h) => h.trim())
        .filter((h) => h && h !== "0");

      if (hasnummern.length === 0) continue;

      try {
        // Suche das Mitglied
        const mitglieder = await base44.entities.Mitglied.filter({
          "Mitgliedsnummer": record.Mitgliedsnummer
        });

        if (mitglieder.length === 0) {
          results.failed++;
          continue;
        }

        const mitglied = mitglieder[0];

        // Für jede Häs-Nummer: finde die Häs und setze den Besitzer
        for (const hasNum of hasnummern) {
          const haes = await base44.entities.Haes.filter({
            haesnummer: hasNum
          });

          if (haes.length > 0) {
            await base44.entities.Haes.update(haes[0].id, {
              aktueller_besitzer_id: mitglied.id
            });
            results.updated++;
          }
        }

        results.processed++;
      } catch (e) {
        console.error(`Fehler bei Mitglied ${record.Mitgliedsnummer}:`, e.message);
        results.failed++;
      }
    }

    return Response.json({
      success: true,
      ...results,
      total: records.length,
      next_offset: offset + limit,
      done: offset + limit >= records.length,
      message: `Batch ${offset}-${offset + limit} von ${records.length} verarbeitet`
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});