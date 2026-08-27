import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ['vorstand', 'stellv_vorstand', 'admin'].includes(user.role);

    // Alle Häs und Gruppen laden (für alle Nutzer sichtbar)
    const [haes, gruppen] = await Promise.all([
      base44.asServiceRole.entities.Haes.list('bezeichnung', 500),
      base44.asServiceRole.entities.Haesgruppe.list('name', 100),
    ]);

    // Besitzer-Namen für alle Häs ermitteln
    const besitzerIds = [...new Set(haes.map(h => h.aktueller_besitzer_id).filter(Boolean))];
    let besitzerMap: Record<string, string> = {};
    if (besitzerIds.length > 0) {
      const mitglieder = await base44.asServiceRole.entities.Mitglied.list('nachname', 1000);
      for (const m of mitglieder) {
        besitzerMap[m.id] = `${m.vorname || ''} ${m.nachname || ''}`.trim();
      }
    }

    // besitzer_name zu jedem Häs hinzufügen
    const haesWithName = haes.map((h: any) => ({
      ...h,
      besitzer_name: h.aktueller_besitzer_id ? (besitzerMap[h.aktueller_besitzer_id] || '–') : '',
    }));

    if (isAdmin) {
      // Admin: zusätzlich volle Mitglieder-Liste für Formulare
      const mitglieder = await base44.asServiceRole.entities.Mitglied.list('nachname', 1000);
      return Response.json({
        erfolg: true,
        haes: haesWithName,
        gruppen,
        mitglieder,
        kannBearbeiten: true,
      });
    }

    // Mitglied: alle Häs mit Besitzer-Namen, aber ohne sensible Daten
    return Response.json({
      erfolg: true,
      haes: haesWithName,
      gruppen,
      kannBearbeiten: false,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[getHaesSicher]', msg);
    return Response.json({ erfolg: false, error: msg }, { status: 500 });
  }
});