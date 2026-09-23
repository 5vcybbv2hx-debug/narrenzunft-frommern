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

const ROLLEN_MIT_ZUGRIFF = ["vorstand", "stellv_vorstand", "admin"];
const ROLLEN_VERWALTUNG = ["vorstand", "stellv_vorstand", "admin"];

/** Nur eindeutig verknüpfte Logins dürfen Mitgliedsrechte übernehmen. */
export async function findeMitgliedFuerLogin(base44, user) {
  if (user?.id) {
    const byId = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    if (byId?.length === 1) return byId[0];
    if (byId?.length > 1) return null;
  }
  if (!user?.email) return null;
  // E-Mail-Adressen werden teils mit abweichender Großschreibung gespeichert.
  // Auch solche Dubletten müssen die automatische Verknüpfung verhindern.
  const alle = await base44.asServiceRole.entities.Mitglied.list({ limit: 500 });
  if (alle.length >= 500) return null; // Ohne vollständige Trefferliste keine Rechte per E-Mail.
  const norm = String(user.email).trim().toLowerCase();
  const kandidaten = alle.filter(m => m.email && m.email.trim().toLowerCase() === norm);
  if (kandidaten.length !== 1) return null;
  const m = kandidaten[0];
  return m.user_id && m.user_id !== user.id ? null : m;
}

/** Rollenrecht aus einer aktiven Gruppe, statt dauerhaftem Zusatzrecht. */
export async function istAktuellerSpartenleiter(base44, mitgliedId) {
  if (!mitgliedId) return false;
  const gruppen = await base44.asServiceRole.entities.Haesgruppe.list("name", 250);
  return (gruppen || []).some(g => g.aktiv !== false && (
    (Array.isArray(g.verantwortliche_ids) && g.verantwortliche_ids.includes(mitgliedId)) ||
    g.verantwortlicher_id === mitgliedId
  ));
}

export async function loeseMitgliedUndRechte(base44, user) {
  if (!user) return { mitglied: null, currentMitgliedId: null, darfAusschuss: false, kannVerwalten: false };

  const mitglied = await findeMitgliedFuerLogin(base44, user);

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
    aktivesAusschussmitglied ||
    await istAktuellerSpartenleiter(base44, mitglied?.id);

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