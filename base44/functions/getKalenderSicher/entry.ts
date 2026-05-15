import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdminUser = ['vorstand', 'stellv_vorstand', 'admin'].includes(user.role);

    // Veranstaltungen als normalisierte Termine umwandeln
    const normalisiereVeranstaltung = (v) => ({
      id: `v_${v.id}`,
      _veranstaltung_id: v.id,
      _quelle: 'veranstaltung',
      titel: v.titel,
      datum: v.datum,
      startzeit: v.uhrzeit || null,
      endzeit: null,
      ort: v.ort || null,
      terminart: v.typ === 'Umzug' ? 'Umzug'
               : v.typ === 'Abendveranstaltung' ? 'Abendveranstaltung'
               : v.typ === 'Arbeitsdienst' ? 'Arbeitsdienst'
               : 'Intern',
      sichtbarkeit: 'alle',
      beschreibung: v.beschreibung || null,
      anmeldbar: v.anmeldung_aktiv || false,
      _bus: v.bus_erforderlich || false,
      _busparkplatz_adresse: v.busparkplatz_adresse || null,
      _busparkplatz_treffzeit: v.busparkplatz_treffzeit || null,
      _umzugsaufstellung_ort: v.umzugsaufstellung_ort || null,
      _umzugsaufstellung_zeit: v.umzugsaufstellung_zeit || null,
      _festakt_ort: v.festakt_ort || null,
      _festakt_zeit: v.festakt_zeit || null,
      _veranstaltungsort_adresse: v.veranstaltungsort_adresse || null,
      _einlass_zeit: v.einlass_zeit || null,
      _beginn_zeit: v.beginn_zeit || null,
      _dresscode: v.dresscode || null,
      _hinweise: v.hinweise || null,
      _status: v.status || 'Geplant',
    });

    if (isAdminUser) {
      const [kalenderTermine, veranstaltungen] = await Promise.all([
        base44.asServiceRole.entities.KalenderTermin.list('datum', 500),
        base44.asServiceRole.entities.Veranstaltung.list('datum', 300),
      ]);

      const veranstaltungTermine = veranstaltungen.map(normalisiereVeranstaltung);
      const alleTermine = [...kalenderTermine, ...veranstaltungTermine]
        .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));

      return Response.json({
        erfolg: true,
        termine: alleTermine,
        kannBearbeiten: true,
      });
    }

    // Mitglied: sichtbare KalenderTermine + alle Veranstaltungen
    const myMitgliedResp = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const myMitglied = myMitgliedResp[0];

    const [alleKalenderTermine, veranstaltungen] = await Promise.all([
      base44.asServiceRole.entities.KalenderTermin.list('datum', 500),
      base44.asServiceRole.entities.Veranstaltung.list('datum', 300),
    ]);

    let gefilterteKalenderTermine = [];

    if (myMitglied) {
      const myAnmeldungen = await base44.asServiceRole.entities.KalenderAnmeldung.filter({
        mitglied_id: myMitglied.id,
      });
      const myTerminIds = new Set(myAnmeldungen.map(a => a.termin_id));

      const verwandtschaften = user.role === 'elternkonto'
        ? await base44.asServiceRole.entities.Verwandtschaft.filter({ mitglied_id: myMitglied.id })
        : [];
      const kinderIds = new Set(verwandtschaften.map(v => v.verwandter_id));

      gefilterteKalenderTermine = alleKalenderTermine.filter(t => {
        if (t.sichtbarkeit === 'admin') return false;
        if (myTerminIds.has(t.id)) return true;
        if (user.role === 'elternkonto' && t.eingeladene_ids?.some(id => kinderIds.has(id))) return true;
        return false;
      });
    }

    // Alle Veranstaltungen (Umzüge, Abendveranstaltungen etc.) sind für alle sichtbar
    const veranstaltungTermine = veranstaltungen.map(normalisiereVeranstaltung);

    const alleTermine = [...gefilterteKalenderTermine, ...veranstaltungTermine]
      .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));

    return Response.json({
      erfolg: true,
      termine: alleTermine.slice(0, 300),
      kannBearbeiten: false,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[getKalenderSicher]', msg);
    return Response.json({ erfolg: false, error: msg }, { status: 500 });
  }
});