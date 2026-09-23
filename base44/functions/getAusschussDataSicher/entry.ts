import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

/**
 * Zentrale, sichere Datenquelle für den Ausschussbereich.
 *
 * Zugriff erhalten dieselben Personen wie im Frontend:
 * - Vorstand, Stellvertretung, Spartenleitung, Admin
 * - aktive Ausschussmitglieder bzw. Mitglieder mit Zusatzrecht "ausschuss"
 *
 * Die Zusatzberechtigung wird serverseitig über die mit dem Login verknüpfte
 * Mitglieds-ID geprüft. Clientseitig mitgesendete Rollen werden nie vertraut.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rollenMitZugriff = ["vorstand", "stellv_vorstand", "spartenleiter", "admin"];
    let mitglied = null;

    if (user.id) {
      const treffer = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
      mitglied = treffer?.[0] || null;
    }

    // Nur bei noch nicht verknüpften Alt-Konten per E-Mail suchen. Die E-Mail
    // kommt aus dem authentifizierten Login und nicht aus dem Request-Body.
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

    const darfAusschussSehen =
      rollenMitZugriff.includes(user.role) ||
      zusatz.includes("ausschuss") ||
      aktivesAusschussmitglied;

    if (!darfAusschussSehen) {
      return Response.json({
        error: "Access Denied",
        message: "Dieser Bereich ist nur für berechtigte Ausschussmitglieder zugänglich.",
      }, { status: 403 });
    }

    const canManage = ["vorstand", "stellv_vorstand", "admin"].includes(user.role);

    const [
      termine,
      aufgaben,
      beschluesse,
      mitglieder,
      ausschussMitglieder,
      abstimmungen,
      protokolle,
      antraege,
      veranstaltungen,
      jahresplaene,
      auditLogs,
      tops,
      stimmen,
    ] = await Promise.all([
      base44.asServiceRole.entities.KalenderTermin.list("datum", 250),
      base44.asServiceRole.entities.Ausschussaufgabe.list("-created_date", 500),
      base44.asServiceRole.entities.Beschluss.list("-datum", 500),
      base44.asServiceRole.entities.Mitglied.list("nachname", 500),
      base44.asServiceRole.entities.AusschussMitglied.filter({ aktiv: true }),
      base44.asServiceRole.entities.Abstimmung.list("-created_date", 500),
      base44.asServiceRole.entities.Protokoll.list("-datum", 500),
      canManage ? base44.asServiceRole.entities.Mitgliedsantrag.list("-created_date", 500) : Promise.resolve([]),
      base44.asServiceRole.entities.Veranstaltung.list("-datum", 500),
      base44.asServiceRole.entities.AusschussJahresplan.list("titel", 200).catch(() => []),
      base44.asServiceRole.entities.AusschussAuditLog.list("-zeitpunkt", 300).catch(() => []),
      base44.asServiceRole.entities.Tagesordnungspunkt.list("reihenfolge", 1000).catch(() => []),
      base44.asServiceRole.entities.AbstimmungsStimme.list("-created_date", 1000).catch(() => []),
    ]);

    const sitzungen = termine.filter((x) =>
      ["Ausschusssitzung", "Vorstandssitzung", "Intern"].includes(x.terminart)
    );

    return Response.json({
      termine: sitzungen,
      aufgaben,
      beschluesse,
      mitglieder: (mitglieder || []).map((m) => ({
        id: m.id,
        vorname: m.vorname,
        nachname: m.nachname,
        mitgliedsstatus: m.mitgliedsstatus,
        app_rolle: m.app_rolle,
        spartenleiter_haesgruppen_ids: m.spartenleiter_haesgruppen_ids,
        spartenleiter_haesgruppe_id: m.spartenleiter_haesgruppe_id,
      })),
      ausschussMitglieder,
      abstimmungen,
      protokolle,
      antraege,
      veranstaltungen,
      jahresplaene: jahresplaene || [],
      auditLogs: auditLogs || [],
      tops: tops || [],
      stimmen: stimmen || [],
      currentMitgliedId: mitglied?.id || null,
      canManage,
    });
  } catch (error) {
    console.error("getAusschussDataSicher:", error);
    return Response.json({ error: error.message || "Interner Fehler" }, { status: 500 });
  }
});