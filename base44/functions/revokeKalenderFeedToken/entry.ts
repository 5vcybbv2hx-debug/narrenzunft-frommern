import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { token_id } = await req.json();
    if (!token_id) {
      return Response.json({ error: 'token_id erforderlich' }, { status: 400 });
    }

    // 1. Token laden
    const tokenResp = await base44.asServiceRole.entities.KalenderFeedToken.filter({ id: token_id });
    const token = tokenResp[0];
    if (!token) {
      return Response.json({ error: 'Token nicht gefunden' }, { status: 404 });
    }

    // 2. Berechtigung prüfen (nur Owner oder Admin)
    if (token.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    // 3. Token widerrufen
    await base44.asServiceRole.entities.KalenderFeedToken.update(token_id, {
      aktiv: false,
      widerrufen_am: new Date().toISOString(),
    });

    return Response.json({
      erfolg: true,
      message: 'Token wurde widerrufen',
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});