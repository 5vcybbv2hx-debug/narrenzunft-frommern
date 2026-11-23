import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Eltern dürfen die Profile ihrer Kinder bearbeiten — der direkte Update-Weg
// wird aber von der Mitglied-RLS blockiert (nur admin/vorstand/eigener Datensatz).
// Diese Function verifiziert die Eltern-Beziehung über die Verwandtschaft-
// Tabelle (beide Richtungen) und schreibt NUR whitelisted persönliche Felder.
const ERLAUBTE_FELDER = [
  'vorname', 'nachname', 'geburtsdatum',
  'email', 'telefon', 'hochzeitstag',
  'strasse', 'plz', 'ort',
  'notfallkontakt_name', 'notfallkontakt_telefon',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ erfolg: false, fehler: 'Nicht angemeldet.' }, { status: 401 });

    const body = await req.json();
    const kindId = body?.kind_id;
    const updates = body?.updates;

    if (!kindId || typeof updates !== 'object' || updates === null) {
      return Response.json({ erfolg: false, fehler: 'kind_id und updates erforderlich.' }, { status: 400 });
    }

    // Nur whitelisted Felder übernehmen — Verwaltungsdaten
    // (Status, Rolle, Sparten, Bank, Notizen …) sind für Eltern tabu.
    const daten = {};
    for (const f of ERLAUBTE_FELDER) {
      if (updates[f] !== undefined) daten[f] = updates[f];
    }
    if (Object.keys(daten).length === 0) {
      return Response.json({ erfolg: false, fehler: 'Keine bearbeitbaren Felder übergeben.' }, { status: 400 });
    }

    // Mitgliedsprofil des Aufrufers finden
    let selbst = null;
    try {
      const byUserId = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
      if (byUserId?.length === 1) selbst = byUserId[0];
    } catch (e) { console.error('Mitglied by user_id:', e); }
    if (!selbst) {
      try {
        const byEmail = await base44.asServiceRole.entities.Mitglied.filter({ email: user.email });
        if (byEmail?.length === 1 && (!byEmail[0].user_id || byEmail[0].user_id === user.id)) selbst = byEmail[0];
      } catch (e) { console.error('Mitglied by email:', e); }
    }
    if (!selbst) {
      return Response.json({ erfolg: false, fehler: 'Kein Mitgliedsprofil gefunden.' }, { status: 403 });
    }

    // Kind-Profil laden
    const kind = await base44.asServiceRole.entities.Mitglied.get(kindId).catch(() => null);
    if (!kind) {
      return Response.json({ erfolg: false, fehler: 'Kind nicht gefunden.' }, { status: 404 });
    }

    // Eltern-Beziehung prüfen — beide Eintrags-Richtungen:
    // a) Elternteil hat Kind eingetragen: mitglied_id=Elternteil, verwandter_id=Kind, 'Kind'
    // b) Kind hat Elternteil eingetragen: mitglied_id=Kind, verwandter_id=Elternteil, 'Elternteil'
    let istElternteil = false;
    try {
      const direkt = await base44.asServiceRole.entities.Verwandtschaft.filter({ mitglied_id: selbst.id, verwandter_id: kindId });
      istElternteil = (direkt || []).some(v => v.beziehung === 'Kind');
    } catch (e) { console.error('Verwandtschaft direkt:', e); }
    if (!istElternteil) {
      try {
        const umgekehrt = await base44.asServiceRole.entities.Verwandtschaft.filter({ mitglied_id: kindId, verwandter_id: selbst.id });
        istElternteil = (umgekehrt || []).some(v => v.beziehung === 'Elternteil');
      } catch (e) { console.error('Verwandtschaft umgekehrt:', e); }
    }

    // Zusätzlich: Verantwortliche einer Häsgruppe pflegen die Profile ihrer eigenen
    // Gruppe (Vorgabe Pierre 23.11.). Gleiche Feld-Whitelist wie für Eltern, also
    // keine Bank-, Rollen- oder Verwaltungsdaten.
    let istGruppenverantwortlich = false;
    if (!istElternteil) {
      try {
        const meineGruppen = new Set();
        if (selbst.spartenleiter_haesgruppe_id) meineGruppen.add(selbst.spartenleiter_haesgruppe_id);
        for (const g of (selbst.spartenleiter_haesgruppen_ids || [])) if (g) meineGruppen.add(g);
        const alleGruppen = await base44.asServiceRole.entities.Haesgruppe.list();
        const verantwortet = (alleGruppen || [])
          .filter(g => (g.verantwortliche_ids || []).includes(selbst.id) || g.verantwortlicher_id === selbst.id)
          .map(g => g.id);
        verantwortet.forEach(g => meineGruppen.add(g));

        const zielGruppe = kind.haesgruppe_id || '';
        if (zielGruppe && meineGruppen.has(zielGruppe)) istGruppenverantwortlich = true;

        if (!istGruppenverantwortlich && verantwortet.length > 0) {
          const teilnahmen = await base44.asServiceRole.entities.GruppenTeilnehmer
            .filter({ mitglied_id: kindId }).catch(() => []);
          if ((teilnahmen || []).some(t => verantwortet.includes(t.haesgruppe_id))) istGruppenverantwortlich = true;
        }
      } catch (e) { console.error('Gruppenverantwortung pruefen:', e); }
    }

    if (!istElternteil && !istGruppenverantwortlich) {
      return Response.json({ erfolg: false, fehler: 'Keine Berechtigung für dieses Profil.' }, { status: 403 });
    }

    await base44.asServiceRole.entities.Mitglied.update(kindId, daten);
    return Response.json({ erfolg: true, aktualisiert: Object.keys(daten) });
  } catch (e) {
    console.error('aktualisiereKindSicher:', e);
    return Response.json({ erfolg: false, fehler: e?.message || 'Serverfehler.' }, { status: 500 });
  }
});
