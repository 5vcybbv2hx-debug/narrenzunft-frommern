/**
 * weiseHaesZuSicher – zentrale, sichere Häs-Zuweisung
 *
 * Erlaubte Aktionen:
 * - verliehen: Häs an Mitglied verleihen
 * - zurueckgegeben: Häs zurückgeben (besitzer = null)
 * - verkauft: Häs verkauft an Mitglied
 * - stillgelegt: Häs deaktivieren
 *
 * Sicherheit:
 * - Nur Admin/Vorstand/Spartenleiter dürfen zuweisen
 * - Immer wird eine alte aktive Historie beendet
 * - Nie mehr als eine aktive Zuordnung pro Häs
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const erlaubteRollen = ['admin', 'vorstand', 'stellv_vorstand', 'spartenleiter'];
    if (!erlaubteRollen.includes(user.role)) {
      return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    const body = await req.json();
    const { haes_id, mitglied_id, aktion = 'verliehen', datum, notiz = '' } = body;

    if (!haes_id) return Response.json({ error: 'haes_id fehlt' }, { status: 400 });

    const zuweisungsDatum = datum || new Date().toISOString().split('T')[0];

    // Häs laden
    const haesListe = await base44.asServiceRole.entities.Haes.filter({ id: haes_id });
    const haes = haesListe[0];
    if (!haes) return Response.json({ error: 'Häs nicht gefunden' }, { status: 404 });

    // Zielmitglied prüfen (falls angegeben)
    if (mitglied_id) {
      const mitglieder = await base44.asServiceRole.entities.Mitglied.filter({ id: mitglied_id });
      if (!mitglieder[0]) return Response.json({ error: 'Mitglied nicht gefunden' }, { status: 404 });
    }

    // Alle aktiven Historien dieses Häs laden und beenden
    const aktiveHistorien = await base44.asServiceRole.entities.HaesHistorie.filter({
      haes_id,
      aktiv: true,
    });

    for (const h of aktiveHistorien) {
      await base44.asServiceRole.entities.HaesHistorie.update(h.id, {
        aktiv: false,
        bis_datum: zuweisungsDatum,
      });
    }

    // Neue Historie anlegen (außer bei stillgelegt ohne Mitglied)
    let neueHistorie = null;
    if (aktion !== 'stillgelegt' || mitglied_id) {
      neueHistorie = await base44.asServiceRole.entities.HaesHistorie.create({
        haes_id,
        mitglied_id: mitglied_id || null,
        von_datum: zuweisungsDatum,
        aktiv: !!mitglied_id,
        notizen: notiz,
      });
    }

    // Häs-Status und Besitzer aktualisieren
    const statusMap = {
      verliehen: 'Verliehen',
      zurueckgegeben: 'Frei',
      verkauft: 'Verkauft',
      stillgelegt: 'Stillgelegt',
    };

    await base44.asServiceRole.entities.Haes.update(haes_id, {
      status: statusMap[aktion] || 'Frei',
      aktueller_besitzer_id: ['verliehen', 'verkauft'].includes(aktion) ? (mitglied_id || '') : '',
    });

    return Response.json({
      erfolg: true,
      haes_id,
      mitglied_id: mitglied_id || null,
      aktion,
      historie_id: neueHistorie?.id || null,
      beendete_historien: aktiveHistorien.length,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});