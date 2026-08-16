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

    const allMembers = await base44.asServiceRole.entities.Mitglied.list(500);

    function normalize(name) {
      return name.toLowerCase().trim().replace(/\.$/, '')
        .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
        .replace(/é/g, 'e').replace(/è/g, 'e').replace(/á/g, 'a')
        .replace(/[^a-z\s-]/g, '').replace(/\s+/g, ' ').trim();
    }

    function tryMatch(excelName) {
      const excelNorm = normalize(excelName);
      const parts = excelNorm.split(/\s+/);
      
      for (const m of allMembers) {
        const memberFull = normalize(`${m.vorname} ${m.nachname}`);
        if (excelNorm === memberFull) return { id: m.id, name: `${m.vorname} ${m.nachname}`, confidence: 'exact' };
      }
      
      if (parts.length >= 2) {
        const first = parts[0];
        const last = parts[parts.length - 1];
        for (const m of allMembers) {
          const mFirst = normalize(m.vorname);
          const mLast = normalize(m.nachname);
          if (first === mFirst && last.length >= 3) {
            if (mLast.startsWith(last) || last.startsWith(mLast.substring(0, last.length))) {
              return { id: m.id, name: `${m.vorname} ${m.nachname}`, confidence: 'abbrev' };
            }
          }
        }
      }
      
      if (parts.length >= 2) {
        const first = parts[0];
        const last = parts[parts.length - 1];
        for (const m of allMembers) {
          const mFirst = normalize(m.vorname);
          const mLast = normalize(m.nachname);
          if (first === mFirst && mLast.length > 3 && last.length > 2) {
            if (mLast.substring(0, 3) === last.substring(0, 3) && Math.abs(mLast.length - last.length) <= 5) {
              return { id: m.id, name: `${m.vorname} ${m.nachname}`, confidence: 'fuzzy' };
            }
          }
        }
      }
      
      if (parts.length >= 2) {
        const last = parts[0];
        const first = parts[parts.length - 1];
        for (const m of allMembers) {
          const mFirst = normalize(m.vorname);
          const mLast = normalize(m.nachname);
          if (first === mFirst && last.length >= 3 && mLast.startsWith(last)) {
            return { id: m.id, name: `${m.vorname} ${m.nachname}`, confidence: 'reversed' };
          }
        }
      }
      
      if (parts.length >= 2) {
        const first = parts[0];
        const last = parts[parts.length - 1];
        for (const m of allMembers) {
          const mFirst = normalize(m.vorname);
          const mLast = normalize(m.nachname);
          if (first === mFirst && Math.abs(mLast.length - last.length) <= 1) {
            let diff = 0;
            const minLen = Math.min(mLast.length, last.length);
            for (let i = 0; i < minLen; i++) {
              if (mLast[i] !== last[i]) diff++;
            }
            diff += Math.abs(mLast.length - last.length);
            if (diff <= 1) {
              return { id: m.id, name: `${m.vorname} ${m.nachname}`, confidence: 'typo' };
            }
          }
        }
      }
      
      return null;
    }

    const body = await req.json();
    const owners = body.owners || [];

    // Only return stats + unmatched + ambiguous (compact)
    const stats = { total: 0, exact: 0, abbrev: 0, fuzzy: 0, reversed: 0, typo: 0, unmatched: 0 };
    const unmatched = [];
    const matchedCount = {};
    const ambiguous = [];
    const matchedMap = {};

    for (const owner of owners) {
      stats.total++;
      const match = tryMatch(owner);
      if (match) {
        stats[match.confidence]++;
        matchedMap[owner] = match;
        if (!matchedCount[match.id]) matchedCount[match.id] = [];
        matchedCount[match.id].push(owner);
      } else {
        stats.unmatched++;
        unmatched.push(owner);
      }
    }

    // Find ambiguous (multiple Excel names -> same member)
    for (const [memberId, excelNames] of Object.entries(matchedCount)) {
      if (excelNames.length > 1) {
        const member = allMembers.find(m => m.id === memberId);
        ambiguous.push({
          member: member ? `${member.vorname} ${member.nachname}` : memberId,
          excelNames
        });
      }
    }

    return Response.json({
      stats,
      unmatched,
      ambiguous,
      // Only include fuzzy/abbrev/typo/reversed matches for verification
      needsVerification: Object.fromEntries(
        Object.entries(matchedMap).filter(([_, m]) => m.confidence !== 'exact')
      )
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
