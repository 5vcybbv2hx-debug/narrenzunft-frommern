import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Sichere Verwaltung der Tanzgruppen-Daten: Figuren (mit Aufstellung),
 * Tanzablauf-Schritte und Musik.
 *
 * Erlaubt für:
 *  - Admin, Vorstand, Stv. Vorstand
 *  - Aktuelle Spartenleiter/Verantwortliche der Gruppe (verantwortliche_ids)
 *
 * Typen:
 *  - 'figur'  : TanzFigur  (name, reihenfolge, pdf_url, aufstellung als JSON-String)
 *  - 'schritt': TanzSchritt (nr, beschreibung, figur_id)
 *  - 'musik'  : TanzMusik  (titel, datei_url, sortierung)
 *
 * Aktionen: 'create' | 'update' | 'delete'
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    const body = await req.json();
    const { typ, aktion, haesgruppe_id } = body;
    if (!typ) return Response.json({ error: 'typ fehlt' }, { status: 400 });
    if (!aktion) return Response.json({ error: 'aktion fehlt' }, { status: 400 });
    if (!haesgruppe_id) return Response.json({ error: 'haesgruppe_id fehlt' }, { status: 400 });

    const srv = base44.asServiceRole;

    // ── Autorisierung: Führung ODER aktuelle Verantwortliche der Gruppe ──
    const gruppen = await srv.entities.Haesgruppe.filter({ id: haesgruppe_id });
    const gruppe = gruppen?.[0];
    if (!gruppe) return Response.json({ error: 'Gruppe nicht gefunden' }, { status: 404 });

    const isFuehrung = ['admin', 'vorstand', 'stellv_vorstand'].includes(user.role);
    if (!isFuehrung) {
      const meineMitglieder = await srv.entities.Mitglied.filter({ user_id: user.id });
      const meinMitglied = meineMitglieder?.[0];
      const aktuelleVerantwortliche = gruppe.verantwortliche_ids || (gruppe.verantwortlicher_id ? [gruppe.verantwortlicher_id] : []);
      const istVerantwortlich = meinMitglied && aktuelleVerantwortliche.includes(meinMitglied.id);
      if (!istVerantwortlich) {
        return Response.json({ error: 'Keine Berechtigung — nur Vorstand oder Spartenleiter der Gruppe dürfen Tanz-Daten verwalten.' }, { status: 403 });
      }
    }

    const str = (v, maxLen = 2000) => (typeof v === 'string' ? v.trim().slice(0, maxLen) : '');
    const num = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));

    // ── Aufstellungs-JSON validieren: [{mitglied_id, x, y}] ──
    const pruefeAufstellung = (raw) => {
      let arr;
      try {
        arr = raw === undefined || raw === null ? undefined : JSON.parse(raw);
      } catch {
        return { invalid: true };
      }
      if (arr === undefined) return { value: undefined };
      if (!Array.isArray(arr)) return { invalid: true };
      const sauber = [];
      for (const p of arr) {
        if (!p || typeof p !== 'object') return { invalid: true };
        const x = Number(p.x), y = Number(p.y);
        if (!p.mitglied_id || !Number.isFinite(x) || !Number.isFinite(y)) return { invalid: true };
        sauber.push({
          mitglied_id: String(p.mitglied_id),
          x: Math.min(100, Math.max(0, Math.round(x * 10) / 10)),
          y: Math.min(100, Math.max(0, Math.round(y * 10) / 10)),
        });
      }
      return { value: JSON.stringify(sauber) };
    };

    // ══════════ FIGUREN ══════════
    if (typ === 'figur') {
      const ENT = srv.entities.TanzFigur;

      if (aktion === 'create') {
        const name = str(body.name, 120);
        if (!name) return Response.json({ error: 'Name fehlt' }, { status: 400 });
        const aufst = pruefeAufstellung(body.aufstellung);
        if (aufst.invalid) return Response.json({ error: 'Ungültiges Aufstellungs-Format' }, { status: 400 });
        const neu = await ENT.create({
          haesgruppe_id,
          name,
          reihenfolge: num(body.reihenfolge) ?? 0,
          pdf_url: str(body.pdf_url, 1000) || '',
          aufstellung: aufst.value ?? JSON.stringify([]),
        });
        return Response.json({ erfolg: true, eintrag: neu });
      }

      if (aktion === 'update') {
        const figurId = str(body.figur_id);
        if (!figurId) return Response.json({ error: 'figur_id fehlt' }, { status: 400 });
        const patch = {};
        if (body.name !== undefined) {
          const name = str(body.name, 120);
          if (!name) return Response.json({ error: 'Name darf nicht leer sein' }, { status: 400 });
          patch.name = name;
        }
        if (body.reihenfolge !== undefined) patch.reihenfolge = num(body.reihenfolge) ?? 0;
        if (body.pdf_url !== undefined) patch.pdf_url = str(body.pdf_url, 1000);
        if (body.aufstellung !== undefined) {
          const aufst = pruefeAufstellung(body.aufstellung);
          if (aufst.invalid) return Response.json({ error: 'Ungültiges Aufstellungs-Format' }, { status: 400 });
          patch.aufstellung = aufst.value ?? JSON.stringify([]);
        }
        const t = await ENT.update(figurId, patch);
        return Response.json({ erfolg: true, eintrag: t });
      }

      if (aktion === 'delete') {
        const figurId = str(body.figur_id);
        if (!figurId) return Response.json({ error: 'figur_id fehlt' }, { status: 400 });
        await ENT.delete(figurId);
        return Response.json({ erfolg: true });
      }
    }

    // ══════════ TANZABLAUF-SCHRITTE ══════════
    if (typ === 'schritt') {
      const ENT = srv.entities.TanzSchritt;

      if (aktion === 'create') {
        const beschreibung = str(body.beschreibung, 2000);
        if (!beschreibung) return Response.json({ error: 'Beschreibung fehlt' }, { status: 400 });
        const neu = await ENT.create({
          haesgruppe_id,
          nr: num(body.nr) ?? 0,
          beschreibung,
          figur_id: str(body.figur_id) || '',
        });
        return Response.json({ erfolg: true, eintrag: neu });
      }

      if (aktion === 'update') {
        const schrittId = str(body.schritt_id);
        if (!schrittId) return Response.json({ error: 'schritt_id fehlt' }, { status: 400 });
        const patch = {};
        if (body.beschreibung !== undefined) {
          const beschreibung = str(body.beschreibung, 2000);
          if (!beschreibung) return Response.json({ error: 'Beschreibung darf nicht leer sein' }, { status: 400 });
          patch.beschreibung = beschreibung;
        }
        if (body.nr !== undefined) patch.nr = num(body.nr) ?? 0;
        if (body.figur_id !== undefined) patch.figur_id = str(body.figur_id);
        const t = await ENT.update(schrittId, patch);
        return Response.json({ erfolg: true, eintrag: t });
      }

      if (aktion === 'delete') {
        const schrittId = str(body.schritt_id);
        if (!schrittId) return Response.json({ error: 'schritt_id fehlt' }, { status: 400 });
        await ENT.delete(schrittId);
        return Response.json({ erfolg: true });
      }
    }

    // ══════════ MUSIK ══════════
    if (typ === 'musik') {
      const ENT = srv.entities.TanzMusik;

      if (aktion === 'create') {
        const titel = str(body.titel, 160) || 'Musikstück';
        const datei_url = str(body.datei_url, 1000);
        if (!datei_url) return Response.json({ error: 'datei_url fehlt' }, { status: 400 });
        const neu = await ENT.create({
          haesgruppe_id,
          titel,
          datei_url,
          sortierung: num(body.sortierung) ?? 0,
        });
        return Response.json({ erfolg: true, eintrag: neu });
      }

      if (aktion === 'update') {
        const musikId = str(body.musik_id);
        if (!musikId) return Response.json({ error: 'musik_id fehlt' }, { status: 400 });
        const patch = {};
        if (body.titel !== undefined) patch.titel = str(body.titel, 160) || 'Musikstück';
        if (body.datei_url !== undefined) {
          const datei_url = str(body.datei_url, 1000);
          if (!datei_url) return Response.json({ error: 'datei_url darf nicht leer sein' }, { status: 400 });
          patch.datei_url = datei_url;
        }
        if (body.sortierung !== undefined) patch.sortierung = num(body.sortierung) ?? 0;
        const t = await ENT.update(musikId, patch);
        return Response.json({ erfolg: true, eintrag: t });
      }

      if (aktion === 'delete') {
        const musikId = str(body.musik_id);
        if (!musikId) return Response.json({ error: 'musik_id fehlt' }, { status: 400 });
        await ENT.delete(musikId);
        return Response.json({ erfolg: true });
      }
    }

    return Response.json({ error: 'Unbekannter typ' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
