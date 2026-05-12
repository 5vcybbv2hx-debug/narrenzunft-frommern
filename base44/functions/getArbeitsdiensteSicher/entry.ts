import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ['vorstand', 'stellv_vorstand', 'admin'].includes(user.role);
    const isSpartenleiter = user.role === 'spartenleiter';

    const heute = new Date().toISOString().split('T')[0];

    if (isAdmin) {
      // Admin: alle Dienste + alle Zuweisungen
      const [dienste, zuweisungen, mitglieder] = await Promise.all([
        base44.asServiceRole.entities.Arbeitsdienst.list('-datum', 300),
        base44.asServiceRole.entities.ArbeitsdienstZuweisung.list('-created_date', 500),
        base44.asServiceRole.entities.Mitglied.list('nachname', 300),
      ]);

      return Response.json({
        erfolg: true,
        dienste,
        zuweisungen,
        mitglieder,
        kannBearbeiten: true,
      });
    }

    // Spartenleiter: nur Dienste eigener Sparten
    const myMitgliedResp = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const myMitglied = myMitgliedResp[0];

    if (!myMitglied && !isAdmin) {
      return Response.json({
        erfolg: true,
        dienste: [],
        zuweisungen: [],
        mitglieder: [],
        kannBearbeiten: false,
      });
    }

    if (isSpartenleiter && myMitglied) {
      const spartenIds = myMitglied.spartenleiter_haesgruppen_ids || [];
      const alleDienste = await base44.asServiceRole.entities.Arbeitsdienst.list('-datum', 300);
      const dienste = alleDienste.filter(d => spartenIds.includes(d.haesgruppe_id) || !d.haesgruppe_id);
      const diensteIds = dienste.map(d => d.id);

      const allZuweisungen = await base44.asServiceRole.entities.ArbeitsdienstZuweisung.list('-created_date', 500);
      const zuweisungen = allZuweisungen.filter(z => diensteIds.includes(z.arbeitsdienst_id));

      const mitgliederResp = await base44.asServiceRole.entities.Mitglied.list('nachname', 300);

      return Response.json({
        erfolg: true,
        dienste,
        zuweisungen,
        mitglieder: mitgliederResp,
        kannBearbeiten: true,
      });
    }

    // Normales Mitglied: nur eigene Zuweisungen
    if (myMitglied) {
      const myZuweisungen = await base44.asServiceRole.entities.ArbeitsdienstZuweisung.filter({
        mitglied_id: myMitglied.id,
      });
      const diensteIds = [...new Set(myZuweisungen.map(z => z.arbeitsdienst_id))];
      let dienste = [];
      if (diensteIds.length > 0) {
        const diensteResp = await Promise.all(
          diensteIds.slice(0, 50).map(did => base44.asServiceRole.entities.Arbeitsdienst.filter({ id: did }))
        );
        dienste = diensteResp.map(r => r[0]).filter(Boolean);
      }

      return Response.json({
        erfolg: true,
        dienste,
        zuweisungen: myZuweisungen,
        mitglieder: [myMitglied],
        kannBearbeiten: false,
      });
    }

    return Response.json({
      erfolg: true,
      dienste: [],
      zuweisungen: [],
      mitglieder: [],
      kannBearbeiten: false,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ erfolg: false, error: error.message }, { status: 500 });
  }
});