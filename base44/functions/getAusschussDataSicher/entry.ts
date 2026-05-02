import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

/**
 * Rollenbasierter Ausschussbereich-Zugriff
 * Nur Vorstand, Stellv. Vorstand, Spartenleiter, Admin dürfen Daten sehen
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ZUGRIFF_ROLLEN = ["vorstand", "stellv_vorstand", "spartenleiter", "admin"];
    
    if (!ZUGRIFF_ROLLEN.includes(user.role)) {
      return Response.json({ 
        error: "Access Denied",
        message: "Dieser Bereich ist nur für Vorstand und Ausschuss zugänglich."
      }, { status: 403 });
    }

    // Berechtigte Benutzer können alle Daten abrufen
    const [termine, aufgaben, beschluesse, mitglieder, ausschussMitglieder, abstimmungen, stimmen] = await Promise.all([
      base44.entities.KalenderTermin.list("datum", 100),
      base44.entities.Ausschussaufgabe.list("-created_date", 100),
      base44.entities.Beschluss.list("-datum", 100),
      base44.entities.Mitglied.list("nachname", 500),
      base44.entities.AusschussMitglied.filter({ aktiv: true }),
      base44.entities.Abstimmung.list(),
      base44.entities.AbstimmungsStimme.list(),
    ]);

    // Nur Ausschuss-/Vorstandstermine
    const filteredTermine = termine.filter(x => 
      ["Ausschusssitzung", "Vorstandssitzung", "Intern"].includes(x.terminart)
    );

    return Response.json({
      success: true,
      data: {
        termine: filteredTermine,
        aufgaben,
        beschluesse,
        mitglieder,
        ausschussMitglieder,
        abstimmungen,
        stimmen,
      }
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});