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

    // Ausfahrten als normalisierte Termine umwandeln
    const normalisiereAusfahrt = (a) => ({
      id: `a_${a.id}`,
      _ausfahrt_id: a.id,
      _quelle: 'ausfahrt',
      titel: a.titel,
      datum: a.datum,
      startzeit: a.veranstaltungsbeginn || a.abfahrt_zeit || null,
      endzeit: a.rueckfahrt_zeit || null,
      ort: a.ort || null,
      terminart: a.typ === 'Umzug' ? 'Ausfahrt-Umzug' : 'Ausfahrt-Veranstaltung',
      sichtbarkeit: 'alle',
      beschreibung: a.notizen || null,
      anmeldbar: true,
      _bus: a.bus_benoetigt || false,
      _busparkplatz_adresse: a.busparkplatz || null,
      _busparkplatz_treffzeit: a.bus_benoetigt ? (a.abfahrt_zeit && a.abfahrt_ort ? `${a.abfahrt_zeit} ${a.abfahrt_ort}` : null) : null,
      _abfahrt_ort: a.abfahrt_ort || null,
      _abfahrt_zeit: a.abfahrt_zeit || null,
      _anmeldung_start: a.anmeldung_start || null,
      _anmeldung_ende: a.anmeldung_ende || null,
      _status: a.status || 'Geplant',
      _startnummer: a.startnummer || null,
    });

    if (isAdminUser) {
      const [kalenderTermine, veranstaltungen, ausfahrten] = await Promise.all([
        base44.asServiceRole.entities.KalenderTermin.list('datum', 500),
        base44.asServiceRole.entities.Veranstaltung.list('datum', 300),
        base44.asServiceRole.entities.Ausfahrt.list('datum', 300),
      ]);

      const veranstaltungTermine = veranstaltungen.map(normalisiereVeranstaltung);
      const ausfahrtTermine = ausfahrten.map(normalisiereAusfahrt);
      const alleTermine = [...kalenderTermine, ...veranstaltungTermine, ...ausfahrtTermine]
        .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));

      return Response.json({
        erfolg: true,
        termine: alleTermine,
        kannBearbeiten: true,
      });
    }

    // Mitglied: sichtbare KalenderTermine + alle Veranstaltungen + alle Ausfahrten
    const myMitgliedResp = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const myMitglied = myMitgliedResp[0];

    const [alleKalenderTermine, veranstaltungen, ausfahrten] = await Promise.all([
      base44.asServiceRole.entities.KalenderTermin.list('datum', 500),
      base44.asServiceRole.entities.Veranstaltung.list('datum', 300),
      base44.asServiceRole.entities.Ausfahrt.list('datum', 300),
    ]);

    let gefilterteKalenderTermine = [];

    if (myMitglied) {
      const myAnmeldungen = await base44.asServiceRole.entities.KalenderAnmeldung.filter({
        mitglied_id: myMitglied.id,
      });
      const myTerminIds = new Set(myAnmeldungen.map(a => a.termin_id));

      gefilterteKalenderTermine = alleKalenderTermine.filter(t => {
        if (t.sichtbarkeit === 'admin') return false;
        if (myTerminIds.has(t.id)) return true;
        return false;
      });
    }

    const veranstaltungTermine = veranstaltungen.map(normalisiereVeranstaltung);
    const ausfahrtTermine = ausfahrten.map(normalisiereAusfahrt);

    const alleTermine = [...gefilterteKalenderTermine, ...veranstaltungTermine, ...ausfahrtTermine]
      .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));

    return Response.json({
      erfolg: true,
      termine: alleTermine.slice(0, 500),
      kannBearbeiten: false,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[getKalenderSicher]', msg);
    return Response.json({ erfolg: false, error: msg }, { status: 500 });
  }
});
