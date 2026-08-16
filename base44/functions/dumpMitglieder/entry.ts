import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const erlaubteRollen = ['admin', 'vorstand', 'stellv_vorstand'];
    if (!erlaubteRollen.includes(user.role)) {
      return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    const allMembers = await base44.asServiceRole.entities.Mitglied.list(500);
    
    const result = allMembers.map(m => ({
      id: m.id,
      vorname: m.vorname,
      nachname: m.nachname,
    }));

    return Response.json({ count: result.length, members: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
