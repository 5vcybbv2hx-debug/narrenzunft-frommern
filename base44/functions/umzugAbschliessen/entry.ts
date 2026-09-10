import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const veranstaltungId = body?.veranstaltung_id || null;
    const ausfahrtId = body?.ausfahrt_id || null;
    if (!veranstaltungId && !ausfahrtId) {
      return Response.json({ error: 'veranstaltung_id oder ausfahrt_id erforderlich' }, { status: 400 });
    }

    // 1. Berechtigung prüfen
    const mitglied = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const kannAbschliessen = user.role === 'admin' ||
                             user.role === 'vorstand' ||
                             user.role === 'stellv_vorstand';

    if (!kannAbschliessen && mitglied.length > 0) {
      // Prüfe ob Busverantwortlicher für diese Veranstaltung
      const busVeAnsEinst = await base44.asServiceRole.entities.AppEinstellung.filter({
        schluessel: 'busverantwortliche'
      });
      const busVeIds = busVeAnsEinst[0]?.wert_ids || [];
      if (!busVeIds.includes(mitglied[0].id)) {
        return Response.json({ error: 'Keine Berechtigung zum Abschließen' }, { status: 403 });
      }
    }

    // 2. Ziel bestimmen: Veranstaltung (altes System) oder Ausfahrt (neues System)
    let veranstaltung = null;
    let ausfahrt = null;
    if (veranstaltungId) {
      const vListe = await base44.asServiceRole.entities.Veranstaltung.filter({ id: veranstaltungId });
      veranstaltung = vListe[0];
      if (!veranstaltung) return Response.json({ error: 'Veranstaltung nicht gefunden' }, { status: 404 });
      if (veranstaltung.typ !== 'Umzug') {
        return Response.json({ error: 'Nur Umzüge können abgeschlossen werden' }, { status: 400 });
      }
    } else {
      const fListe = await base44.asServiceRole.entities.Ausfahrt.filter({ id: ausfahrtId });
      ausfahrt = fListe[0];
      if (!ausfahrt) return Response.json({ error: 'Ausfahrt nicht gefunden' }, { status: 404 });
      if (ausfahrt.typ !== 'Umzug') {
        return Response.json({ error: 'Nur Umzüge können abgeschlossen werden' }, { status: 400 });
      }
    }

    const zielTitel = veranstaltung?.titel || ausfahrt?.titel || 'Umzug';
    const zielDatum = veranstaltung?.datum || ausfahrt?.datum || null;
    const warBereitsAbgeschlossen = veranstaltung
      ? veranstaltung.status === 'Abgeschlossen'
      : ausfahrt.status === 'Abgeschlossen';

    // 3. Alle Umzüge beider Systeme laden + deren Teilnahmen/Anmeldungen
    const umzugsVeranstaltungen = await base44.asServiceRole.entities.Veranstaltung.filter({ typ: 'Umzug' });
    const umzugsAusfahrten = await base44.asServiceRole.entities.Ausfahrt.filter({ typ: 'Umzug' });
    const [teilnahmeArrays, anmeldungArrays, alleM, alleEhrungen] = await Promise.all([
      Promise.all(umzugsVeranstaltungen.map(v =>
        base44.asServiceRole.entities.Teilnahme.filter({ veranstaltung_id: v.id }))),
      Promise.all(umzugsAusfahrten.map(f =>
        base44.asServiceRole.entities.AusfahrtAnmeldung.filter({ ausfahrt_id: f.id }))),
      base44.asServiceRole.entities.Mitglied.list('nachname', 500),
      base44.asServiceRole.entities.Ehrung.list('-created_date', 2000),
    ]);

    // 4. Anwesenheiten sammeln: mitglied_id → Set von Umzugs-Daten.
    //    Doppel-Zähl-Schutz: gleiche Person + gleiches Datum über beide Systeme = 1 Umzug.
    const anwesenheiten = {};
    const addAnwesenheit = (mitgliedId, datum) => {
      if (!mitgliedId || !datum) return;
      if (!anwesenheiten[mitgliedId]) anwesenheiten[mitgliedId] = new Set();
      anwesenheiten[mitgliedId].add(datum);
    };
    umzugsVeranstaltungen.forEach((v, i) => {
      teilnahmeArrays[i]
        .filter(t => t.anwesend_bestaetigt === true || t.anwesend === true)
        .forEach(t => addAnwesenheit(t.mitglied_id, v.datum));
    });
    umzugsAusfahrten.forEach((f, i) => {
      anmeldungArrays[i]
        .filter(a => a.status === 'Eingecheckt' && a.mitglied_id)
        .forEach(a => addAnwesenheit(a.mitglied_id, f.datum));
    });

    // 5. Betroffene Mitglieder des aktuellen Abschlusses + Statistik
    const betroffeneIds = new Set();
    let angemeldet = 0, busAngemeldet = 0, busAnwesend = 0;
    if (veranstaltung) {
      const idx = umzugsVeranstaltungen.findIndex(v => v.id === veranstaltung.id);
      const teilnahmen = idx >= 0 ? teilnahmeArrays[idx] : [];
      angemeldet = teilnahmen.length;
      busAngemeldet = teilnahmen.filter(t => t.bus_angemeldet === true).length;
      busAnwesend = teilnahmen.filter(t => t.bus_anwesend_bestaetigt === true).length;
      teilnahmen
        .filter(t => t.anwesend_bestaetigt === true || t.anwesend === true)
        .forEach(t => betroffeneIds.add(t.mitglied_id));
    } else {
      const idx = umzugsAusfahrten.findIndex(f => f.id === ausfahrt.id);
      const anmeldungen = idx >= 0 ? anmeldungArrays[idx] : [];
      const aktiv = anmeldungen.filter(a => a.status !== 'Abgemeldet');
      angemeldet = aktiv.length;
      busAngemeldet = aktiv.filter(a => a.transport === 'Bus').length;
      busAnwesend = aktiv.filter(a => a.transport === 'Bus' && a.status === 'Eingecheckt').length;
      aktiv
        .filter(a => a.status === 'Eingecheckt' && a.mitglied_id)
        .forEach(a => betroffeneIds.add(a.mitglied_id));
    }
    const anwesendBestaetigt = betroffeneIds.size;

    // 6. Kumulative Ehrungs-Prüfung für die betroffenen Mitglieder
    //    (zählt ALLE Umzüge beider Systeme, nicht nur den aktuellen)
    const neueFaellige = [];
    for (const mitgliedId of betroffeneIds) {
      const m = alleM.find(x => x.id === mitgliedId);
      if (!m) continue;
      const daten = anwesenheiten[mitgliedId] || new Set();
      const gesamt = daten.size;

      // Jugend-Umzüge: Teilnahme erfolgte vor dem 18. Geburtstag
      let jugend = 0;
      if (m.geburtsdatum) {
        const geb = new Date(m.geburtsdatum);
        daten.forEach(d => {
          const ev = new Date(d);
          let alter = ev.getFullYear() - geb.getFullYear();
          const vorGeb = ev.getMonth() < geb.getMonth() ||
            (ev.getMonth() === geb.getMonth() && ev.getDate() < geb.getDate());
          if (vorGeb) alter -= 1;
          if (alter < 18) jugend += 1;
        });
      }

      const bestehende = alleEhrungen.filter(e =>
        e.mitglied_id === mitgliedId && e.typ === 'Umzugsteilnahmen');

      // Jugend-Ehrung ab 3 Jugend-Umzügen
      if (jugend >= 3 && !bestehende.some(e => Number(e.wert) >= 3)) {
        neueFaellige.push({ mitglied_id: mitgliedId, typ: 'Umzugsteilnahmen', wert: 3 });
      }
      // Erwachsenen-Stufen (kumulativ über alle Umzüge)
      for (const stufe of [5, 10, 25]) {
        if (gesamt >= stufe && !bestehende.some(e => Number(e.wert) >= stufe)) {
          neueFaellige.push({ mitglied_id: mitgliedId, typ: 'Umzugsteilnahmen', wert: stufe });
        }
      }
    }

    // 7. Ehrungen erstellen (duplikatsicher gegen alle bestehenden)
    const erstellteEhrungen = [];
    for (const ehrung of neueFaellige) {
      const vorhanden = alleEhrungen.find(e =>
        e.mitglied_id === ehrung.mitglied_id &&
        e.typ === 'Umzugsteilnahmen' &&
        Number(e.wert) === Number(ehrung.wert)
      );
      if (vorhanden) continue;
      const neu = await base44.asServiceRole.entities.Ehrung.create({
        mitglied_id: ehrung.mitglied_id,
        typ: 'Umzugsteilnahmen',
        wert: ehrung.wert,
        status: 'Vorgeschlagen',
        automatisch_berechnet: true,
        jahr: new Date().getFullYear(),
      });
      erstellteEhrungen.push(neu);
      await base44.asServiceRole.entities.Benachrichtigung.create({
        mitglied_id: ehrung.mitglied_id,
        titel: 'Neue Ehrung fällig',
        nachricht: `Du hast die Ehrung "Umzugsteilnahmen ${ehrung.wert}" erreicht!`,
        typ: 'Ehrung',
        gelesen: false,
      });
    }

    // 8. Teilnahme-Benachrichtigungen (nur beim ersten Abschluss, nicht bei Aktualisierung)
    if (!warBereitsAbgeschlossen) {
      for (const mitgliedId of betroffeneIds) {
        await base44.asServiceRole.entities.Benachrichtigung.create({
          mitglied_id: mitgliedId,
          titel: 'Umzug registriert',
          nachricht: `Deine Teilnahme am ${zielTitel} wurde gezählt.`,
          typ: 'Veranstaltung',
          gelesen: false,
        });
      }
    }

    // 9. Ziel auf abgeschlossen setzen
    const heute = new Date().toISOString().split('T')[0];
    if (veranstaltung) {
      await base44.asServiceRole.entities.Veranstaltung.update(veranstaltung.id, {
        status: 'Abgeschlossen',
        abgeschlossen_am: heute,
      });
    } else {
      await base44.asServiceRole.entities.Ausfahrt.update(ausfahrt.id, {
        status: 'Abgeschlossen',
      });
    }

    // 10. Audit-Log
    console.log(`Umzug ${zielTitel} (${zielDatum}) abgeschlossen: ${anwesendBestaetigt}/${angemeldet} anwesend`);

    return Response.json({
      erfolg: true,
      statistik: {
        angemeldet,
        anwesendBestaetigt,
        abwesend: angemeldet - anwesendBestaetigt,
        busAngemeldet,
        busAnwesend,
      },
      neueFaelligeEhrungen: erstellteEhrungen.length,
      erstellteEhrungen,
      warnungen: [],
      fehler: [],
    });
  } catch (error) {
    console.error(error);
    return Response.json({
      error: error.message,
      erfolg: false,
      fehler: [error.message]
    }, { status: 500 });
  }
});
