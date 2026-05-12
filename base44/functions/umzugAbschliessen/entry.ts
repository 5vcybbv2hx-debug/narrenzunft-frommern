/**
 * umzugAbschliessen – serverseitige Function
 *
 * Schließt einen Umzug ab:
 * - Berechtigung prüfen
 * - Anwesenheiten auswerten
 * - Ehrungen berechnen und vorschlagen
 * - Buskosten optional erstellen
 * - Veranstaltung auf Abgeschlossen setzen
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const UMZUGS_STUFEN = [66, 99, 133, 166, 199, 222, 266, 299, 333];

function differenceInYears(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  let years = d1.getFullYear() - d2.getFullYear();
  const m = d1.getMonth() - d2.getMonth();
  if (m < 0 || (m === 0 && d1.getDate() < d2.getDate())) years--;
  return years;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const body = await req.json();
    const { veranstaltung_id, buskosten_erstellen = false } = body;

    if (!veranstaltung_id) {
      return Response.json({ error: 'veranstaltung_id fehlt' }, { status: 400 });
    }

    // Berechtigung prüfen
    const erlaubteRollen = ['admin', 'vorstand', 'stellv_vorstand'];
    if (!erlaubteRollen.includes(user.role)) {
      return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    // Veranstaltung laden
    let veranstaltung;
    try {
      const veranstaltungen = await base44.asServiceRole.entities.Veranstaltung.filter({ id: veranstaltung_id });
      veranstaltung = veranstaltungen[0];
    } catch (_) {}
    if (!veranstaltung) {
      return Response.json({ error: 'Veranstaltung nicht gefunden' }, { status: 404 });
    }
    if (veranstaltung.typ !== 'Umzug') {
      return Response.json({ error: 'Veranstaltung ist kein Umzug' }, { status: 400 });
    }
    if (veranstaltung.status === 'Abgeschlossen') {
      return Response.json({ error: 'Umzug ist bereits abgeschlossen' }, { status: 400 });
    }

    // Alle Teilnahmen laden
    const alleTeilnahmen = await base44.asServiceRole.entities.Teilnahme.filter({ veranstaltung_id });

    // Nur bestätigte Anwesenheiten zählen
    const anwesend = alleTeilnahmen.filter(t => t.status === 'Anwesend');
    const busAngemeldet = alleTeilnahmen.filter(t => t.bus === true);
    const busAnwesend = alleTeilnahmen.filter(t => t.bus_anwesend === true);

    // Alle betroffenen Mitglieder laden
    const mitgliedIds = [...new Set(anwesend.map(t => t.mitglied_id))];
    const mitglieder = mitgliedIds.length > 0
      ? await base44.asServiceRole.entities.Mitglied.list('nachname', 1000)
      : [];
    const mitgliedMap = {};
    for (const m of mitglieder) mitgliedMap[m.id] = m;

    // Alle bisherigen Teilnahmen pro Mitglied laden + Ehrungen berechnen
    const neueEhrungen = [];
    const warnungen = [];
    const fehler = [];

    // Alle Veranstaltungen für Ehrungsberechnung laden (nur Umzüge)
    const alleVeranstaltungen = await base44.asServiceRole.entities.Veranstaltung.filter({ typ: 'Umzug' });

    for (const t of anwesend) {
      const mitglied = mitgliedMap[t.mitglied_id];
      if (!mitglied) {
        warnungen.push(`Mitglied ${t.mitglied_id} nicht gefunden`);
        continue;
      }
      if (!mitglied.geburtsdatum) {
        warnungen.push(`${mitglied.vorname} ${mitglied.nachname}: Geburtsdatum fehlt – Ehrung nicht berechenbar`);
        continue;
      }

      // Alle Teilnahmen dieses Mitglieds laden
      const meineTeilnahmen = await base44.asServiceRole.entities.Teilnahme.filter({ mitglied_id: t.mitglied_id });
      const bestaetigt = meineTeilnahmen.filter(t2 => t2.status === 'Anwesend');

      // Umzüge zählen
      let erwachsenenUmzuege = Number(mitglied.umzuege_vor_digitalisierung) || 0;
      for (const t2 of bestaetigt) {
        const v = alleVeranstaltungen.find(v => v.id === t2.veranstaltung_id);
        if (!v || v.typ !== 'Umzug' || !v.datum) continue;
        const alterAmUmzug = differenceInYears(v.datum, mitglied.geburtsdatum);
        if (alterAmUmzug >= 18) erwachsenenUmzuege++;
      }

      // Fällige Ehrungsstufen prüfen
      const bereitsVorhanden = await base44.asServiceRole.entities.Ehrung.filter({
        mitglied_id: t.mitglied_id,
        typ: 'Umzugsteilnahmen',
      });
      const verlieheneStufen = bereitsVorhanden
        .filter(e => ['Verliehen', 'Geplant', 'Vorgeschlagen'].includes(e.status))
        .map(e => Number(e.wert));

      for (const stufe of UMZUGS_STUFEN) {
        if (erwachsenenUmzuege >= stufe && !verlieheneStufen.includes(stufe)) {
          // Neue Ehrung vorschlagen
          try {
            await base44.asServiceRole.entities.Ehrung.create({
              mitglied_id: t.mitglied_id,
              typ: 'Umzugsteilnahmen',
              wert: stufe,
              jahr: new Date().getFullYear(),
              status: 'Vorgeschlagen',
              automatisch_berechnet: true,
              beschreibung: `Automatisch berechnet beim Abschluss von "${veranstaltung.titel}"`,
            });
            neueEhrungen.push({
              mitglied: `${mitglied.vorname} ${mitglied.nachname}`,
              stufe,
              umzuege: erwachsenenUmzuege,
            });
          } catch (e) {
            fehler.push(`Ehrung für ${mitglied.vorname} ${mitglied.nachname} konnte nicht erstellt werden`);
          }
          break; // Nur die nächste fällige Stufe vorschlagen
        }
      }
    }

    // Buskosten optional erstellen
    let buskostenErstellt = 0;
    if (buskosten_erstellen) {
      // Beitragsätze laden
      const einstellungen = await base44.asServiceRole.entities.AppEinstellung.filter({ schluessel: 'buskosten' });
      const busKosten = einstellungen[0]?.wert_json?.betrag || 10;

      for (const t of busAnwesend) {
        // Prüfen ob bereits ein Buskostenbeitrag existiert
        const existing = await base44.asServiceRole.entities.Buskostenbeitrag.filter({
          veranstaltung_id,
          mitglied_id: t.mitglied_id,
        });
        if (existing.length === 0) {
          await base44.asServiceRole.entities.Buskostenbeitrag.create({
            veranstaltung_id,
            mitglied_id: t.mitglied_id,
            betrag: busKosten,
            zahlungsstatus: 'Offen',
          });
          buskostenErstellt++;
        }
      }
    }

    // Veranstaltung abschließen
    await base44.asServiceRole.entities.Veranstaltung.update(veranstaltung_id, {
      status: 'Abgeschlossen',
      abschlussdatum: new Date().toISOString().split('T')[0],
    });

    // Benachrichtigung für Admins
    await base44.asServiceRole.entities.Benachrichtigung.create({
      titel: `Umzug abgeschlossen: ${veranstaltung.titel}`,
      nachricht: `${anwesend.length} Anwesende, ${neueEhrungen.length} neue Ehrungen vorgeschlagen`,
      typ: 'Info',
    });

    return Response.json({
      erfolg: true,
      statistik: {
        angemeldet: alleTeilnahmen.length,
        anwesend: anwesend.length,
        abwesend: alleTeilnahmen.length - anwesend.length,
        bus_angemeldet: busAngemeldet.length,
        bus_anwesend: busAnwesend.length,
      },
      anwesend: anwesend.length,
      ehrungen_aktualisiert: neueEhrungen.length,
      neue_ehrungen: neueEhrungen,
      buskosten_erstellt: buskosten_erstellen ? buskostenErstellt : null,
      warnungen,
      fehler,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});