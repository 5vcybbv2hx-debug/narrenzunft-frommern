import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const generateRandomToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

const hashToken = async (token) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { feed_typ } = await req.json();
    if (!feed_typ) {
      return Response.json({ error: 'feed_typ erforderlich' }, { status: 400 });
    }

    const eigeneMResp = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
    const eigenMitglied = eigeneMResp[0];

    const alteTokens = await base44.asServiceRole.entities.KalenderFeedToken.filter({ 
      user_id: user.id,
      feed_typ: feed_typ,
      aktiv: true,
    });
    
    for (const token of alteTokens) {
      await base44.asServiceRole.entities.KalenderFeedToken.update(token.id, {
        aktiv: false,
        widerrufen_am: new Date().toISOString(),
      });
    }

    const plainToken = generateRandomToken();
    const tokenHash = await hashToken(plainToken);
    const jetzt = new Date().toISOString();

    const neuerToken = await base44.asServiceRole.entities.KalenderFeedToken.create({
      user_id: user.id,
      mitglied_id: eigenMitglied?.id || '',
      token_hash: tokenHash,
      feed_typ: feed_typ,
      rolle: user.role,
      erstellt_am: jetzt,
      aktiv: true,
    });

    const url = (() => {
      try {
        const reqUrl = new URL(req.url);
        const appIdMatch = reqUrl.pathname.match(/\/apps\/([^/]+)\/functions/);
        const appId = appIdMatch ? appIdMatch[1] : '';
        return `${reqUrl.origin}/api/apps/${appId}/functions/getKalenderFeedSicher?type=${feed_typ}&token=${plainToken}`;
      } catch {
        return `/api/kalender/${feed_typ}.ics?token=${plainToken}`;
      }
    })();

    return Response.json({
      erfolg: true,
      token: plainToken,
      token_id: neuerToken.id,
      feed_typ: feed_typ,
      url,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});