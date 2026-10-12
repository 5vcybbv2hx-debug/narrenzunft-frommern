import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMeinMitglied } from "../../shared/mitgliedBerechtigung.ts";

/**
 * Komplettes Mitglied-Dashboard in EINEM Aufruf (Performance bei vielen
 * gleichzeitigen Nutzern).
 *
 * Hintergrund: Das Frontend lud fuer das Mitglieder-Dashboard zuvor ~40
 * einzelne API-Calls pro Aufruf (Veranstaltungen, Ausfahrten, Dienste,
 * Verwandte, Gruppen je einzeln per ID). Bei 20 gleichzeitigen Nutzern
 * fuehrte das zu Ladeproblemen. Diese Function buendelt alles serverseitig
 * mit Bulk-Loads und In-Memory-Joins und liefert eine kompakte Antwort.
 *
 * Antwort (bei gefundenem Profil):
 *  - mitglied, aufgaben, spartenTermine, spartenGruppen, familienMitglieder
 *  - veranstaltungen, arbeitsdienste, meineAnmeldungen, meineArbeitsdienste,
 *    meineBeitraege
 */

const CACHE_TTL_MS = 60 * 1000; // Dashboard-Daten duerfen 60s alt sein (warmes Isolat)
const dashboardCache = new Map(); // userId -> { ts, data }

const PRIO_RANG = { 'Dringend': 0, 'Hoch': 1, 'Mittel': 2, 'Niedrig': 3 };

function heuteBerlin() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ gefunden: false }, { status: 401 });

    // ── Cache (pro User, 60s) ──
    const cached = dashboardCache.get(user.id);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return Response.json(cached.data);
    }

    const S = base44.asServiceRole.entities;
    const myMitglied = await loeseMeinMitglied(base44, user);
    if (!myMitglied) {
      const data = { gefunden: false };
      dashboardCache.set(user.id, { ts: Date.now(), data });
      return Response.json(data);
    }

    const heute = heuteBerlin();
    const mId = myMitglied.id;

    // ── Bulk-Load: alles parallel in einer Welle ──
    const [
      teilnahmen, zuweisungen, beitraege, ausfahrtAnmeldungen,
      vDirect, vReverse, todos,
      veranstaltungenAll, ausfahrtenAll, diensteAll,
    ] = await Promise.all([
      S.Teilnahme.filter({ mitglied_id: mId }),
      S.ArbeitsdienstZuweisung.filter({ mitglied_id: mId }),
      S.Beitrag.filter({ mitglied_id: mId }),
      S.AusfahrtAnmeldung.filter({ mitglied_id: mId }),
      S.Verwandtschaft.filter({ mitglied_id: mId }),
      S.Verwandtschaft.filter({ verwandter_id: mId }),
      S.Todo.list('-created_date', 500),
      S.Veranstaltung.list('-datum', 200),
      S.Ausfahrt.list('datum', 100),
      S.Arbeitsdienst.list('-datum', 300),
    ]);

    // ── In-Memory-Joins statt Einzel-Abfragen ──
    const veranstaltungen = teilnahmen
      .map(t => veranstaltungenAll.find(v => v.id === t.veranstaltung_id))
      .filter(Boolean)
      .map(v => ({ id: v.id, titel: v.titel, datum: v.datum, uhrzeit: v.uhrzeit, ort: v.ort, typ: v.typ }));

    const ausfahrtenListe = (ausfahrtAnmeldungen || [])
      .filter(a => a.status !== 'Abgemeldet')
      .map(a => ausfahrtenAll.find(x => x.id === a.ausfahrt_id))
      .filter(Boolean)
      .map(f => ({ id: f.id, titel: f.titel, datum: f.datum, ort: f.ort, typ: f.typ, abfahrt_zeit: f.abfahrt_zeit, veranstaltungsbeginn: f.veranstaltungsbeginn }));

    const dienstIds = [...new Set(zuweisungen.map(z => z.arbeitsdienst_id).filter(Boolean))];
    const arbeitsdienste = dienstIds
      .map(id => diensteAll.find(d => d.id === id))
      .filter(Boolean)
      .map(d => ({ id: d.id, titel: d.titel, datum: d.datum, uhrzeit: d.uhrzeit, ort: d.ort, benoetigte_personen: d.benoetigte_personen, status: d.status }));

    // ── Meine offenen Aufgaben (wie bisher sortiert) ──
    const meineAufgaben = (todos || [])
      .filter(t => (t.verantwortliche_ids || []).includes(mId) && t.status !== 'Erledigt')
      .sort((a, b) => {
        const ueA = a.faellig_am && a.faellig_am < heute ? 0 : 1;
        const ueB = b.faellig_am && b.faellig_am < heute ? 0 : 1;
        if (ueA !== ueB) return ueA - ueB;
        const pA = PRIO_RANG[a.prioritaet] ?? 3;
        const pB = PRIO_RANG[b.prioritaet] ?? 3;
        if (pA !== pB) return pA - pB;
        return (a.faellig_am || '9999-12-31').localeCompare(b.faellig_am || '9999-12-31');
      })
      .slice(0, 5);

    // ── Sparten-Termine & Gruppen ──
    const gruppenIds = myMitglied.haesgruppen_ids || (myMitglied.haesgruppe_id ? [myMitglied.haesgruppe_id] : []);
    let spartenTermine = [];
    let spartenGruppen = [];
    if (gruppenIds.length > 0) {
      const [terminArr, gruppen] = await Promise.all([
        Promise.all(gruppenIds.map(gid => S.SpartenTermin.filter({ haesgruppe_id: gid }))),
        Promise.all(gruppenIds.map(gid => S.Haesgruppe.filter({ id: gid }))),
      ]);
      spartenTermine = terminArr.flat()
        .filter(t => t.datum >= heute)
        .sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit || '').localeCompare(b.uhrzeit || ''))
        .slice(0, 5);
      spartenGruppen = gruppen.flat().filter(Boolean);
    }

    // ── Familienmitglieder ──
    let familienMitglieder = [];
    const alleVerwandten = [...(vDirect || []), ...(vReverse || [])];
    if (alleVerwandten.length > 0) {
      const verwandteIds = [...new Set(alleVerwandten
        .map(v => (v.mitglied_id === mId ? v.verwandter_id : v.mitglied_id))
        .filter(Boolean))];
      familienMitglieder = (await Promise.all(
        verwandteIds.map(id => S.Mitglied.get(id).catch(() => null))
      )).filter(Boolean)
        .map(m => ({ id: m.id, vorname: m.vorname, nachname: m.nachname, mitgliedsstatus: m.mitgliedsstatus }));
    }

    // ── Kommende Anmeldungen (Veranstaltungen + Ausfahrten gemischt) ──
    const kommendeVeranstaltungen = teilnahmen
      .filter(t => ['Angemeldet', 'Bestätigt', 'Anwesend'].includes(t.status))
      .map(t => {
        const ev = veranstaltungen.find(e => e.id === t.veranstaltung_id);
        if (!ev || ev.datum < heute) return null;
        return { key: `v-${t.id}`, typ: 'veranstaltung', datum: ev.datum, titel: ev.titel, uhrzeit: ev.uhrzeit, ort: ev.ort, bus: t.bus, link: `/veranstaltungen/${ev.id}` };
      })
      .filter(Boolean);
    const kommendeAusfahrten = (ausfahrtAnmeldungen || [])
      .filter(a => a.status !== 'Abgemeldet')
      .map(a => {
        const f = ausfahrtenListe.find(x => x.id === a.ausfahrt_id);
        if (!f || f.datum < heute) return null;
        return { key: `a-${a.id}`, typ: 'ausfahrt', datum: f.datum, titel: f.titel, uhrzeit: f.abfahrt_zeit || f.veranstaltungsbeginn, ort: f.ort, bus: a.transport === 'Bus', transport: a.transport, link: `/ausfahrten/${f.id}` };
      })
      .filter(Boolean);
    const meineAnmeldungen = [...kommendeVeranstaltungen, ...kommendeAusfahrten]
      .sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit || '').localeCompare(b.uhrzeit || ''))
      .slice(0, 6);

    // ── Offene Arbeitsdienste ──
    const meineArbeitsdienste = zuweisungen
      .filter(z => ['Offen', 'Bestätigt'].includes(z.status))
      .filter(z => arbeitsdienste.some(d => d.id === z.arbeitsdienst_id && d.datum >= heute))
      .slice(0, 5);

    // ── Offene Beitraege ──
    const meineBeitraege = (beitraege || []).filter(b => ['Offen', 'Überfällig'].includes(b.zahlungsstatus));

    const data = {
      gefunden: true,
      mitglied: myMitglied,
      aufgaben: meineAufgaben,
      spartenTermine,
      spartenGruppen,
      familienMitglieder,
      veranstaltungen,
      arbeitsdienste,
      meineAnmeldungen,
      meineArbeitsdienste,
      meineBeitraege,
    };

    dashboardCache.set(user.id, { ts: Date.now(), data });
    return Response.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('[getMitgliedDashboardSicher]', msg);
    return Response.json({ gefunden: false, error: msg }, { status: 500 });
  }
});