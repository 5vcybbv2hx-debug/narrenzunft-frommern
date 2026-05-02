import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

/**
 * Rollenbasierte Mitgliedersuche
 * Nur Daten zeigen, die der aktuelle Nutzer sehen darf.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query } = await req.json();
    if (!query || query.trim().length === 0) {
      return Response.json({ results: [] });
    }

    const searchTerm = query.toLowerCase();

    // Hole alle Mitglieder (einmalig)
    const allMitglieder = await base44.entities.Mitglied.list("nachname", 1000);

    // Hole das Mitglied des aktuellen Users
    const myMitglieder = allMitglieder.filter(m => m.user_id === user.id);
    const myMitglied = myMitglieder[0] || null;

    // Rolle ermitteln
    const role = myMitglied?.app_rolle || "mitglied";
    const isAdmin = user.role === "admin" || user.role === "vorstand" || user.role === "stellv_vorstand";

    // Admin/Vorstand: alles durchsuchen
    if (isAdmin) {
      const results = allMitglieder.filter(m =>
        `${m.vorname} ${m.nachname}`.toLowerCase().includes(searchTerm)
      );
      return Response.json({ results: results.slice(0, 20) });
    }

    // Normal-Mitglied: nur sich selbst
    if (role === "mitglied") {
      if (!myMitglied) return Response.json({ results: [] });
      const matches = [];
      if (`${myMitglied.vorname} ${myMitglied.nachname}`.toLowerCase().includes(searchTerm)) {
        matches.push(myMitglied);
      }
      return Response.json({ results: matches });
    }

    // Elternkonto: sich selbst + Kinder
    if (role === "elternkonto") {
      if (!myMitglied) return Response.json({ results: [] });
      const verwandtschaften = await base44.entities.Verwandtschaft.filter({ mitglied_id: myMitglied.id });
      const kinderIds = verwandtschaften
        .filter(v => v.beziehung === "Kind")
        .map(v => v.verwandter_id);
      
      const results = allMitglieder.filter(m =>
        (m.id === myMitglied.id || kinderIds.includes(m.id)) &&
        `${m.vorname} ${m.nachname}`.toLowerCase().includes(searchTerm)
      );
      return Response.json({ results: results.slice(0, 20) });
    }

    // Spartenleiter: nur sich selbst
    if (role === "spartenleiter") {
      if (!myMitglied) return Response.json({ results: [] });
      const matches = [];
      if (`${myMitglied.vorname} ${myMitglied.nachname}`.toLowerCase().includes(searchTerm)) {
        matches.push(myMitglied);
      }
      return Response.json({ results: matches });
    }

    return Response.json({ results: [] });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});