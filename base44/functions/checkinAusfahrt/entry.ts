import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const anmeldungId = body?.anmeldung_id;
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

    const isAdmin = user.role === 'admin';
    const isBusverantwortlich = eigenesMitglied && Array.isArray(ausfahrt.bus_verantwortliche) &&
      ausfahrt.bus_verantwortliche.includes(eigenesMitglied.id);

    if (!isAdmin && !isBusverantwortlich) {
      return Response.json({ erfolg: false, fehler: 'Keine Berechtigung für den Check-in.' }, { status: 403 });
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