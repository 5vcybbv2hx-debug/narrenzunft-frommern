import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Listet alle App-Konten (id, E-Mail, Name, Rolle) für den Vorstand/admin.
 * Dient der Fehlersuche, wenn ein Login kein Mitgliederprofil findet
 * (z.B. abweichende E-Mail-Adresse bei der Registrierung).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'vorstand', 'stellv_vorstand'].includes(user.role)) {
      return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }
    // Vollständig blättern: list(limit) liefert je nach SDK nur eine Seite.
    // Mit einer Seite fehlten die neuesten Konten und verknüpfte Mitglieder
    // erschienen in der Oberfläche als "kein App-Konto".
    const users = [];
    for (let skip = 0; skip < 5000; skip += 200) {
      const teil = await base44.asServiceRole.entities.User.list('created_date', 200, skip).catch(() => []);
      if (!Array.isArray(teil) || teil.length === 0) break;
      users.push(...teil);
      if (teil.length < 200) break;
    }
    return Response.json({
      users: (users || []).map(u => ({
        id: u.id,
        email: u.email || '',
        full_name: u.full_name || '',
        role: u.role || 'user',
        created_date: u.created_date || '',
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
});