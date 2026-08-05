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

    // Load ALL members (service role to bypass RLS)
    const allMembers = await base44.asServiceRole.entities.Mitglied.list(500);

    // Normalize function
    function normalize(name) {
      return name.toLowerCase().trim().replace(/\.$/, '')
        .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
        .replace(/é/g, 'e').replace(/è/g, 'e').replace(/á/g, 'a')
        .replace(/[^a-z\s-]/g, '').replace(/\s+/g, ' ').trim();
    }

    function tryMatch(excelName) {
      const excelNorm = normalize(excelName);
      const parts = excelNorm.split(/\s+/);
      
      // Try exact match
      for (const m of allMembers) {
        const memberFull = normalize(`${m.vorname} ${m.nachname}`);
        if (excelNorm === memberFull) return { id: m.id, name: `${m.vorname} ${m.nachname}`, confidence: 'exact' };
      }
      
      // Try abbreviated surname match (e.g. "Zimmerm." -> "Zimmermann")
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
      
      // Try fuzzy: first name exact + last name starts with same prefix
      if (parts.length >= 2) {
        const first = parts[0];
        const last = parts[parts.length - 1];
        for (const m of allMembers) {
          const mFirst = normalize(m.vorname);
          const mLast = normalize(m.nachname);
          if (first === mFirst && mLast.length > 3 && last.length > 2) {
            // Check first 3 chars of last name match
            if (mLast.substring(0, 3) === last.substring(0, 3) && Math.abs(mLast.length - last.length) <= 5) {
              return { id: m.id, name: `${m.vorname} ${m.nachname}`, confidence: 'fuzzy' };
            }
          }
        }
      }
      
      // Try reversed order (last name first in Excel)
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
      
      // Try typo matching (1 char difference)
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

    // Get owner names from request body
    const body = await req.json();
    const owners = body.owners || [];

    const results = {
      matched: {},
      unmatched: [],
      ambiguous: [],
      stats: { total: 0, exact: 0, abbrev: 0, fuzzy: 0, reversed: 0, typo: 0, unmatched: 0 }
    };

    for (const owner of owners) {
      results.stats.total++;
      const match = tryMatch(owner);
      if (match) {
        results.matched[owner] = match;
        results.stats[match.confidence]++;
      } else {
        results.unmatched.push(owner);
        results.stats.unmatched++;
      }
    }

    // Check for ambiguous matches (multiple Excel names -> same member)
    const memberUsage = {};
    for (const [excel, match] of Object.entries(results.matched)) {
      if (!memberUsage[match.id]) memberUsage[match.id] = [];
      memberUsage[match.id].push(excel);
    }
    for (const [memberId, excelNames] of Object.entries(memberUsage)) {
      if (excelNames.length > 1) {
        const member = allMembers.find(m => m.id === memberId);
        results.ambiguous.push({
          member: member ? `${member.vorname} ${member.nachname}` : memberId,
          excelNames
        });
      }
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
