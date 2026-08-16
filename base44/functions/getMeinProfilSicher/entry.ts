import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const myMitgliedResp = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const mitglied = myMitgliedResp[0];

    if (!mitglied) {
      return Response.json({ gefunden: false, mitglied: null, haes: [], ehrungen: [], teilnahmen: [] });
    }

    const [haes, ehrungen, teilnahmen] = await Promise.all([
      base44.asServiceRole.entities.Haes.filter({ aktueller_besitzer_id: mitglied.id }),
      base44.asServiceRole.entities.Ehrung.filter({ mitglied_id: mitglied.id }),
      base44.asServiceRole.entities.Teilnahme.filter({ mitglied_id: mitglied.id }),
    ]);

    return Response.json({
      gefunden: true,
      mitglied,
      haes: haes || [],
      ehrungen: ehrungen || [],
      teilnahmen: teilnahmen || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});