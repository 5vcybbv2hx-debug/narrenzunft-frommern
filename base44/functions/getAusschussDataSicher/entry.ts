import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMitgliedUndRechte } from "../../shared/ausschussBerechtigung.ts";

/**
 * Zentrale, sichere Datenquelle für den Ausschussbereich.
 *
 * Zugriff erhalten (über shared ausschussBerechtigung.ts abgeleitet):
 * - Vorstand, Stellvertretung, Admin
 * - aktive Spartenleitung (Mitglied mit nicht-leerem spartenleiter_haesgruppen_ids)
 * - aktive Ausschussmitglieder bzw. Mitglieder mit Zusatzrecht "ausschuss"
 *
 * Die Berechtigung wird serverseitig über die mit dem Login verknüpfte
 * Mitglieds-ID geprüft. Clientseitig mitgesendete Rollen werden nie vertraut.
 * Spartenleiter erhalten nur Ausschusszugang (canManage = false); Verwaltungs-
 * rechte (canManage) bleiben auf Vorstand/Stellv./Admin beschränkt.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const ctx = await loeseMitgliedUndRechte(base44, user);

    if (ctx.mehrdeutig) {
      return Response.json({
        error: "Mehrdeutige Verknüpfung",
        message: "E-Mail/Verknüpfung ist mehreren Mitgliedern zugeordnet — ein Admin muss die Verknüpfung manuell vornehmen.",
      }, { status: 409 });
    }

    if (!ctx.darfAusschuss) {
      return Response.json({
        error: "Access Denied",
        message: "Dieser Bereich ist nur für berechtigte Ausschussmitglieder zugänglich.",
      }, { status: 403 });
    }

    const canManage = ctx.kannVerwalten;

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
      currentMitgliedId: ctx.currentMitgliedId,
      canManage,
      aktiveSpartenleitung: ctx.aktiveSpartenleitung,
    });
  } catch (error) {
    console.error("getAusschussDataSicher:", error);
    return Response.json({ error: error.message || "Interner Fehler" }, { status: 500 });
  }
});