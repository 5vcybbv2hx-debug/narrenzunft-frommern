import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

/**
 * Sicherer Ausschussbereich-Zugriff
 * Nur vorstand, stellv_vorstand, admin – NICHT spartenleiter
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ZUGRIFF_ROLLEN = ["vorstand", "stellv_vorstand", "admin"];

  if (!ZUGRIFF_ROLLEN.includes(user.role)) {
    return Response.json({
      error: "Access Denied",
      message: "Dieser Bereich ist nur für Vorstand und Admin zugänglich.",
    }, { status: 403 });
  }

  const [termine, aufgaben, beschluesse, mitglieder, ausschussMitglieder] = await Promise.all([
    base44.asServiceRole.entities.KalenderTermin.list("datum", 100),
    base44.asServiceRole.entities.Ausschussaufgabe.list("-created_date", 100),
    base44.asServiceRole.entities.Beschluss.list("-datum", 100),
    base44.asServiceRole.entities.Mitglied.list("nachname", 500),
    base44.asServiceRole.entities.AusschussMitglied.filter({ aktiv: true }),
  ]);

  const filteredTermine = termine.filter(x =>
    ["Ausschusssitzung", "Vorstandssitzung", "Intern"].includes(x.terminart)
  );

  return Response.json({
    termine: filteredTermine,
    aufgaben,
    beschluesse,
    mitglieder,
    ausschussMitglieder,
  });
});