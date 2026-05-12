import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { mitglied_id } = await req.json();
    if (!mitglied_id) {
      return Response.json({ error: 'mitglied_id erforderlich' }, { status: 400 });
    }

    // 1. Zielmitglied laden
    const zielMResp = await base44.asServiceRole.entities.Mitglied.filter({ id: mitglied_id });
    const zielMitglied = zielMResp[0];
    if (!zielMitglied) {
      return Response.json({ error: 'Mitglied nicht gefunden' }, { status: 404 });
    }

    // 2. Eigenes Mitglied ermitteln
    const eigeneMResp = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const eigenMitglied = eigeneMResp[0];

    // 3. Berechtigung prüfen
    const isAdmin = user.role === 'admin' || user.role === 'vorstand' || user.role === 'stellv_vorstand';
    const isEltern = user.role === 'elternkonto';
    const isSpartenleiter = user.role === 'spartenleiter';
    
    let darfSehen = false;
    let darfSensitiveSehen = false;

    // Admin/Vorstand sieht alles
    if (isAdmin) {
      darfSehen = true;
      darfSensitiveSehen = true;
    }
    // Eigenes Profil
    else if (eigenMitglied && eigenMitglied.id === mitglied_id) {
      darfSehen = true;
      darfSensitiveSehen = true;
    }
    // Elternkonto: eigene Kinder
    else if (isEltern && eigenMitglied) {
      const verwandtschaften = await base44.asServiceRole.entities.Verwandtschaft.filter({ 
        mitglied_id: eigenMitglied.id 
      });
      const isFamilienMitglied = verwandtschaften.some(v => v.verwandter_id === mitglied_id);
      if (isFamilienMitglied) {
        darfSehen = true;
        darfSensitiveSehen = false; // Kinderdaten, aber nicht alle Bankdaten
      }
    }
    // Spartenleiter: nur minimale Daten von Sparte-Mitgliedern
    else if (isSpartenleiter && eigenMitglied) {
      const spartenIds = eigenMitglied.spartenleiter_haesgruppen_ids || [];
      const istInSpartenleiterSparte = zielMitglied.haesgruppen_ids?.some(id => spartenIds.includes(id));
      if (istInSpartenleiterSparte) {
        darfSehen = true;
        darfSensitiveSehen = false;
      }
    }

    if (!darfSehen) {
      return Response.json({ error: 'Kein Zugriff auf dieses Mitglied' }, { status: 403 });
    }

    // 4. Daten laden je nach Berechtigung
    const [haes, ehrungen, beitraege] = await Promise.all([
      base44.asServiceRole.entities.Haes.filter({ aktueller_besitzer_id: mitglied_id }),
      base44.asServiceRole.entities.Ehrung.filter({ mitglied_id: mitglied_id }),
      darfSensitiveSehen ? base44.asServiceRole.entities.Beitrag.filter({ mitglied_id: mitglied_id }) : Promise.resolve([]),
    ]);

    // 5. Antwort je nach Berechtigung staffeln
    const mitgliedData = {
      id: zielMitglied.id,
      vorname: zielMitglied.vorname,
      nachname: zielMitglied.nachname,
      mitgliedsstatus: zielMitglied.mitgliedsstatus,
      geburtsdatum: zielMitglied.geburtsdatum,
      eintrittsdatum: zielMitglied.eintrittsdatum,
      email: zielMitglied.email,
      telefon: zielMitglied.telefon,
      profilbild_url: zielMitglied.profilbild_url,
    };

    // Für Admin/eigenes Profil: zusätzliche Daten
    if (darfSensitiveSehen) {
      mitgliedData.strasse = zielMitglied.strasse;
      mitgliedData.plz = zielMitglied.plz;
      mitgliedData.ort = zielMitglied.ort;
      mitgliedData.notfallkontakt_name = zielMitglied.notfallkontakt_name;
      mitgliedData.notfallkontakt_telefon = zielMitglied.notfallkontakt_telefon;
      mitgliedData.iban = zielMitglied.iban;
      mitgliedData.kontoinhaber = zielMitglied.kontoinhaber;
      mitgliedData.sepa_mandatnummer = zielMitglied.sepa_mandatnummer;
      mitgliedData.notizen = zielMitglied.notizen;
      mitgliedData.haesgruppen_ids = zielMitglied.haesgruppen_ids;
      mitgliedData.app_rolle = zielMitglied.app_rolle;
    }

    return Response.json({
      mitglied: mitgliedData,
      haes,
      ehrungen,
      beitraege: darfSensitiveSehen ? beitraege : [],
      darfBearbeiten: darfSensitiveSehen,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});