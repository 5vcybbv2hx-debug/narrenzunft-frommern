import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMeinMitglied } from "../../shared/mitgliedBerechtigung.ts";

/**
 * Status einer Arbeitsdienst-Zuweisung aendern — RLS-sicher.
 *
 * Problem: Die RLS-Regeln der ArbeitsdienstZuweisung erlauben Updates nur dem
 * Ersteller (i.d.R. Vorstand/Admin). Ein zugewiesenes Mitglied konnte seine
 * Zusage/Absage daher nicht mehr speichern.
 *
 * Diese Function laeuft mit Service-Role und prueft selbst:
 *  - Verwaltung (admin/vorstand/stellv_vorstand/spartenleiter): jeder Status
 *  - Sonst nur das ZUGEWIESENE MITGLIED selbst und nur 'Bestätigt'/'Abgesagt'
 *
 * Body: { zuweisung_id: string, status: string }
 */
const SELBST_ERLAUBT = ["Bestätigt", "Abgesagt"];
const VERWALTUNG_ROLLEN = ["admin", "vorstand", "stellv_vorstand", "spartenleiter"];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { zuweisung_id, status } = body;
    if (!zuweisung_id || !status) {
      return Response.json({ error: "zuweisung_id und status fehlen" }, { status: 400 });
    }

    const S = base44.asServiceRole.entities;
    const z = await S.ArbeitsdienstZuweisung.get(zuweisung_id).catch(() => null);
    if (!z) return Response.json({ error: "Zuweisung nicht gefunden" }, { status: 404 });

    if (!VERWALTUNG_ROLLEN.includes(user.role)) {
      const meinMitglied = await loeseMeinMitglied(base44, user);
      const istMeineZuweisung = !!meinMitglied && z.mitglied_id === meinMitglied.id;
      if (!istMeineZuweisung) {
        return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
      }
      if (!SELBST_ERLAUBT.includes(status)) {
        return Response.json({ error: "Dieser Status ist nicht erlaubt" }, { status: 403 });
      }
    }

    await S.ArbeitsdienstZuweisung.update(zuweisung_id, { status });
    return Response.json({ ok: true, status });
  } catch (error) {
    return Response.json({ error: error.message || "Unbekannter Fehler" }, { status: 500 });
  }
}
