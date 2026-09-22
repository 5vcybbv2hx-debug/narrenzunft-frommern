import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMitgliedUndRechte, schreibeAudit } from "../../shared/ausschussBerechtigung.ts";

/**
 * Generiert duplikatsicher Aufgaben aus aktiven Jahresplan-Vorlagen für ein
 * gewähltes Jahr. Pro Vorlage wird höchstens eine Aufgabe pro Jahr erzeugt
 * (gesteuert über zuletzt_generiert_jahr). Nur Vorstand/Stellv./Admin.
 */
const MONATE_TAGE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function faelligDatum(jahr, monat, tag) {
  const m = monat || 12;
  const maxTage = m === 2 ? (jahr % 4 === 0 ? 29 : 28) : MONATE_TAGE[m - 1] || 31;
  const t = Math.min(tag || maxTage, maxTage);
  return `${jahr}-${String(m).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const ctx = await loeseMitgliedUndRechte(base44, user);
    if (!ctx.kannVerwalten) {
      return Response.json({ error: "Access Denied", message: "Nur Vorstand/Stellv./Admin." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const jahr = Number(body.jahr) || new Date().getFullYear();
    const S = base44.asServiceRole.entities;

    const plaene = (await S.AusschussJahresplan.filter({ aktiv: true })) || [];
    let erzeugt = 0;
    const erstellt = [];

    for (const plan of plaene) {
      // Duplikatschutz: pro Vorlage und Jahr nur einmal
      if (plan.zuletzt_generiert_jahr === jahr) continue;
      // Einmalige Pläne nur im Zielfahr
      if (plan.wiederholung === "Einmalig" && plan.jahr && plan.jahr !== jahr) continue;

      const faellig_am = faelligDatum(jahr, plan.monat, plan.tag);
      const aufg = await S.Ausschussaufgabe.create({
        titel: plan.titel,
        beschreibung: plan.beschreibung || "",
        status: "Offen",
        prioritaet: plan.prioritaet || "Mittel",
        faellig_am,
        verantwortlicher_id: plan.verantwortlicher_id || "",
        wiederholung: plan.wiederholung || "Jährlich",
        quell_aufgabe_id: plan.id,
      });
      await S.AusschussJahresplan.update(plan.id, { zuletzt_generiert_jahr: jahr });
      erstellt.push({ id: aufg.id, titel: aufg.titel });
      erzeugt++;
    }

    if (erzeugt > 0) {
      await schreibeAudit(base44, ctx, "Jahresplan", "", "jahresplan_generiert", { jahr, erzeugt });
    }

    return Response.json({ ok: true, jahr, erzeugt, erstellt });
  } catch (error) {
    console.error("generiereJahresplanAufgabenSicher:", error);
    return Response.json({ error: error.message || "Interner Fehler" }, { status: 500 });
  }
}