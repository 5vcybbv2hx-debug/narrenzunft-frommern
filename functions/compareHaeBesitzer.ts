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

    const allHaes = await base44.asServiceRole.entities.Haes.list(500);
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
        if (excelNorm === normalize(`${m.vorname} ${m.nachname}`)) return m.id;
      }
      if (parts.length >= 2) {
        const first = parts[0]; const last = parts[parts.length - 1];
        for (const m of allMembers) {
          const mFirst = normalize(m.vorname); const mLast = normalize(m.nachname);
          if (first === mFirst && last.length >= 3 && (mLast.startsWith(last) || last.startsWith(mLast.substring(0, last.length)))) return m.id;
        }
      }
      if (parts.length >= 2) {
        const first = parts[0]; const last = parts[parts.length - 1];
        for (const m of allMembers) {
          const mFirst = normalize(m.vorname); const mLast = normalize(m.nachname);
          if (first === mFirst && mLast.length > 3 && last.length > 2 && mLast.substring(0, 3) === last.substring(0, 3) && Math.abs(mLast.length - last.length) <= 5) return m.id;
        }
      }
      return null;
    }

    const body = await req.json();
    const excelOwners = body.owners || {};
    const dbHaesMap = {};
    for (const h of allHaes) {
      if (h.haesnummer) dbHaesMap[h.haesnummer] = h;
    }

    // Categorize discrepancies
    const realDiscrepancies = [];   // Excel matched to member, but DB has different member
    const excelUnmatched = [];      // Excel name couldn't be matched to any member
    const dbOnly = [];              // In DB but not in Excel
    let matchedCount = 0;

    for (const [dbNr, excelData] of Object.entries(excelOwners)) {
      const dbHaes = dbHaesMap[dbNr];
      if (!dbHaes) continue;

      const dbOwnerId = dbHaes.aktueller_besitzer_id;
      const dbOwnerName = dbOwnerId ? (memberMap[dbOwnerId] || `Unbekannt`) : 'Kein Besitzer';
      const excelOwnerName = excelData.owner;
      const excelOwnerId = tryMatchMember(excelOwnerName);

      if (dbOwnerId === excelOwnerId) {
        matchedCount++;
      } else if (excelOwnerId) {
        // Excel found a member, but DB has different owner - REAL discrepancy
        realDiscrepancies.push({
          haesnummer: dbNr,
          db_owner: dbOwnerName,
          excel_owner: excelOwnerName,
          excel_owner_matched: memberMap[excelOwnerId],
          db_status: dbHaes.status
        });
      } else {
        // Excel name couldn't be matched - could be same person with different spelling
        excelUnmatched.push({
          haesnummer: dbNr,
          db_owner: dbOwnerName,
          excel_owner: excelOwnerName,
          db_status: dbHaes.status
        });
      }
    }

    for (const h of allHaes) {
      if (!excelOwners[h.haesnummer]) {
        const ownerName = h.aktueller_besitzer_id ? (memberMap[h.aktueller_besitzer_id] || 'Unbekannt') : 'Kein Besitzer';
        dbOnly.push({ haesnummer: h.haesnummer, db_owner: ownerName, db_status: h.status });
      }
    }

    return Response.json({
      stats: {
        matched: matchedCount,
        real_discrepancies: realDiscrepancies.length,
        excel_unmatched: excelUnmatched.length,
        db_only: dbOnly.length,
        total_db: allHaes.length,
        total_excel: Object.keys(excelOwners).length
      },
      real_discrepancies,
      excel_unmatched: excelUnmatched.slice(0, 40),
      db_only: dbOnly.slice(0, 30)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
