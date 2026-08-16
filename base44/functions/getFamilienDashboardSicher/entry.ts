import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ erfolg: false, error: 'Nicht authentifiziert' }, { status: 401 });

    // Find Mitglied for current user
    let selbst = null;
    try {
      const byUserId = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
      if (byUserId && byUserId.length > 0) selbst = byUserId[0];
    } catch (e) {}
    
    if (!selbst) {
      try {
        const byEmail = await base44.asServiceRole.entities.Mitglied.filter({ email: user.email });
        if (byEmail && byEmail.length > 0) selbst = byEmail[0];
      } catch (e) {}
    }

    if (!selbst) {
      return Response.json({ erfolg: false, error: 'Kein Mitgliedsprofil gefunden' });
    }

    // Get Verwandtschaft entries for this member (both directions)
    let verwandtschaftenDirect = [];
    let verwandtschaftenReverse = [];
    try {
      verwandtschaftenDirect = await base44.asServiceRole.entities.Verwandtschaft.filter({ mitglied_id: selbst.id });
    } catch (e) {}
    try {
      verwandtschaftenReverse = await base44.asServiceRole.entities.Verwandtschaft.filter({ verwandter_id: selbst.id });
    } catch (e) {}

    // Combine all relationships
    const alleBeziehungen = [];
    for (const v of verwandtschaftenDirect) {
      alleBeziehungen.push({ verwandterId: v.verwandter_id, beziehung: v.beziehung });
    }
    for (const v of verwandtschaftenReverse) {
      let reverseBeziehung = v.beziehung;
      if (v.beziehung === 'Kind') reverseBeziehung = 'Elternteil';
      else if (v.beziehung === 'Elternteil') reverseBeziehung = 'Kind';
      alleBeziehungen.push({ verwandterId: v.mitglied_id, beziehung: reverseBeziehung });
    }

    // Fetch all related members
    const verwandteIds = [...new Set(alleBeziehungen.map(b => b.verwandterId))];
    const verwandteMitglieder = [];
    for (const vid of verwandteIds) {
      try {
        const m = await base44.asServiceRole.entities.Mitglied.get(vid);
        if (m) verwandteMitglieder.push(m);
      } catch (e) {}
    }

    // Categorize by relationship type
    const ehepartner = alleBeziehungen
      .filter(b => b.beziehung === 'Ehepartner/in')
      .map(b => verwandteMitglieder.find(m => m.id === b.verwandterId))
      .filter(Boolean)[0] || null;

    const kinder = alleBeziehungen
      .filter(b => b.beziehung === 'Kind')
      .map(b => verwandteMitglieder.find(m => m.id === b.verwandterId))
      .filter(Boolean);

    const verwandte = alleBeziehungen
      .filter(b => !['Ehepartner/in', 'Kind'].includes(b.beziehung))
      .map(b => ({
        ...verwandteMitglieder.find(m => m.id === b.verwandterId),
        beziehung: b.beziehung
      }))
      .filter(Boolean);

    // Get haes, dienste, ausfahrten for the family
    const familienIds = [selbst.id, ...(ehepartner ? [ehepartner.id] : []), ...kinder.map(k => k.id), ...verwandte.map(v => v.id)];

    let haes = [], dienste = [], ausfahrten = [];
    try {
      const alleHaes = await base44.asServiceRole.entities.Haes.list(500);
      haes = alleHaes.filter(h => familienIds.includes(h.aktueller_besitzer_id));
    } catch (e) {}

    try {
      const alleDienste = await base44.asServiceRole.entities.Arbeitsdienst.list(500);
      dienste = alleDienste.filter(d => familienIds.includes(d.mitglied_id));
    } catch (e) {}

    try {
      const alleAusfahrten = await base44.asServiceRole.entities.AusfahrtAnmeldung.list(500);
      ausfahrten = alleAusfahrten.filter(a => familienIds.includes(a.mitglied_id));
    } catch (e) {}

    const isAdmin = ['admin', 'vorstand', 'stellv_vorstand'].includes(user.role);

    return Response.json({
      erfolg: true,
      selbst,
      ehepartner,
      kinder,
      verwandte,
      termine: [],
      dienste,
      haes,
      ausfahrten,
      isAdmin
    });
  } catch (error) {
    return Response.json({ erfolg: false, error: error.message }, { status: 500 });
  }
});
