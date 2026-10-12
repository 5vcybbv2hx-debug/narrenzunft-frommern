import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Laedt ein einzelnes Mitglied per E-Mail in die App ein (base44.users.inviteUser).
 * Body: { email: string, rolle?: 'user' | 'admin' }
 * Aufruf nur durch Vorstand / stellv. Vorstand / Admin.
 */
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').trim();
    const rolle = body.rolle === 'admin' ? 'admin' : 'user';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Ungültige oder fehlende E-Mail-Adresse' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'vorstand', 'stellv_vorstand'].includes(user.role)) {
      return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    const result = await base44.users.inviteUser(email, rolle);
    return Response.json({ success: true, email, rolle, result });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
});
