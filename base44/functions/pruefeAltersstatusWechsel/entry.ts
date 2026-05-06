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
  { status: 'Jungaktive 15-17', minAlter: 15, maxAlter: 17, naechster: 'Aktiv' },
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

    // Authentifizierung: entweder Admin-User oder Automation (kein User)
    let isAutomation = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Nur Admins dürfen diese Funktion aufrufen' }, { status: 403 });
      }
    } catch {
      // Kein User = Automation
      isAutomation = true;
    }

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

    // Vorhandene Benachrichtigungen dieser Art holen (um Duplikate zu vermeiden)
    const vorhandene = await base44.asServiceRole.entities.Benachrichtigung.filter({
      typ: 'Statuswechsel',
      gelesen: false,
    });
    const bereitsGemeldetIds = new Set(
      vorhandene.map(b => {
        try { return JSON.parse(b.daten || '{}').mitglied_id; } catch { return null; }
      }).filter(Boolean)
    );

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

    return Response.json({
      geprueft: mitglieder.length,
      zuAktualisieren: zuAktualisieren.length,
      neueBenachrichtigungen: neu,
      eintraege: zuAktualisieren,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});