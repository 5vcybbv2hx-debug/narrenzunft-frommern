import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Prüft alle Mitglieder ob ihr Mitgliedsstatus noch zum Alter passt.
 * Erstellt Benachrichtigungen für Vorstände bei veralteten Statuswerten.
 * Kann auch als manueller Check aufgerufen werden.
 */

// Altersgrenzen je Status (inklusiv)
const STATUS_ALTER_REGELN = [
  { status: 'Kleinkind 0-3',    minAlter: 0,  maxAlter: 3,  naechster: 'Kinder 4-10' },
  { status: 'Kinder 4-10',      minAlter: 4,  maxAlter: 10, naechster: 'Jugendliche 11-14' },
  { status: 'Jugendliche 11-14',minAlter: 11, maxAlter: 14, naechster: 'Jungaktive 15-17' },
  // Ab 18: Status 'Passiv' + Aktivierung offen. 'Aktiv' gibt es nur mit Antrag.
  { status: 'Jungaktive 15-17', minAlter: 15, maxAlter: 17, naechster: 'Passiv' },
];

function berechneAlter(geburtsdatum) {
  const heute = new Date();
  const geb = new Date(geburtsdatum);
  let alter = heute.getFullYear() - geb.getFullYear();
  const monat = heute.getMonth() - geb.getMonth();
  if (monat < 0 || (monat === 0 && heute.getDate() < geb.getDate())) {
    alter--;
  }
  return alter;
}

function getEmpfohlenerStatus(alter) {
  for (const regel of STATUS_ALTER_REGELN) {
    if (alter >= regel.minAlter && alter <= regel.maxAlter) return regel.status;
  }
  return null; // Kein Jugend-/Kinderstatus
}

function getAktuelleRegel(status) {
  return STATUS_ALTER_REGELN.find(r => r.status === status) || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authentifizierung: Vorstand, Stellv. Vorstand und Admin (ein Vorstand genügt)
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'vorstand', 'stellv_vorstand'].includes(user.role)) {
      return Response.json({ error: 'Nur Vorstand oder Admin dürfen diese Funktion aufrufen' }, { status: 403 });
    }

    const heute = new Date();
    const mitglieder = await base44.asServiceRole.entities.Mitglied.filter({ archiviert: false });

    const zuAktualisieren = [];

    for (const m of mitglieder) {
      if (!m.geburtsdatum) continue;

      const aktuelleRegel = getAktuelleRegel(m.mitgliedsstatus);
      if (!aktuelleRegel) continue; // Kein Jugend-/Kinderstatus – nicht relevant

      const alter = berechneAlter(m.geburtsdatum);

      // Ist das Mitglied aus dem Altersbereich seines Status herausgewachsen?
      if (alter > aktuelleRegel.maxAlter) {
        const empfohlen = getEmpfohlenerStatus(alter) || aktuelleRegel.naechster;
        zuAktualisieren.push({
          mitglied_id: m.id,
          vorname: m.vorname,
          nachname: m.nachname,
          geburtsdatum: m.geburtsdatum,
          alter,
          alter_status: m.mitgliedsstatus,
          empfohlener_status: empfohlen,
        });
      }
    }

    // ── Volljährigkeit: Antrag auf Aktive Mitgliedschaft ────────────────────
    // Regel (Owner 12.11.2026): Mit 18 wird man NICHT automatisch vollwertiges
    // Mitglied. Es braucht einen Antrag. Bis dahin bleibt der Status Passiv.
    // Phasen: 'vorab' (14 Tage vorher), 'faellig' (18. erreicht),
    //         'erinnerung1' (4 Wochen später), 'erinnerung2' (12 Wochen später).
    const volljaehrigkeit = [];
    for (const m of mitglieder) {
      if (!m.geburtsdatum) continue;
      if (m.mitgliedsstatus === 'Aktiv') continue;          // schon aktiviert
      if (!String(m.mitgliedsstatus || '').startsWith('Jungaktive')) continue;

      const geb = new Date(m.geburtsdatum);
      if (Number.isNaN(geb.getTime())) continue;
      const achtzehn = new Date(geb.getFullYear() + 18, geb.getMonth(), geb.getDate());
      const tage = Math.floor((achtzehn.getTime() - heute.getTime()) / 86400000);

      let phase = null;
      if (tage >= 0 && tage <= 14) phase = 'vorab';
      else if (tage < 0 && tage >= -27) phase = 'faellig';
      else if (tage <= -28 && tage >= -83) phase = 'erinnerung1';
      else if (tage <= -84 && tage >= -365) phase = 'erinnerung2';
      if (!phase) continue;

      volljaehrigkeit.push({
        mitglied_id: m.id,
        vorname: m.vorname,
        nachname: m.nachname,
        geburtsdatum: m.geburtsdatum,
        achtzehn_am: achtzehn.toISOString().slice(0, 10),
        tage_bis_18: tage,
        phase,
        hat_login: !!m.user_id,
        email: m.email || '',
      });
    }

    // Vorhandene Benachrichtigungen dieser Art holen (um Duplikate zu vermeiden)
    // WICHTIG: unabhängig von gelesen-Status — sonst wird nach dem Lesen täglich neu erstellt
    const vorhandene = await base44.asServiceRole.entities.Benachrichtigung.filter({
      typ: 'Statuswechsel',
    });
    const bereitsGemeldetIds = new Set(
      vorhandene.map(b => {
        try { return JSON.parse(b.daten || '{}').mitglied_id; } catch { return null; }
      }).filter(Boolean)
    );

    // Aktivierungs-Meldungen: je Mitglied und Phase nur einmal
    const vorhandeneAktivierung = await base44.asServiceRole.entities.Benachrichtigung.filter({
      typ: 'Aktivierung',
    });
    const bereitsAktiviert = new Set(
      (vorhandeneAktivierung || []).map(b => {
        try { const d = JSON.parse(b.daten || '{}'); return `${d.mitglied_id}|${d.phase}`; } catch { return null; }
      }).filter(Boolean)
    );

    const PHASE_TEXT = {
      vorab: (e) => `${e.vorname} ${e.nachname} wird am ${e.achtzehn_am.split('-').reverse().join('.')} volljährig. Für die Aktive Mitgliedschaft ist ein Antrag nötig — bitte jetzt einholen.`,
      faellig: (e) => `${e.vorname} ${e.nachname} ist volljährig. Der Antrag auf Aktive Mitgliedschaft fehlt noch; der Status steht auf Passiv.`,
      erinnerung1: (e) => `Erinnerung: ${e.vorname} ${e.nachname} ist seit vier Wochen volljährig, der Antrag auf Aktive Mitgliedschaft fehlt weiterhin.`,
      erinnerung2: (e) => `Erinnerung: ${e.vorname} ${e.nachname} ist seit zwölf Wochen volljährig, weiterhin kein Antrag auf Aktive Mitgliedschaft.`,
    };

    let neuAktivierung = 0;
    for (const e of volljaehrigkeit) {
      const schluessel = `${e.mitglied_id}|${e.phase}`;
      if (bereitsAktiviert.has(schluessel)) continue;
      await base44.asServiceRole.entities.Benachrichtigung.create({
        titel: `Aktivierung offen: ${e.vorname} ${e.nachname}`,
        nachricht: PHASE_TEXT[e.phase](e),
        typ: 'Aktivierung',
        gelesen: false,
        daten: JSON.stringify(e),
      });
      neuAktivierung++;
    }

    // Neue Benachrichtigungen erstellen (nur wenn noch keine offene existiert)
    let neu = 0;
    for (const eintrag of zuAktualisieren) {
      if (bereitsGemeldetIds.has(eintrag.mitglied_id)) continue;

      await base44.asServiceRole.entities.Benachrichtigung.create({
        titel: `Statuswechsel erforderlich: ${eintrag.vorname} ${eintrag.nachname}`,
        nachricht: `${eintrag.vorname} ${eintrag.nachname} ist ${eintrag.alter} Jahre alt und hat noch den Status „${eintrag.alter_status}". Empfohlen wird: „${eintrag.empfohlener_status}".`,
        typ: 'Statuswechsel',
        gelesen: false,
        daten: JSON.stringify(eintrag),
      });
      neu++;
    }

    const result = {
      geprueft: mitglieder.length,
      zuAktualisieren: zuAktualisieren.length,
      neueBenachrichtigungen: neu,
      volljaehrigkeit: volljaehrigkeit.length,
      neueAktivierungsMeldungen: neuAktivierung,
    };

    // Sensible Mitgliederdaten (Namen, Geburtsdaten) — Aufrufer sind Vorstand/Admin
    result.eintraege = zuAktualisieren;
    result.volljaehrigkeit_eintraege = volljaehrigkeit;

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});