import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const anmeldungId = body?.anmeldung_id;
    const erwarteteAusfahrtId = body?.erwartete_ausfahrt_id || null;
    const eingeloggterName = body?.eingeloggter_name || user?.full_name || user?.email || 'Busverantwortlicher';

    if (!anmeldungId) {
      return Response.json({ erfolg: false, fehler: 'Keine Anmelde-ID übermittelt.' }, { status: 400 });
    }

    // Anmeldung laden
    const anmeldung = await base44.asServiceRole.entities.AusfahrtAnmeldung.get(anmeldungId);
    if (!anmeldung) {
      return Response.json({ erfolg: false, fehler: 'Anmeldung nicht gefunden.' }, { status: 404 });
    }

    // Berechtigung prüfen: Admin oder Busverantwortlicher der verknüpften Ausfahrt
    const ausfahrt = await base44.asServiceRole.entities.Ausfahrt.get(anmeldung.ausfahrt_id);
    if (!ausfahrt) {
      return Response.json({ erfolg: false, fehler: 'Zugehörige Ausfahrt nicht gefunden.' }, { status: 404 });
    }

    // Aktuelles Mitgliedsprofil des Users ermitteln
    const eigeneMitglieder = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const eigenesMitglied = eigeneMitglieder && eigeneMitglieder.length > 0 ? eigeneMitglieder[0] : null;

    // Genereller Check-in-Zugang: Vorstand, Stv. Vorstand, Spartenleiter, Admin
    const hasGeneralAccess = ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'].includes(user.role);
    const isBusverantwortlich = eigenesMitglied && Array.isArray(ausfahrt.bus_verantwortliche) &&
      ausfahrt.bus_verantwortliche.includes(eigenesMitglied.id);

    if (!hasGeneralAccess && !isBusverantwortlich) {
      return Response.json({ erfolg: false, fehler: 'Keine Berechtigung für den Check-in.' }, { status: 403 });
    }

    // QR-Code gehört zu einer anderen Ausfahrt? (Manipulationsschutz)
    if (erwarteteAusfahrtId && anmeldung.ausfahrt_id !== erwarteteAusfahrtId) {
      return Response.json({
        erfolg: false,
        fehler: 'Dieser QR-Code gehört zu einer anderen Ausfahrt.',
        anmeldung
      }, { status: 200 });
    }

    // Zeitfenster: Check-in nur am Tag der Ausfahrt.
    // Vorher: gar nicht. Nachher (Korrektur): nur Vorstand/Stellv./Spartenleiter/Admin.
    const heute = new Date().toISOString().split('T')[0];
    if (ausfahrt.datum && heute < ausfahrt.datum) {
      return Response.json({
        erfolg: false,
        fehler: `Check-in ist erst am ${ausfahrt.datum.split('-').reverse().join('.')} möglich.`,
        anmeldung
      }, { status: 200 });
    }
    if (ausfahrt.datum && heute > ausfahrt.datum && !hasGeneralAccess) {
      return Response.json({
        erfolg: false,
        fehler: 'Nachträglicher Check-in nur für Vorstand und Spartenleiter möglich.',
        anmeldung
      }, { status: 200 });
    }

    // Bereits eingecheckt?
    if (anmeldung.status === 'Eingecheckt') {
      return Response.json({
        erfolg: false,
        fehler: 'Bereits eingecheckt.',
        anmeldung
      }, { status: 200 });
    }

    if (anmeldung.status === 'Abgemeldet') {
      return Response.json({
        erfolg: false,
        fehler: 'Diese Person hat sich abgemeldet.',
        anmeldung
      }, { status: 200 });
    }

    // Check-in durchführen
    const nowIso = new Date().toISOString();
    await base44.asServiceRole.entities.AusfahrtAnmeldung.update(anmeldungId, {
      status: 'Eingecheckt',
      eingecheckt_am: nowIso,
      eingecheckt_von: eingeloggterName
    });

    // Aktualisierte Anmeldung zurückgeben
    const aktualisiert = await base44.asServiceRole.entities.AusfahrtAnmeldung.get(anmeldungId);

    return Response.json({
      erfolg: true,
      anmeldung: aktualisiert
    }, { status: 200 });
  } catch (error) {
    return Response.json({ erfolg: false, fehler: error?.message || 'Unbekannter Fehler' }, { status: 500 });
  }
});