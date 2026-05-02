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
    const lines = csvText.split("\n").filter(l => l.trim());

    if (lines.length < 2) {
      return Response.json({ error: "CSV leer oder ungültig" }, { status: 400 });
    }

    // Parse Header
    const header = lines[0].split(";").map(h => h.trim());
    console.log("CSV Header:", header);

    // Finde Spalten flexibel
    const vornameIdx = header.findIndex(h => h.includes("Vorname"));
    const nachnameIdx = header.findIndex(h => h.includes("Nachname"));
    const hasnummerIdx = header.findIndex(h => h.includes("snummer"));

    console.log("Indices:", { vornameIdx, nachnameIdx, hasnummerIdx });

    if (vornameIdx === -1 || nachnameIdx === -1 || hasnummerIdx === -1) {
      return Response.json({ 
        error: "CSV-Spalten fehlen",
        header: header,
        expected: ["Vorname", "Nachname", "Hsnummer"]
      }, { status: 400 });
    }

    // Lade alle Häs und Mitglieder
    const [allHaes, allMitglieder] = await Promise.all([
      base44.entities.Haes.list("haesnummer", 1000),
      base44.entities.Mitglied.list("nachname", 500),
    ]);

    const haesMap = new Map(allHaes.map(h => [h.haesnummer, h.id]));
    const mitgliedMap = new Map(
      allMitglieder.map(m => [m.nachname.toLowerCase() + "|" + m.vorname.toLowerCase(), m.id])
    );

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      processed: 0,
    };

    // Verarbeite Batch
    for (let i = offset + 1; i < Math.min(offset + limit + 1, lines.length); i++) {
      const cols = lines[i].split(";").map(c => c.trim());
      const vorname = cols[vornameIdx]?.trim();
      const nachname = cols[nachnameIdx]?.trim();
      const hasnummernRaw = cols[hasnummerIdx]?.trim();
      const hasnummern = hasnummernRaw?.split("&").map(h => h.trim()).filter(h => h && h !== "0") || [];

      if (!vorname || !nachname || hasnummern.length === 0) continue;

      const mitgliedId = mitgliedMap.get(nachname.toLowerCase() + "|" + vorname.toLowerCase());
      if (!mitgliedId) {
        results.failed++;
        continue;
      }

      for (const hasNum of hasnummern) {
        const haesId = haesMap.get(hasNum);
        if (haesId) {
          await base44.entities.Haes.update(haesId, { aktueller_besitzer_id: mitgliedId });
          results.updated++;
        }
      }

      results.processed++;
    }

    return Response.json({
      success: true,
      ...results,
      total: lines.length - 1,
      next_offset: offset + limit,
      done: offset + limit >= lines.length - 1,
      message: `Batch ${offset + 1}-${Math.min(offset + limit, lines.length - 1)} von ${lines.length - 1} verarbeitet`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});