import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

/**
 * Rollenbasierte Arbeitsdienste-Suche
 * Nur Dienste zeigen, die der Nutzer sehen darf.
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
    const [allDienste, allMitglieder, allZuweisungen] = await Promise.all([
      base44.entities.Arbeitsdienst.list("datum", 1000),
      base44.entities.Mitglied.list("nachname", 1000),
      base44.entities.ArbeitsdienstZuweisung.list(),
    ]);

    const myMitglieder = allMitglieder.filter(m => m.user_id === user.id);
    const myMitglied = myMitglieder[0] || null;

    const role = myMitglied?.app_rolle || "mitglied";
    const isAdmin = user.role === "admin" || user.role === "vorstand" || user.role === "stellv_vorstand";

    // Admin: alles
    if (isAdmin) {
      const results = allDienste.filter(d =>
        d.titel.toLowerCase().includes(searchTerm) ||
        (d.beschreibung && d.beschreibung.toLowerCase().includes(searchTerm))
      );
      return Response.json({ results: results.slice(0, 20) });
    }

    // Normal-Mitglied: nur eigene Zuweisungen
    if (role === "mitglied") {
      if (!myMitglied) return Response.json({ results: [] });
      const myZuweisungen = allZuweisungen.filter(z => z.mitglied_id === myMitglied.id);
      const myDienstIds = new Set(myZuweisungen.map(z => z.arbeitsdienst_id));

      const results = allDienste.filter(d =>
        myDienstIds.has(d.id) &&
        (d.titel.toLowerCase().includes(searchTerm) ||
         (d.beschreibung && d.beschreibung.toLowerCase().includes(searchTerm)))
      );
      return Response.json({ results: results.slice(0, 20) });
    }

    // Elternkonto: eigene + Dienste der Kinder
    if (role === "elternkonto") {
      if (!myMitglied) return Response.json({ results: [] });
      const verwandtschaften = await base44.entities.Verwandtschaft.filter({ mitglied_id: myMitglied.id });
      const kinderIds = verwandtschaften
        .filter(v => v.beziehung === "Kind")
        .map(v => v.verwandter_id);

      const familienMitgliederIds = [myMitglied.id, ...kinderIds];
      const myZuweisungen = allZuweisungen.filter(z => familienMitgliederIds.includes(z.mitglied_id));
      const myDienstIds = new Set(myZuweisungen.map(z => z.arbeitsdienst_id));

      const results = allDienste.filter(d =>
        myDienstIds.has(d.id) &&
        (d.titel.toLowerCase().includes(searchTerm) ||
         (d.beschreibung && d.beschreibung.toLowerCase().includes(searchTerm)))
      );
      return Response.json({ results: results.slice(0, 20) });
    }

    // Verantwortlicher: nur Dienste, für die er verantwortlich ist
    if ((role === "spartenleiter" || role === "kassierer") && myMitglied) {
      const results = allDienste.filter(d =>
        (d.verantwortlicher_id === myMitglied.id) &&
        (d.titel.toLowerCase().includes(searchTerm) ||
         (d.beschreibung && d.beschreibung.toLowerCase().includes(searchTerm)))
      );
      return Response.json({ results: results.slice(0, 20) });
    }

    return Response.json({ results: [] });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});