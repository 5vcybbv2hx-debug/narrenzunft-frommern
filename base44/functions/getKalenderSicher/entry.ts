import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ['vorstand', 'stellv_vorstand', 'admin'].includes(user.role);
    const isAusschuss = user.role === 'ausschuss';

    const heute = new Date().toISOString().split('T')[0];

    if (isAdmin) {
      // Admin: alles
      const termine = await base44.asServiceRole.entities.KalenderTermin.list('datum', 500);
      return Response.json({
        erfolg: true,
        termine,
        kannBearbeiten: true,
      });
    }

    // Mitglied: nur sichtbare + eigene Anmeldungen
    const myMitgliedResp = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const myMitglied = myMitgliedResp[0];

    const alleTermine = await base44.asServiceRole.entities.KalenderTermin.list('datum', 500);

    let gefilterteTermine = [];

    if (myMitglied) {
      // Eigene Anmeldungen laden
      const myAnmeldungen = await base44.asServiceRole.entities.KalenderAnmeldung.filter({
        mitglied_id: myMitglied.id,
      });
      const myTerminIds = new Set(myAnmeldungen.map(a => a.termin_id));

      // Kinder-Termine (Elternkonto)
      const verwandtschaften = user.role === 'elternkonto'
        ? await base44.asServiceRole.entities.Verwandtschaft.filter({ mitglied_id: myMitglied.id })
        : [];
      const kinderIds = new Set(verwandtschaften.map(v => v.verwandter_id));

      gefilterteTermine = alleTermine.filter(t => {
        // Admin-Termine: nur Admin sieht
        if (t.sichtbarkeit === 'admin') return false;

        // Nur angemeldete
        if (myTerminIds.has(t.id)) return true;

        // Kinder-Termine
        if (user.role === 'elternkonto' && t.eingeladene_ids?.some(id => kinderIds.has(id))) return true;

        return false;
      });
    } else {
      // Kein Mitgliedsprofil: keine Termine
      gefilterteTermine = [];
    }

    return Response.json({
      erfolg: true,
      termine: gefilterteTermine.slice(0, 100),
      kannBearbeiten: false,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ erfolg: false, error: error.message }, { status: 500 });
  }
});