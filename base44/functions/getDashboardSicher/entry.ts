import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdminUser = ['vorstand', 'stellv_vorstand', 'admin'].includes(user.role);

    // Admin-Dashboard
    if (isAdminUser) {
      const [mitglieder, veranstaltungen, arbeitsdienste, ehrungen, beitraege, haesgruppen] = await Promise.all([
        base44.asServiceRole.entities.Mitglied.list('nachname', 300),
        base44.asServiceRole.entities.Veranstaltung.list('-datum', 100),
        base44.asServiceRole.entities.Arbeitsdienst.list('-datum', 100),
        base44.asServiceRole.entities.Ehrung.list('-created_date', 100),
        base44.asServiceRole.entities.Beitrag.list('-jahr', 300),
        base44.asServiceRole.entities.Haesgruppe.list('name', 100),
      ]);

      return Response.json({
        erfolg: true,
        dashboard: 'admin',
        mitglieder,
        veranstaltungen,
        arbeitsdienste,
        ehrungen,
        beitraege,
        haesgruppen,
      });
    }

    // Mitglied-Dashboard: nur eigene Daten
    const myMitgliedResp = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const myMitglied = myMitgliedResp[0];

    if (!myMitglied) {
      return Response.json({
        erfolg: true,
        dashboard: 'mitglied',
        myMitglied: null,
        termine: [],
        dienste: [],
        ehrungen: [],
      });
    }

    const heute = new Date().toISOString().split('T')[0];

    // Eigene Termine laden
    const alleAnmeldungen = await base44.asServiceRole.entities.KalenderAnmeldung.filter({
      mitglied_id: myMitglied.id,
    });
    const terminIds = [...new Set(alleAnmeldungen.map(a => a.termin_id))];
    let termine = [];
    if (terminIds.length > 0) {
      const termineResp = await Promise.all(
        terminIds.slice(0, 20).map(tid => base44.asServiceRole.entities.KalenderTermin.filter({ id: tid }))
      );
      termine = termineResp
        .map(r => r[0])
        .filter(t => t && t.datum >= heute)
        .slice(0, 10);
    }

    // Eigene Arbeitsdienste laden
    const zuweisungen = await base44.asServiceRole.entities.ArbeitsdienstZuweisung.filter({
      mitglied_id: myMitglied.id,
    });
    const dienstIds = [...new Set(zuweisungen.map(z => z.arbeitsdienst_id))];
    let dienste = [];
    if (dienstIds.length > 0) {
      const diensteResp = await Promise.all(
        dienstIds.slice(0, 10).map(did => base44.asServiceRole.entities.Arbeitsdienst.filter({ id: did }))
      );
      dienste = diensteResp
        .map(r => r[0])
        .filter(d => d && d.datum >= heute)
        .slice(0, 10);
    }

    // Eigene Ehrungen laden
    const ehrungen = await base44.asServiceRole.entities.Ehrung.filter({
      mitglied_id: myMitglied.id,
    });

    return Response.json({
      erfolg: true,
      dashboard: 'mitglied',
      myMitglied,
      termine,
      dienste,
      ehrungen: ehrungen.slice(0, 5),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[getDashboardSicher]', msg);
    return Response.json({ erfolg: false, error: msg }, { status: 500 });
  }
});