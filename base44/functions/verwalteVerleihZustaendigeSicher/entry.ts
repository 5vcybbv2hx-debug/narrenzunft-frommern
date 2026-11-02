import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Zentrale Verleih-Zuständige (Vorstandsentscheidung 02.11.2026).
 *
 * Die zentralen Zuständigen bekommen ALLE Verleih-Anfragen, unabhängig vom
 * Gegenstand. Sie ergänzen die pro Gegenstand eingetragenen Personen
 * (Ausruestung.verleih_verantwortlicher_id) — niemand wird verdrängt.
 *
 * Gespeichert in AppEinstellung mit schluessel='verleih':
 *   wert_json = { "zustaendige_ids": ["id1","id2"] }
 *
 * Aktionen:
 *  - 'holen'     : Liste der zentralen Zuständigen (Verwaltung + Zuständige)
 *  - 'speichern' : Liste setzen (nur Vorstand/Stellv./Admin)
 */
const VERWALTUNG = ['admin', 'vorstand', 'stellv_vorstand'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const aktion = body.aktion || 'holen';

    const ladeEintrag = async () => {
      const t = await S.AppEinstellung.filter({ schluessel: 'verleih' }).catch(() => []);
      const roh = t?.[0]?.wert_json;
      const konf = typeof roh === 'string' ? JSON.parse(roh || '{}') : (roh || {});
      const ids = Array.isArray(konf.zustaendige_ids) ? konf.zustaendige_ids.filter(Boolean) : [];
      const auto = Array.isArray(konf.auto_inventar) ? konf.auto_inventar.filter(Boolean) : [];
      return { ids, auto, eintragId: t?.[0]?.id || '' };
    };

    if (aktion === 'holen') {
      const istVerwaltung = VERWALTUNG.includes(user.role);
      const { ids } = await ladeEintrag();

      // Eigene Mitglieds-ID ermitteln, damit auch Zuständige (ohne Vorstandsrolle) lesen dürfen
      let meinMitgliedId = '';
      const eigen = await S.Mitglied.filter({ user_id: user.id }).catch(() => []);
      if (eigen?.[0]?.id) meinMitgliedId = eigen[0].id;

      if (!istVerwaltung && !ids.includes(meinMitgliedId)) {
        return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
      }

      const personen = [];
      for (const id of ids) {
        const m = (await S.Mitglied.filter({ id }).catch(() => []))?.[0];
        if (m) personen.push({ id: m.id, vorname: m.vorname || '', nachname: m.nachname || '', email: m.email || '' });
      }
      return Response.json({ ok: true, zustaendige_ids: ids, personen, mein_mitglied_id: meinMitgliedId, darf_bearbeiten: istVerwaltung });
    }

    if (aktion === 'speichern') {
      if (!VERWALTUNG.includes(user.role)) {
        return Response.json({ error: 'Nur Vorstand, Stellvertreter und Admin dürfen das festlegen.' }, { status: 403 });
      }
      const ids = Array.isArray(body.zustaendige_ids)
        ? [...new Set(body.zustaendige_ids.map((x) => String(x || '').trim()).filter(Boolean))]
        : [];
      const { ids: vorher, auto: autoVorher, eintragId } = await ladeEintrag();
      const auto = [...autoVorher];

      // Zentrale Zuständige brauchen Zugang zur Inventar-Seite. Die Zusatz-Berechtigung
      // 'inventar' wird deshalb automatisch mitvergeben und beim Entfernen wieder
      // entzogen — aber nur, wenn sie nicht schon vorher manuell gesetzt war.
      const ohneBerechtigung = (m) => !(m?.zusatz_berechtigungen || []).includes('inventar');
      const setzeBerechtigung = async (mitgliedId, geben) => {
        const m = (await S.Mitglied.filter({ id: mitgliedId }).catch(() => []))?.[0];
        if (!m) return false;
        const liste = Array.isArray(m.zusatz_berechtigungen) ? [...m.zusatz_berechtigungen] : [];
        const drin = liste.includes('inventar');
        if (geben && drin) return false;            // war schon da: nicht als 'auto' merken
        if (geben) { liste.push('inventar'); await S.Mitglied.update(m.id, { zusatz_berechtigungen: liste }); return true; }
        const neu2 = liste.filter((b) => b !== 'inventar');
        await S.Mitglied.update(m.id, { zusatz_berechtigungen: neu2 });
        return false;
      };

      for (const neuId of ids.filter((id) => !vorher.includes(id))) {
        const selbstVergeben = await setzeBerechtigung(neuId, true);
        if (selbstVergeben && !auto.includes(neuId)) auto.push(neuId);
      }
      for (const wegId of vorher.filter((id) => !ids.includes(id))) {
        if (auto.includes(wegId)) {
          await setzeBerechtigung(wegId, false);
          const idx = auto.indexOf(wegId);
          if (idx >= 0) auto.splice(idx, 1);
        }
      }

      // wert_json ist ein Objektfeld — kein JSON-String, sonst lehnt die Validierung ab.
      const inhalt = { schluessel: 'verleih', wert_json: { zustaendige_ids: ids, auto_inventar: auto } };
      if (eintragId) await S.AppEinstellung.update(eintragId, inhalt);
      else await S.AppEinstellung.create(inhalt);
      return Response.json({ ok: true, zustaendige_ids: ids, inventar_zugang_gesetzt: ids.length });
    }

    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}