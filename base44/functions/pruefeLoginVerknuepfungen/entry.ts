import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Prüft ALLE App-Logins gegen die Mitglieder-Profile und meldet nur die Problemfälle.
 *
 * Status je Login:
 *  - 'verknuepft'        : ein Mitgliedsprofil trägt diese user_id (alles gut)
 *  - 'verknuepfbar'      : genau EINE Mitglieds-E-Mail passt (case-insensitive), Profil ist frei
 *  - 'mehrdeutig'        : mehrere Mitglieder teilen die E-Mail (Familien-Adresse) → manuell
 *  - 'fremd_verknuepft'  : E-Mail passt, aber das Profil ist schon mit einem ANDEREN Login verknüpft
 *  - 'kein_profil'       : keine Mitglieds-E-Mail passt → Profil fehlt/abweichende Adresse
 *
 * Aktion 'verknuepfen' { paare: [{ user_id, mitglied_id }] } verknüpft explizit
 * (nur Verwaltung; prüft, dass Ziel-Profil frei ist und user_id existiert).
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'vorstand', 'stellv_vorstand'].includes(user.role)) {
      return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }
    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));

    if (body.aktion === 'verknuepfen') {
      const paare = Array.isArray(body.paare) ? body.paare : [];
      if (!paare.length) return Response.json({ error: 'paare fehlen' }, { status: 400 });
      const ergebnis = [];
      for (const p of paare) {
        if (!p?.user_id || !p?.mitglied_id) continue;
        const m = await S.Mitglied.get(p.mitglied_id).catch(() => null);
        if (!m) { ergebnis.push({ mitglied_id: p.mitglied_id, ok: false, grund: 'Mitglied nicht gefunden' }); continue; }
        if (m.user_id && m.user_id !== p.user_id) {
          ergebnis.push({ mitglied_id: p.mitglied_id, ok: false, grund: 'Profil ist bereits mit einem anderen Login verknüpft' });
          continue;
        }
        await S.Mitglied.update(p.mitglied_id, { user_id: p.user_id });
        ergebnis.push({ mitglied_id: p.mitglied_id, ok: true, name: `${m.vorname || ''} ${m.nachname || ''}`.trim() });
      }
      return Response.json({ erfolg: true, ergebnis });
    }

    // ── Vollständiger Abgleich ──
    const users = await S.User.list(500);
    let mitglieder = await S.Mitglied.list(500);
    if (mitglieder.length >= 500) {
      const rest = await S.Mitglied.list(500, 500);
      mitglieder = mitglieder.concat(rest || []);
    }

    const norm = (e) => String(e || '').trim().toLowerCase();
    const byEmail = new Map();
    const byUserId = new Map();
    mitglieder.forEach((m) => {
      if (m.email) {
        const k = norm(m.email);
        if (!byEmail.has(k)) byEmail.set(k, []);
        byEmail.get(k).push(m);
      }
      if (m.user_id) byUserId.set(m.user_id, m);
    });

    const probleme = [];
    let verknuepft = 0;

    for (const u of users || []) {
      const vorhanden = byUserId.get(u.id);
      if (vorhanden) { verknuepft++; continue; }

      const kandidaten = byEmail.get(norm(u.email)) || [];
      const frei = kandidaten.filter((m) => !m.user_id || m.user_id === u.id);
      const belegt = kandidaten.filter((m) => m.user_id && m.user_id !== u.id);

      let status;
      if (kandidaten.length === 0) status = 'kein_profil';
      else if (frei.length === 1) status = 'verknuepfbar';
      else if (frei.length > 1) status = 'mehrdeutig';
      else status = 'fremd_verknuepft';

      probleme.push({
        status,
        user_id: u.id,
        email: u.email || '',
        role: u.role || 'user',
        created_date: u.created_date || '',
        kandidaten: kandidaten.slice(0, 4).map((m) => ({
          id: m.id,
          name: `${m.vorname || ''} ${m.nachname || ''}`.trim(),
          user_id: m.user_id || '',
          status: m.mitgliedsstatus || '',
          archiviert: !!m.archiviert,
        })),
        fremd_verknuepft_mit: belegt.length > 0 ? belegt[0].user_id : '',
      });
    }

    const reihenfolge = { verknuepfbar: 0, mehrdeutig: 1, kein_profil: 2, fremd_verknuepft: 3 };
    probleme.sort((a, b) => (reihenfolge[a.status] ?? 9) - (reihenfolge[b.status] ?? 9));

    return Response.json({
      erfolg: true,
      gesamt_logins: (users || []).length,
      gesamt_mitglieder: mitglieder.length,
      verknuepft,
      anzahl_probleme: probleme.length,
      zaehlung: {
        verknuepfbar: probleme.filter((p) => p.status === 'verknuepfbar').length,
        mehrdeutig: probleme.filter((p) => p.status === 'mehrdeutig').length,
        kein_profil: probleme.filter((p) => p.status === 'kein_profil').length,
        fremd_verknuepft: probleme.filter((p) => p.status === 'fremd_verknuepft').length,
      },
      probleme,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}
