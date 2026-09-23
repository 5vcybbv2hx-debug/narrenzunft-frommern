/**
 * Geteilte Berechtigungslogik für den Ausschussbereich.
 *
 * Zugriff erhalten (wie getAusschussDataSicher / ausschussAktionSicher):
 * - Vorstand, Stellv. Vorstand, Admin
 * - aktive Spartenleitung (Mitglied mit nicht-leerem spartenleiter_haesgruppen_ids)
 * - aktive Ausschussmitglieder bzw. Mitglieder mit Zusatzrecht "ausschuss"
 *
 * Der Ausschusszugang wird aus der aktiven Haesgruppe-Verantwortung abgeleitet,
 * nicht allein aus der Rolle "spartenleiter" — ein Nutzer mit der Rolle, aber
 * ohne aktive Gruppenverantwortung, erhält keinen Zugang.
 *
 * Die Zusatzberechtigung wird serverseitig über die mit dem Login verknüpfte
 * Mitglieds-ID geprüft. Clientseitig mitgesendete Rollen werden nie vertraut.
 * Geteilte/mehrdeutige E-Mails führen zu keiner automatischen Zuordnung.
 *
 * Kritische Verwaltungsaktionen (Löschen, finale Freigabe, Ausschussmitglieder-
 * Verwaltung) bleiben auf Vorstand / Stellv. / Admin beschränkt (kannVerwalten).
 * Spartenleiter erhalten nur Ausschusszugang, keine Verwaltungsrechte.
 */

const ROLLEN_MIT_ZUGRIFF = ["vorstand", "stellv_vorstand", "admin"];
const ROLLEN_VERWALTUNG = ["vorstand", "stellv_vorstand", "admin"];

export async function loeseMitgliedUndRechte(base44, user) {
  if (!user) {
    return { mitglied: null, currentMitgliedId: null, darfAusschuss: false, kannVerwalten: false, aktiveSpartenleitung: false };
  }

  let mitglied = null;
  // 1. Eindeutige Verknüpfung über user_id (sicher, da pro User maximal ein Mitglied)
  if (user.id) {
    const treffer = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    if (treffer?.length === 1) {
      mitglied = treffer[0];
    } else if (treffer?.length > 1) {
      // Mehrere mit derselben user_id — Datenanomalie, keine automatische Auswahl
      return { mitglied: null, currentMitgliedId: null, darfAusschuss: false, kannVerwalten: false, aktiveSpartenleitung: false, mehrdeutig: true };
    }
  }

  // 2. Nur bei noch nicht verknüpften Alt-Konten per E-Mail suchen — NUR eindeutige Treffer.
  //    Geteilte/mehrdeutige E-Mails werden NICHT dem ersten Mitglied zugeordnet.
  if (!mitglied && user.email) {
    const treffer = await base44.asServiceRole.entities.Mitglied.filter({ email: user.email });
    if (treffer?.length === 1) {
      mitglied = treffer[0];
    } else if (treffer?.length > 1) {
      return { mitglied: null, currentMitgliedId: null, darfAusschuss: false, kannVerwalten: false, aktiveSpartenleitung: false, mehrdeutig: true };
    }
    // Case-insensitive Fallback: Auth-Provider geben E-Mails oft lowercase zurück,
    // in der DB können sie mit Großbuchstaben gespeichert sein.
    if (!mitglied) {
      const alle = await base44.asServiceRole.entities.Mitglied.list({ limit: 1000 });
      const ciMatches = (alle || []).filter((m) => m.email && m.email.toLowerCase() === user.email.toLowerCase());
      if (ciMatches.length === 1) {
        mitglied = ciMatches[0];
      } else if (ciMatches.length > 1) {
        return { mitglied: null, currentMitgliedId: null, darfAusschuss: false, kannVerwalten: false, aktiveSpartenleitung: false, mehrdeutig: true };
      }
    }
  }

  const zusatzRaw = mitglied?.zusatz_berechtigungen || [];
  const zusatz = Array.isArray(zusatzRaw)
    ? zusatzRaw
    : String(zusatzRaw).split(",").map((x) => x.trim()).filter(Boolean);

  let aktivesAusschussmitglied = false;
  let aktiveSpartenleitung = false;
  if (mitglied?.id) {
    const am = await base44.asServiceRole.entities.AusschussMitglied.filter({
      mitglied_id: mitglied.id,
      aktiv: true,
    });
    aktivesAusschussmitglied = (am?.length || 0) > 0;

    // Aktive Spartenleitung = Mitglied hat mindestens eine Haesgruppe, für die
    // es verantwortlich ist (spartenleiter_haesgruppen_ids nicht leer).
    const gruppen = Array.isArray(mitglied.spartenleiter_haesgruppen_ids)
      ? mitglied.spartenleiter_haesgruppen_ids
      : (mitglied.spartenleiter_haesgruppen_ids
          ? String(mitglied.spartenleiter_haesgruppen_ids).split(",").map((x) => x.trim()).filter(Boolean)
          : []);
    aktiveSpartenleitung = gruppen.length > 0;
  }

  const darfAusschuss =
    ROLLEN_MIT_ZUGRIFF.includes(user.role) ||
    aktiveSpartenleitung ||
    zusatz.includes("ausschuss") ||
    aktivesAusschussmitglied;

  const kannVerwalten = ROLLEN_VERWALTUNG.includes(user.role);

  return { mitglied, currentMitgliedId: mitglied?.id || null, darfAusschuss, kannVerwalten, aktiveSpartenleitung };
}

/** Schreibt einen Audit-Log-Eintrag (service role). Schlägt still fehl. */
export async function schreibeAudit(base44, ctx, objekt_typ, objekt_id, aktion, details) {
  try {
    await base44.asServiceRole.entities.AusschussAuditLog.create({
      objekt_typ,
      objekt_id: objekt_id || "",
      aktion,
      details: typeof details === "string" ? details : JSON.stringify(details || {}),
      mitglied_id: ctx.currentMitgliedId || "",
      zeitpunkt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("Audit-Log fehlgeschlagen:", e?.message || e);
  }
}

/**
 * Erzeugt eine kollisionssichere Beschlussnummer B-YYYY-NNN.
 * Lädt alle Beschlüsse des Jahres und inkrementiert die höchste gefundene Nummer.
 */
export async function generiereBeschlussnummer(base44, jahr) {
  const j = jahr || new Date().getFullYear();
  const liste = await base44.asServiceRole.entities.Beschluss.filter({ jahr: j });
  let max = 0;
  for (const b of liste || []) {
    const nr = b.beschlussnummer || "";
    const m = nr.match(/B-\d{4}-(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `B-${j}-${String(max + 1).padStart(3, "0")}`;
}

/** Parst ein JSON-Feld, das evtl. als String gespeichert wurde, sicher zu Array/Object. */
export function safeArray(val) {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}