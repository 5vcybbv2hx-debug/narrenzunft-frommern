import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { csv_url } = await req.json();

    if (!csv_url) {
      return Response.json({ error: "csv_url erforderlich" }, { status: 400 });
    }

    // CSV laden
    const csvResponse = await fetch(csv_url);
    const csvText = await csvResponse.text();
    const lines = csvText.split("\n").filter(l => l.trim());

    if (lines.length < 2) {
      return Response.json({ error: "CSV leer oder ungültig" }, { status: 400 });
    }

    // Header parsen (Comma-separated)
    const header = lines[0].split(",").map(h => h.trim());
    
    // Spalten nach Position (0-basiert)
    const hasnummerIdx = 0;   // Spalte A
    const gruppeIdx = 2;      // Spalte C (Sparte/Maskengruppe)
    const nachnameIdx = 3;    // Spalte D
    const vornameIdx = 4;     // Spalte E

    // Lade Häsgruppen, Häs und Mitglieder
    const [allGruppen, allHaes, allMitglieder] = await Promise.all([
      base44.entities.Haesgruppe.list("name", 100),
      base44.entities.Haes.list("haesnummer", 1000),
      base44.entities.Mitglied.list("nachname", 500),
    ]);

    // Maps erstellen
    const gruppeMap = new Map(allGruppen.map(g => [g.name.toLowerCase(), g.id]));
    const haesMap = new Map(allHaes.map(h => [h.haesnummer, h.id]));
    const mitgliedMap = new Map(allMitglieder.map(m => [
      `${m.nachname.toLowerCase()}|${m.vorname.toLowerCase()}`,
      m.id
    ]));

    let results = {
      haes_updated: 0,
      haes_failed: 0,
      processed: 0,
    };

    // Sammle alle Updates
    const updates = [];
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      const hasnummernRaw = cols[hasnummerIdx]?.trim();
      
      if (!hasnummernRaw || hasnummernRaw === "0") continue;
      
      const vornameRaw = cols[vornameIdx]?.trim();
      const nachnameRaw = cols[nachnameIdx]?.trim();
      const gruppeRaw = cols[gruppeIdx]?.trim();

      // Parse Häsnummern (komma- oder & separiert)
      const hasnummern = hasnummernRaw
        ? hasnummernRaw.split(/[,&]/).map(h => h.trim()).filter(h => h && h !== "0")
        : [];

      if (hasnummern.length === 0) continue;

      // Mitglied finden
      let mitgliedId = null;
      if (vornameRaw && nachnameRaw) {
        const key = `${nachnameRaw.toLowerCase()}|${vornameRaw.toLowerCase()}`;
        mitgliedId = mitgliedMap.get(key);
      }

      // Häsgruppe aus Name ermitteln
      let gruppeId = null;
      if (gruppeRaw) {
        const key = gruppeRaw.toLowerCase();
        gruppeId = gruppeMap.get(key);
        if (!gruppeId) {
          // Versuche Fuzzy-Match
          for (const [gName, gId] of gruppeMap) {
            if (gName.includes(key) || key.includes(gName)) {
              gruppeId = gId;
              break;
            }
          }
        }
      }

      // Sammle Updates (nur wenn beide vorhanden)
      for (const hasNum of hasnummern) {
        const haesId = haesMap.get(hasNum);
        if (haesId && gruppeId && mitgliedId) {
          updates.push({ haesId, hasNum, gruppeId, mitgliedId });
        }
      }

      results.processed++;
    }

    // Führe Updates in Batches durch
    const batchSize = 5;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (upd) => {
        try {
          await base44.entities.Haes.update(upd.haesId, {
            status: "Verliehen",
            haesgruppe_id: upd.gruppeId,
            aktueller_besitzer_id: upd.mitgliedId,
          });
          results.haes_updated++;
        } catch (e) {
          results.haes_failed++;
          console.log(`Fehler bei Häs ${upd.hasNum}:`, e.message);
        }
      }));

      // Längere Pause zwischen Batches
      if (i + batchSize < updates.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return Response.json({
      success: true,
      ...results,
      total_rows: lines.length - 1,
      updates_queued: updates.length,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});