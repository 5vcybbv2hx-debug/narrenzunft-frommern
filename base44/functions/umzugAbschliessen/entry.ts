import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { veranstaltung_id } = await req.json();
    if (!veranstaltung_id) {
      return Response.json({ error: 'veranstaltung_id erforderlich' }, { status: 400 });
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

    // 2. Veranstaltung laden
    const veranstaltungenResp = await base44.asServiceRole.entities.Veranstaltung.filter({ 
      id: veranstaltung_id 
    });
    const veranstaltung = veranstaltungenResp[0];
    if (!veranstaltung) {
      return Response.json({ error: 'Veranstaltung nicht gefunden' }, { status: 404 });
    }

    // 3. Prüfen ob Umzug
    if (veranstaltung.typ !== 'Umzug') {
      return Response.json({ error: 'Nur Umzüge können abgeschlossen werden' }, { status: 400 });
    }

    // 4. Alle Teilnahmen laden
    const teilnahmen = await base44.asServiceRole.entities.Teilnahme.filter({ 
      veranstaltung_id: veranstaltung_id 
    });
    
    // 5. Mitglieder und Ehrungen laden
    const alleM = await base44.asServiceRole.entities.Mitglied.list('nachname', 500);
    const alleEhrungen = await base44.asServiceRole.entities.Ehrung.list('-created_date', 2000);

    // 6. Statistik erzeugen
    const angemeldet = teilnahmen.length;
    const anwesendBestaetigt = teilnahmen.filter(t => t.anwesend_bestaetigt === true || t.anwesend === true).length;
    const busAngemeldet = teilnahmen.filter(t => t.bus_angemeldet === true).length;
    const busAnwesend = teilnahmen.filter(t => t.bus_anwesend_bestaetigt === true).length;

    // 7. Ehrungslogik berechnen
    const neueFaellige = [];
    const jahresToday = new Date().getFullYear();
    
    for (const t of teilnahmen.filter(x => x.anwesend_bestaetigt === true || x.anwesend === true)) {
      const m = alleM.find(x => x.id === t.mitglied_id);
      if (!m || !m.geburtsdatum) continue;

      const geb = new Date(m.geburtsdatum);
      const alter = jahresToday - geb.getFullYear();
      
      // Jugend-Umzug (<18 Jahre)
      if (alter < 18) {
        const bestehendeJugendEhrungen = alleEhrungen.filter(e => 
          e.mitglied_id === m.id && e.typ === 'Umzugsteilnahmen'
        );
        const jugendUmzuege = teilnahmen.filter(tn => 
          tn.mitglied_id === m.id && 
          (tn.anwesend_bestaetigt === true || tn.anwesend === true) &&
          jahresToday - new Date(tn.created_date).getFullYear() < 18
        ).length;
        
        if (jugendUmzuege >= 3 && !bestehendeJugendEhrungen.some(e => e.wert >= 3)) {
          neueFaellige.push({ mitglied_id: m.id, typ: 'Umzugsteilnahmen', wert: 3 });
        }
      } else {
        // Erwachsenen-Umzug (>=18 Jahre)
        const bestehendeEhrungen = alleEhrungen.filter(e => 
          e.mitglied_id === m.id && e.typ === 'Umzugsteilnahmen'
        );
        
        const erwachsenenUmzuege = teilnahmen.filter(tn => 
          tn.mitglied_id === m.id && 
          (tn.anwesend_bestaetigt === true || tn.anwesend === true)
        ).length;
        
        // Prüfe Stufen
        const stufen = [5, 10, 25];
        for (const stufe of stufen) {
          if (erwachsenenUmzuege >= stufe && !bestehendeEhrungen.some(e => e.wert >= stufe)) {
            neueFaellige.push({ mitglied_id: m.id, typ: 'Umzugsteilnahmen', wert: stufe });
          }
        }
      }
    }

    // 8. Neue Ehrungen erstellen
    const erstellteEhrungen = [];
    for (const ehrung of neueFaellige) {
      const vorhanden = alleEhrungen.find(e => 
        e.mitglied_id === ehrung.mitglied_id && 
        e.typ === ehrung.typ && 
        Number(e.wert) === ehrung.wert
      );
      
      if (!vorhanden) {
        const neu = await base44.asServiceRole.entities.Ehrung.create({
          mitglied_id: ehrung.mitglied_id,
          typ: ehrung.typ,
          wert: ehrung.wert,
          status: 'Vorgeschlagen',
          automatisch_berechnet: true,
          jahr: jahresToday,
        });
        erstellteEhrungen.push(neu);
      }
    }

    // 9. Benachrichtigungen erstellen
    for (const t of teilnahmen.filter(x => x.anwesend_bestaetigt === true || x.anwesend === true)) {
      await base44.asServiceRole.entities.Benachrichtigung.create({
        mitglied_id: t.mitglied_id,
        titel: 'Umzug registriert',
        nachricht: `Deine Teilnahme am ${veranstaltung.titel} wurde gezählt.`,
        typ: 'Veranstaltung',
        gelesen: false,
      });
    }

    // 10. Neue Ehrungen in Benachrichtigungen
    for (const ehr of erstellteEhrungen) {
      await base44.asServiceRole.entities.Benachrichtigung.create({
        mitglied_id: ehr.mitglied_id,
        titel: 'Neue Ehrung fällig',
        nachricht: `Du hast die Ehrung "${ehr.typ} ${ehr.wert}" erreicht!`,
        typ: 'Ehrung',
        gelesen: false,
      });
    }

    // 11. Veranstaltung auf abgeschlossen setzen
    const heute = new Date().toISOString().split('T')[0];
    await base44.asServiceRole.entities.Veranstaltung.update(veranstaltung_id, {
      status: 'Abgeschlossen',
      abgeschlossen_am: heute,
    });

    // 12. Audit-Log
    console.log(`Umzug ${veranstaltung_id} abgeschlossen von ${user.email}: ${anwesendBestaetigt}/${angemeldet} anwesend`);

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