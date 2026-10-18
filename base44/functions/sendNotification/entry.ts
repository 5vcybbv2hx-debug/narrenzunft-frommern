import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMeinMitglied, istVerwaltung } from "../../shared/mitgliedBerechtigung.ts";
import {
  sendePush, planePush, stornierePush,
  holeAusschussIds, holeIdsMitAppKonto,
} from "../../shared/pushSenden.ts"; // redeploy 2026-10-18 20:35: erfolg an HTTP200+notification_id (commit 65ea295)

/**
 * ZENTRALE Push-Funktion. ALLE Features rufen NUR diese Funktion auf,
 * niemals eigene OneSignal-Fetches.
 *
 * Empfänger-Auflösung (Rollen-Filter, serverseitig zu Entity-IDs):
 *  - empfaenger "aktive"      : aktive Mitglieder mit App-Konto
 *  - empfaenger "ausschuss"   : aktiver Ausschuss + Verwaltung
 *  - empfaenger "dienst"      : Zugewiesene + Verantwortlicher eines Arbeitsdienstes
 *  - empfaenger "mitglieder"  : explizite mitglied_ids
 *
 * Aktionen:
 *  - "senden"                  : sofortiger Versand
 *  - "diensterinnerung_planen" : 2h-vorher-Erinnerung für einen Arbeitsdienst
 *                                (geplant, ersetzt eine bestehende Planung)
 *  - "diensterinnerung_entfernen": Planung stornieren (Dienst gelöscht)
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!istVerwaltung(user)) {
      return Response.json({ error: "Nur Vorstand/Stellv./Admin" }, { status: 403 });
    }
    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const { aktion } = body;

    async function aufloesen(empfaenger) {
      if (empfaenger === "ausschuss") {
        return holeIdsMitAppKonto(S, await holeAusschussIds(S));
      }
      if (empfaenger === "aktive") {
        const alle = await S.Mitglied.list("-created_date", 1000);
        const ids = (alle || [])
          .filter((m) => m.user_id && m.archiviert !== true && !m.todesdatum && m.mitgliedsstatus !== "Passiv")
          .map((m) => String(m.id));
        return [...new Set(ids)];
      }
      if (empfaenger === "dienst") {
        const ad = await S.Arbeitsdienst.get(body.arbeitsdienst_id).catch(() => null);
        if (!ad) return [];
        const zuw = await S.ArbeitsdienstZuweisung.filter({ arbeitsdienst_id: ad.id });
        const ids = new Set((zuw || []).filter((z) => z.status !== "Abgesagt" && z.mitglied_id).map((z) => String(z.mitglied_id)));
        if (ad.verantwortlicher_id) ids.add(String(ad.verantwortlicher_id));
        return [...ids];
      }
      if (empfaenger === "gruppe") {
        const gId = body.haesgruppe_id;
        if (!gId) return [];
        const t = await S.GruppenTeilnehmer.filter({ haesgruppe_id: gId });
        const ids = [...new Set((t || []).filter(x => x.aktiv !== false && x.mitglied_id).map(x => String(x.mitglied_id)))];
        return holeIdsMitAppKonto(S, ids);
      }
      if (empfaenger === "mitglieder") {
        return (body.mitglied_ids || []).map(String).filter(Boolean);
      }
      return [];
    }

    switch (aktion) {
      case "senden": {
        const { empfaenger, titel, nachricht, route, mitglied_ids } = body;
        if (!titel || !nachricht) return Response.json({ error: "Titel und Nachricht fehlen" }, { status: 400 });
        const ids = await aufloesen(empfaenger);
        if (!ids.length) return Response.json({ ok: false, grund: "Keine Empfänger aufgelöst" });
        const erg = await sendePush(ids, titel, nachricht, { route: route || "/" });
        return Response.json({ ok: erg.erfolg, ...erg, empfaenger, anzEmpfaenger: ids.length });
      }

      case "diensterinnerung_planen": {
        const ad = await S.Arbeitsdienst.get(body.arbeitsdienst_id).catch(() => null);
        if (!ad) return Response.json({ error: "Arbeitsdienst nicht gefunden" }, { status: 404 });
        // Alte Planung stornieren (Dienst wurde evtl. geändert)
        if (ad.push_erinnerung_id) await stornierePush(ad.push_erinnerung_id);

        const zuw = await S.ArbeitsdienstZuweisung.filter({ arbeitsdienst_id: ad.id });
        const ids = new Set((zuw || []).filter((z) => z.status !== "Abgesagt" && z.mitglied_id).map((z) => String(z.mitglied_id)));
        if (ad.verantwortlicher_id) ids.add(String(ad.verantwortlicher_id));
        const empfaenger = [...ids];
        if (!empfaenger.length) return Response.json({ ok: true, info: "Keine Empfänger zugewiesen – keine Erinnerung geplant" });

        // Startzeit = datum + uhrzeit; Erinnerung = 2 h vorher
        const start = new Date(`${ad.datum}T${(ad.uhrzeit || "12:00")}:00`);
        const erinner = new Date(start.getTime() - 2 * 60 * 60 * 1000);
        const jetzt = new Date();
        if (isNaN(start.getTime())) return Response.json({ error: "Ungültiges Dienst-Datum" }, { status: 400 });
        if (erinner <= jetzt) return Response.json({ ok: true, info: "Dienst liegt zu nah in der Vergangenheit – keine Erinnerung geplant" });
        const sendAfter = erinner.toUTCString().replace("GMT", "GMT+0000");

        const erg = await planePush(empfaenger,
          `Dienst-Erinnerung: ${ad.titel}`,
          `Dein Dienst startet heute um ${ad.uhrzeit || "–"} Uhr${ad.ort ? ` bei ${ad.ort}` : ""}.`,
          { route: "/dienste" },
          sendAfter);
        // Notification-ID am Dienst merken (zum Ersetzen/Stornieren)
        if (erg.notification_id) {
          await S.Arbeitsdienst.update(ad.id, { push_erinnerung_id: erg.notification_id }).catch(() => {});
        }
        return Response.json({ ok: erg.erfolg, ...erg, sendAfter, anzEmpfaenger: empfaenger.length });
      }

      case "diensterinnerung_entfernen": {
        const ad = await S.Arbeitsdienst.get(body.arbeitsdienst_id).catch(() => null);
        if (ad?.push_erinnerung_id) {
          await stornierePush(ad.push_erinnerung_id);
          await S.Arbeitsdienst.update(ad.id, { push_erinnerung_id: "" }).catch(() => {});
        }
        return Response.json({ ok: true });
      }

      default:
        return Response.json({ error: "Unbekannte Aktion: " + aktion }, { status: 400 });
    }
  } catch (error) {
    console.error("sendNotification:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}