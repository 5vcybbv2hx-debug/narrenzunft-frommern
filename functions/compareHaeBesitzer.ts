import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const erlaubteRollen = ['admin', 'vorstand', 'stellv_vorstand'];
    if (!erlaubteRollen.includes(user.role)) {
      return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    // Load ALL Häs from DB
    const allHaes = await base44.asServiceRole.entities.Haes.list(500);
    
    // Load ALL members for name lookup
    const allMembers = await base44.asServiceRole.entities.Mitglied.list(500);
    const memberMap = {};
    for (const m of allMembers) {
      memberMap[m.id] = `${m.vorname} ${m.nachname}`;
    }

    function normalize(name) {
      return name.toLowerCase().trim().replace(/\.$/, '')
        .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
        .replace(/é/g, 'e').replace(/è/g, 'e').replace(/á/g, 'a')
        .replace(/[^a-z\s-]/g, '').replace(/\s+/g, ' ').trim();
    }

    function tryMatchMember(excelName) {
      const excelNorm = normalize(excelName);
      const parts = excelNorm.split(/\s+/);
      
      for (const m of allMembers) {
        const memberFull = normalize(`${m.vorname} ${m.nachname}`);
        if (excelNorm === memberFull) return m.id;
      }
      
      // Abbreviated surname
      if (parts.length >= 2) {
        const first = parts[0];
        const last = parts[parts.length - 1];
        for (const m of allMembers) {
          const mFirst = normalize(m.vorname);
          const mLast = normalize(m.nachname);
          if (first === mFirst && last.length >= 3) {
            if (mLast.startsWith(last) || last.startsWith(mLast.substring(0, last.length))) {
              return m.id;
            }
          }
        }
      }
      
      // Fuzzy
      if (parts.length >= 2) {
        const first = parts[0];
        const last = parts[parts.length - 1];
        for (const m of allMembers) {
          const mFirst = normalize(m.vorname);
          const mLast = normalize(m.nachname);
          if (first === mFirst && mLast.length > 3 && last.length > 2) {
            if (mLast.substring(0, 3) === last.substring(0, 3) && Math.abs(mLast.length - last.length) <= 5) {
              return m.id;
            }
          }
        }
      }
      
      return null;
    }

    // Get Excel current owners from request
    const body = await req.json();
    const excelOwners = body.owners || {};

    // Build DB Häs map by haesnummer
    const dbHaesMap = {};
    for (const h of allHaes) {
      if (h.haesnummer) {
        dbHaesMap[h.haesnummer] = h;
      }
    }

    const discrepancies = [];
    const matched = [];
    const excelOnly = [];  // In Excel but not in DB
    const dbOnly = [];  // In DB but not in Excel

    // Compare each Excel Häs with DB
    for (const [dbNr, excelData] of Object.entries(excelOwners)) {
      const dbHaes = dbHaesMap[dbNr];
      if (!dbHaes) {
        // Check if it's a special Häs (Bauer, ZM, etc.)
        excelOnly.push({
          haesnummer: dbNr,
          excel_name: excelData.excel_nr,
          excel_owner: excelData.owner
        });
        continue;
      }

      const dbOwnerId = dbHaes.aktueller_besitzer_id;
      const dbOwnerName = dbOwnerId ? (memberMap[dbOwnerId] || `Unbekannt (${dbOwnerId})`) : 'Kein Besitzer';
      const excelOwnerName = excelData.owner;
      const excelOwnerId = tryMatchMember(excelOwnerName);

      if (dbOwnerId === excelOwnerId) {
        matched.push({ haesnummer: dbNr, owner: dbOwnerName });
      } else {
        discrepancies.push({
          haesnummer: dbNr,
          db_owner: dbOwnerName,
          db_owner_id: dbOwnerId,
          excel_owner: excelOwnerName,
          excel_owner_id: excelOwnerId,
          excel_matched: excelOwnerId !== null,
          db_status: dbHaes.status
        });
      }
    }

    // Find DB Häs not in Excel
    for (const h of allHaes) {
      if (!excelOwners[h.haesnummer]) {
        const ownerName = h.aktueller_besitzer_id ? (memberMap[h.aktueller_besitzer_id] || `Unbekannt`) : 'Kein Besitzer';
        dbOnly.push({
          haesnummer: h.haesnummer,
          db_owner: ownerName,
          db_status: h.status
        });
      }
    }

    return Response.json({
      stats: {
        matched: matched.length,
        discrepancies: discrepancies.length,
        excel_only: excelOnly.length,
        db_only: dbOnly.length,
        total_db: allHaes.length,
        total_excel: Object.keys(excelOwners).length
      },
      discrepancies,
      excel_only: excelOnly.slice(0, 30),
      db_only: dbOnly.slice(0, 30)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
