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

    // Header parsen (Semicolon-separated)
    const header = lines[0].split(";").map(h => h.trim());
    
    // Position der Spalten ermitteln (hardcoded nach Analyse)
    const vornameIdx = 8; // Vorname
    const nachnameIdx = 7; // Nachname
    const statusIdx = 6; // Status
    const hasnummerIdx = 17; // H*snummer(n) - encoding kaputt
    const gruppeIdx = 31; // Maskengruppe

    // Gebe Detail-Log zurück
    const logIndices = {
      hasnummerIdx,
      gruppeIdx,
      vornameIdx,
      nachnameIdx,
      statusIdx,
      headerLength: header.length,
      header: header.slice(0, 20), // First 20 columns
    };
    
    if (hasnummerIdx === -1 || gruppeIdx === -1 || vornameIdx === -1 || nachnameIdx === -1) {
      return Response.json({
        error: "CSV-Spalten fehlen",
        indices: logIndices,
      }, { status: 400 });
    }

    // Lade alle Häsgruppen und Häs
    const [allGruppen, allHaes, allMitglieder] = await Promise.all([
      base44.entities.Haesgruppe.list("name", 100),
      base44.entities.Haes.list("haesnummer", 1000),
      base44.entities.Mitglied.list("nachname", 500),
    ]);

    // Maps erstellen
    const gruppeMap = new Map(allGruppen.map(g => [g.name.toLowerCase(), g.id]));
    const haesMap = new Map(allHaes.map(h => [h.haesnummer, h.id]));
    const mitgliedMap = new Map(
      allMitglieder.map(m => [
        `${m.nachname.toLowerCase()}|${m.vorname.toLowerCase()}`,
        m.id
      ])
    );

    let results = {
      haesGruppe_updated: 0,
      haesGruppe_failed: 0,
      mitglied_haes_assigned: 0,
      mitglied_haes_failed: 0,
      processed: 0,
    };

    // Verarbeite CSV-Zeilen
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";").map(c => c.trim());
      const vorname = cols[vornameIdx]?.trim();
      const nachname = cols[nachnameIdx]?.trim();
      const hasnummernRaw = cols[hasnummerIdx]?.trim();
      const gruppeRaw = cols[gruppeIdx]?.trim();

      if (!vorname || !nachname) continue;

      // Parse Häsnummern (komma- oder & separiert)
      const hasnummern = hasnummernRaw
        ? hasnummernRaw.split(/[,&]/).map(h => h.trim()).filter(h => h && h !== "0")
        : [];

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

      // Häsnummern aktualisieren
      for (const hasNum of hasnummern) {
        const haesId = haesMap.get(hasNum);
        if (haesId) {
          try {
            const updateData = { status: "Aktiv" };
            if (gruppeId) updateData.haesgruppe_id = gruppeId;
            await base44.entities.Haes.update(haesId, updateData);
            results.haesGruppe_updated++;
          } catch (e) {
            results.haesGruppe_failed++;
            console.log(`Fehler bei Häs ${hasNum}:`, e.message);
          }
        }
      }

      // Mitglied zuordnen wenn vorhanden
      const mitgliedId = mitgliedMap.get(
        `${nachname.toLowerCase()}|${vorname.toLowerCase()}`
      );
      if (mitgliedId && hasnummern.length > 0) {
        // Erste Häsnummer als aktueller Besitzer
        const firstHasNum = hasnummern[0];
        const haesId = haesMap.get(firstHasNum);
        if (haesId) {
          try {
            // Historia anlegen
            const heute = new Date().toISOString().split('T')[0];
            await base44.entities.HaesHistorie.create({
              haes_id: haesId,
              mitglied_id: mitgliedId,
              von_datum: heute,
              aktiv: true,
              notizen: "",
            });
            // Häs aktualisieren
            await base44.entities.Haes.update(haesId, {
              aktueller_besitzer_id: mitgliedId,
            });
            results.mitglied_haes_assigned++;
          } catch (e) {
            results.mitglied_haes_failed++;
            console.log(`Fehler bei Mitglied ${vorname} ${nachname}:`, e.message);
          }
        }
      }

      results.processed++;
    }

    return Response.json({
      success: true,
      ...results,
      total_rows: lines.length - 1,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});