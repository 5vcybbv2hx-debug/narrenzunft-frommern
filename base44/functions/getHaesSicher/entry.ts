import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ['vorstand', 'stellv_vorstand', 'admin'].includes(user.role);

    if (isAdmin) {
      // Admin: alles
      const [haes, gruppen] = await Promise.all([
        base44.asServiceRole.entities.Haes.list('bezeichnung', 500),
        base44.asServiceRole.entities.Haesgruppe.list('name', 100),
      ]);
      return Response.json({
        erfolg: true,
        haes,
        gruppen,
        kannBearbeiten: true,
      });
    }

    // Mitglied: nur eigene Häs
    const myMitgliedResp = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const myMitglied = myMitgliedResp[0];

    if (!myMitglied) {
      return Response.json({
        erfolg: true,
        haes: [],
        gruppen: [],
        kannBearbeiten: false,
      });
    }

    const myHaes = await base44.asServiceRole.entities.Haes.filter({
      aktueller_besitzer_id: myMitglied.id,
    });

    const gruppen = await base44.asServiceRole.entities.Haesgruppe.list('name', 100);

    return Response.json({
      erfolg: true,
      haes: myHaes,
      gruppen,
      kannBearbeiten: false,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ erfolg: false, error: error.message }, { status: 500 });
  }
});