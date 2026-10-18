import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { istVerwaltung } from "../../shared/mitgliedBerechtigung.ts";
import { sendePush } from "../../shared/pushSenden.ts";

/**
 * Tägliche Push-Erinnerungen (per Automation/Auftrag einmal täglich ~19:00 aufrufen).
 *
 *  1. Ausfahrt-Reminder: Ausfahrten MORGEN -> Treffpunkt/Zeit an Angemeldete
 *  2. Beitragserinnerung: nur am 15. Januar/Juli -> offene Beiträge
 *
 * Idempotent über PushErinnerungLog (schluessel): keine Doppel-Sends,
 * auch wenn die Funktion mehrfach täglich läuft.
 */
const heuteISO = () => new Date().toISOString().split("T")[0];

function addiereTage(iso, tage) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + tage);
  return d.toISOString().split("T")[0];
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!istVerwaltung(user)) {
      return Response.json({ error: "Nur Vorstand/Stellv./Admin (Automation/Owner)" }, { status: 403 });
    }
    const S = base44.asServiceRole.entities;
    const heute = heuteISO();
    const morgen = addiereTage(heute, 1);

    // Bereits gesendete Erinnerungen laden (Dedupe)
    const logs = await S.PushErinnerungLog.list("-created_date", 200).catch(() => []);
    const gesendet = new Set((logs || []).map((l) => l.schluessel));

    const bericht = { ausfahrten: [], beitraege: [], ausgelassen: 0 };

    async function merke(schluessel, typ, empfaenger) {
      await S.PushErinnerungLog.create({ schluessel, typ, empfaenger, gesendet_am: heute }).catch(() => {});
    }

    // ── 1. Ausfahrt-Reminder (morgen) ──
    try {
      const ausfahrten = await S.Ausfahrt.list("-datum", 200);
      const faellige = (ausfahrten || []).filter((a) =>
        a.datum === morgen && (a.status || "") !== "Abgesagt");
      for (const a of faellige) {
        const schluessel = `ausfahrt_${a.id}_${a.datum}`;
        if (gesendet.has(schluessel)) { bericht.ausgelassen++; continue; }
        const anm = await S.AusfahrtAnmeldung.filter({ ausfahrt_id: a.id });
        const ids = [...new Set((anm || [])
          .filter((x) => (x.status || "Angemeldet") === "Angemeldet" && x.mitglied_id)
          .map((x) => String(x.mitglied_id)))];
        if (!ids.length) { bericht.ausgelassen++; continue; }
        const erg = await sendePush(ids,
          `Morgen: ${a.titel}`,
          `Abfahrt ${a.abfahrt_zeit || "siehe Details"}${a.abfahrt_ort ? ` bei ${a.abfahrt_ort}` : ""}. Bis morgen!`,
          { route: `/ausfahrten/${a.id}` });
        if (erg.erfolg) { await merke(schluessel, "ausfahrt", ids.length); bericht.ausfahrten.push({ titel: a.titel, erreicht: erg.erreicht, invalid: erg.invalid }); }
      }
    } catch (e) { console.error("Ausfahrt-Reminder:", e); bericht.ausfahrten = [{ fehler: String(e?.message || e) }]; }

    // ── 2. Beitragserinnerung (nur 15.01. und 15.07.) ──
    const monatTag = heute.slice(5); // MM-DD
    if (monatTag === "01-15" || monatTag === "07-15") {
      try {
        const jahr = heute.slice(0, 4);
        const schluessel = `beitrag_${jahr}_${monatTag}`;
        if (!gesendet.has(schluessel)) {
          const beitraege = await S.Beitrag.filter({ jahr });
          const offen = (beitraege || []).filter((b) => (b.zahlungsstatus || "Offen") === "Offen");
          const mitglieder = await S.Mitglied.list("-created_date", 1000);
          const mitKonto = new Map((mitglieder || []).filter((m) => m.user_id).map((m) => [String(m.id), m]));
          const ids = [...new Set(offen.filter((b) => mitKonto.has(String(b.mitglied_id))).map((b) => String(b.mitglied_id)))];
          if (ids.length) {
            const erg = await sendePush(ids,
              "Beitragserinnerung",
              `Dein Vereinsbeitrag ${jahr} ist noch offen. Details findest du unter Beiträge in der App.`,
              { route: "/beitraege" });
            if (erg.erfolg) { await merke(schluessel, "beitrag", ids.length); bericht.beitraege = [{ jahr, erreicht: erg.erreicht, invalid: erg.invalid }]; }
          }
        }
      } catch (e) { console.error("Beitrag-Reminder:", e); bericht.beitraege = [{ fehler: String(e?.message || e) }]; }
    }

    return Response.json({ ok: true, datum: heute, morgen, bericht });
  } catch (error) {
    console.error("versendePushErinnerungen:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
