import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Eigenes Mitglied laden
    const eigeneMResp = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const eigenMitglied = eigeneMResp[0];

    const isAdmin = user.role === 'admin' || user.role === 'vorstand' || user.role === 'stellv_vorstand';
    const isEltern = user.role === 'elternkonto';

    // 2. Berechtigung prüfen
    if (!isAdmin && !isEltern && !eigenMitglied) {
      return Response.json({ 
        error: 'Kein Mitgliederprofil gefunden',
        familie: null,
        kinder: [],
        termine: [],
        dienste: [],
        ehrungen: [],
      }, { status: 403 });
    }

    let familienMitgliederIds = [];
    
    if (isAdmin) {
      // Admin sieht alle (optional Familie per Query filtern)
      familienMitgliederIds = []; // wird nicht genutzt bei Admin
    } else if (isEltern && eigenMitglied) {
      // Eltern sehen: sich selbst + verwandte Mitglieder
      familienMitgliederIds = [eigenMitglied.id];
      
      // Verwandtschaften laden
      const verwandtschaften = await base44.asServiceRole.entities.Verwandtschaft.filter({ 
        mitglied_id: eigenMitglied.id 
      });
      const kinderIds = verwandtschaften
        .filter(v => ['Kind', 'Enkel'].includes(v.beziehung))
        .map(v => v.verwandter_id);
      familienMitgliederIds.push(...kinderIds);
    } else if (eigenMitglied) {
      // Normales Mitglied: nur sich selbst
      familienMitgliederIds = [eigenMitglied.id];
    }

    // 3. Mitgliederdaten laden
    const alleMitglieder = await base44.asServiceRole.entities.Mitglied.filter({ 
      id: isAdmin ? undefined : undefined 
    });
    
    const familieMitglieder = isAdmin 
      ? alleMitglieder 
      : alleMitglieder.filter(m => familienMitgliederIds.includes(m.id));

    const haupt = familieMitglieder.length > 0 ? familieMitglieder[0] : null;
    const kinder = familieMitglieder.slice(1);

    // 4. Termine für Familie laden
    const alleTermine = await base44.asServiceRole.entities.KalenderTermin.list('datum', 300);
    const familieTermine = alleTermine.filter(t => {
      if (t.sichtbarkeit === 'admin' && !isAdmin) return false;
      if (familienMitgliederIds.length > 0) {
        return t.eingeladene_ids?.some(id => familienMitgliederIds.includes(id));
      }
      return true;
    });

    // 5. Dienste für Familie laden
    const alleDienste = await base44.asServiceRole.entities.Arbeitsdienst.list('datum', 200);
    const alleDienstzuweisungen = await base44.asServiceRole.entities.ArbeitsdienstZuweisung.list('-created_date', 500);
    
    const familieDienste = [];
    for (const mid of familienMitgliederIds) {
      const zuweisungen = alleDienstzuweisungen.filter(z => z.mitglied_id === mid);
      for (const z of zuweisungen) {
        const dienst = alleDienste.find(d => d.id === z.arbeitsdienst_id);
        if (dienst) {
          familieDienste.push({
            dienst,
            zuweisung: z,
            mitglied_id: mid,
          });
        }
      }
    }

    // 6. Ehrungen für Familie laden
    const alleEhrungen = await base44.asServiceRole.entities.Ehrung.list('-created_date', 500);
    const familieEhrungen = alleEhrungen.filter(e => familienMitgliederIds.includes(e.mitglied_id));

    // 7. Häs für Familie laden
    const alleHaes = await base44.asServiceRole.entities.Haes.filter({ 
      aktueller_besitzer_id: familienMitgliederIds.length > 0 ? undefined : undefined 
    });
    const familieHaes = familienMitgliederIds.length > 0
      ? alleHaes.filter(h => familienMitgliederIds.includes(h.aktueller_besitzer_id))
      : [];

    // 8. Teilnahmen für Familie laden (für Busstatus)
    const alleVeranstaltungen = await base44.asServiceRole.entities.Veranstaltung.list('datum', 200);
    const alleTeilnahmen = await base44.asServiceRole.entities.Teilnahme.list('-created_date', 500);
    
    const familieTeilnahmen = alleTeilnahmen.filter(t => familienMitgliederIds.includes(t.mitglied_id));

    // 9. Antwort zusammenstellen
    return Response.json({
      erfolg: true,
      familie: haupt,
      kinder,
      termine: familieTermine.slice(0, 20),
      dienste: familieDienste.slice(0, 30),
      ehrungen: familieEhrungen,
      haes: familieHaes,
      teilnahmen: familieTeilnahmen,
      veranstaltungen: alleVeranstaltungen.slice(0, 50),
      darfBearbeiten: isEltern || isAdmin,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ 
      error: error.message,
      erfolg: false,
      familie: null,
      kinder: [],
      termine: [],
      dienste: [],
      ehrungen: [],
    }, { status: 500 });
  }
});