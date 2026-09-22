/**
 * Geteilte Berechtigungslogik für den Ausschussbereich.
 *
 * Zugriff erhalten (wie getAusschussDataSicher):
 * - Vorstand, Stellv. Vorstand, Spartenleitung, Admin
 * - aktive Ausschussmitglieder bzw. Mitglieder mit Zusatzrecht "ausschuss"
 *
 * Die Zusatzberechtigung wird serverseitig über die mit dem Login verknüpfte
 * Mitglieds-ID geprüft. Clientseitig mitgesendete Rollen werden nie vertraut.
 *
 * Kritische Verwaltungsaktionen (Löschen, finale Freigabe, Ausschussmitglieder-
 * Verwaltung) bleiben auf Vorstand / Stellv. / Admin beschränkt (kannVerwalten).
 */

const ROLLEN_MIT_ZUGRIFF = ["vorstand", "stellv_vorstand", "spartenleiter", "admin"];
const ROLLEN_VERWALTUNG = ["vorstand", "stellv_vorstand", "admin"];

export async function loeseMitgliedUndRechte(base44, user) {
  if (!user) return { mitglied: null, currentMitgliedId: null, darfAusschuss: false, kannVerwalten: false };

  let mitglied = null;
  if (user.id) {
    const treffer = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    mitglied = treffer?.[0] || null;
  }
  // Nur bei noch nicht verknüpften Alt-Konten per E-Mail suchen
  if (!mitglied && user.email) {
    const treffer = await base44.asServiceRole.entities.Mitglied.filter({ email: user.email });
    mitglied = treffer?.[0] || null;
  }

  const zusatzRaw = mitglied?.zusatz_berechtigungen || [];
  const zusatz = Array.isArray(zusatzRaw)
    ? zusatzRaw
    : String(zusatzRaw).split(",").map((x) => x.trim()).filter(Boolean);

  let aktivesAusschussmitglied = false;
  if (mitglied?.id) {
    const am = await base44.asServiceRole.entities.AusschussMitglied.filter({
      mitglied_id: mitglied.id,
      aktiv: true,
    });
    aktivesAusschussmitglied = (am?.length || 0) > 0;
  }

  const darfAusschuss =
    ROLLEN_MIT_ZUGRIFF.includes(user.role) ||
    zusatz.includes("ausschuss") ||
    aktivesAusschussmitglied;

  const kannVerwalten = ROLLEN_VERWALTUNG.includes(user.role);

  return { mitglied, currentMitgliedId: mitglied?.id || null, darfAusschuss, kannVerwalten };
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