import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

/**
 * Rollenbasierte Häs-Suche
 * Nur Häs zeigen, die der Nutzer sehen darf.
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
    const [allHaes, allMitglieder] = await Promise.all([
      base44.entities.Haes.list("haesnummer", 1000),
      base44.entities.Mitglied.list("nachname", 1000),
    ]);

    const myMitglieder = allMitglieder.filter(m => m.user_id === user.id);
    const myMitglied = myMitglieder[0] || null;

    const role = myMitglied?.app_rolle || "mitglied";
    const isAdmin = user.role === "admin" || user.role === "vorstand" || user.role === "stellv_vorstand";

    // Admin: alles
    if (isAdmin) {
      const results = allHaes.filter(h =>
        h.haesnummer.toLowerCase().includes(searchTerm) ||
        (h.bezeichnung && h.bezeichnung.toLowerCase().includes(searchTerm))
      );
      return Response.json({ results: results.slice(0, 20) });
    }

    // Normal-Mitglied: nur eigene Häs
    if (role === "mitglied") {
      if (!myMitglied) return Response.json({ results: [] });
      const results = allHaes.filter(h =>
        h.aktueller_besitzer_id === myMitglied.id &&
        (h.haesnummer.toLowerCase().includes(searchTerm) ||
         (h.bezeichnung && h.bezeichnung.toLowerCase().includes(searchTerm)))
      );
      return Response.json({ results: results.slice(0, 20) });
    }

    // Elternkonto: eigene Häs + Häs der Kinder
    if (role === "elternkonto") {
      if (!myMitglied) return Response.json({ results: [] });
      const verwandtschaften = await base44.entities.Verwandtschaft.filter({ mitglied_id: myMitglied.id });
      const kinderIds = verwandtschaften
        .filter(v => v.beziehung === "Kind")
        .map(v => v.verwandter_id);

      const results = allHaes.filter(h =>
        (h.aktueller_besitzer_id === myMitglied.id || kinderIds.includes(h.aktueller_besitzer_id)) &&
        (h.haesnummer.toLowerCase().includes(searchTerm) ||
         (h.bezeichnung && h.bezeichnung.toLowerCase().includes(searchTerm)))
      );
      return Response.json({ results: results.slice(0, 20) });
    }

    // Spartenleiter: nur Häs seiner Gruppe
    if (role === "spartenleiter" && myMitglied?.spartenleiter_haesgruppe_id) {
      const results = allHaes.filter(h =>
        h.haesgruppe_id === myMitglied.spartenleiter_haesgruppe_id &&
        (h.haesnummer.toLowerCase().includes(searchTerm) ||
         (h.bezeichnung && h.bezeichnung.toLowerCase().includes(searchTerm)))
      );
      return Response.json({ results: results.slice(0, 20) });
    }

    return Response.json({ results: [] });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});