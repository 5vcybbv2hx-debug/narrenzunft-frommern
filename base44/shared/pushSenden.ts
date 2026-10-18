/**
 * Zentraler OneSignal-Versand – NUR diese Datei spricht die OneSignal-API an.
 * Alle Features rufen ausschließlich sendePush/stornierePush auf, niemals
 * eigene OneSignal-Fetches (SAVO-Regel).
 *
 * Die App-ID ist öffentlich (Frontend + hier), der REST-API-Key liegt als
 * Secret ONESIGNAL_API_KEY in den App-Settings (nie im Code).
 */

export const ONESIGNAL_APP_ID = ""; // TODO: gleiche App-ID wie src/lib/pushConfig.js eintragen
const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";

function holeApiKey() {
  const env = (typeof process !== "undefined" && process?.env) || (globalThis.Deno && Deno.env) || {};
  try { return env.ONESIGNAL_API_KEY || ""; } catch (e) { return ""; }
}

/**
 * Sendet Push an Mitglied-Entity-IDs (= external_id via OneSignal.login).
 * invalid_aliases sind KEIN Fehler: dieses Mitglied hat sein Gerät noch nicht
 * registriert. Wir prüfen nur, dass mind. 1 Alias gültig ist.
 *
 * @param {string[]} mitgliedIds
 * @param {string} titel
 * @param {string} nachricht
 * @param {object} data  z.B. { route: "/kalender" }
 * @param {string|null} sendAfter  OneSignal-Zeitstempel für geplante Sends
 */
export async function sendePush(mitgliedIds, titel, nachricht, data = {}, sendAfter = null) {
  const ids = [...new Set((mitgliedIds || []).map(String).filter(Boolean))];
  if (!ONESIGNAL_APP_ID) return { erfolg: false, grund: "OneSignal App-ID nicht konfiguriert", invalid: [] };
  const key = holeApiKey();
  if (!key) return { erfolg: false, grund: "Secret ONESIGNAL_API_KEY fehlt in den App-Settings", invalid: [] };
  if (!ids.length) return { erfolg: false, grund: "Keine Empfänger", invalid: [] };

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    include_aliases: { external_id: ids },
    target_channels: ["push"],
    headings: { en: String(titel || "Narrenzunft Frommern") },
    contents: { en: String(nachricht || "") },
    data: data || {},
  };
  if (sendAfter) payload.send_after = sendAfter;

  const res = await fetch(ONESIGNAL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + key },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      erfolg: false,
      grund: (json?.errors && (Array.isArray(json.errors) ? json.errors[0] : JSON.stringify(json.errors))) || ("HTTP " + res.status),
      invalid: [],
    };
  }
  // invalid aliases: Information, kein Codefehler (Gerät noch nicht registriert)
  const invalid = [];
  const errs = json?.errors || {};
  if (Array.isArray(errs)) {
    for (const e of errs) {
      const m = String(typeof e === "string" ? e : JSON.stringify(e)).match(/external_id[^\]]*:\s*\[(.*?)\]/i);
      if (m) invalid.push(...m[1].split(",").map((x) => x.trim().replace(/["']/g, "")).filter(Boolean));
    }
  } else if (errs?.invalid_external_ids) {
    invalid.push(...errs.invalid_external_ids);
  }
  const erreicht = Number(json?.recipients || 0);
  if (erreicht < 1 && !invalid.length) {
    return { erfolg: false, grund: "Kein Empfänger erreicht (Geräte evtl. noch nicht registriert)", invalid, notification_id: json?.id || "" };
  }
  return { erfolg: true, erreicht, invalid, notification_id: json?.id || "" };
}

/** Plant/Ersetzt eine geplante Notification (Notification-ID merken, um zu stornieren). */
export async function planePush(mitgliedIds, titel, nachricht, data, sendAfter) {
  return sendePush(mitgliedIds, titel, nachricht, data, sendAfter);
}

/** Storniert eine geplante OneSignal-Notification (z.B. Dienst gelöscht/geändert). */
export async function stornierePush(notificationId) {
  if (!notificationId || !ONESIGNAL_APP_ID) return { erfolg: false };
  const key = holeApiKey();
  if (!key) return { erfolg: false };
  try {
    const res = await fetch(`${ONESIGNAL_API_URL}/${notificationId}?app_id=${ONESIGNAL_APP_ID}&cancelled=true`, {
      method: "DELETE",
      headers: { Authorization: "Basic " + key },
    });
    return { erfolg: res.ok };
  } catch (e) {
    console.warn("stornierePush:", e);
    return { erfolg: false };
  }
}

/** Aktive Ausschuss-Mitglied-IDs (AusschussMitglied.aktiv + Verwaltungsrollen). */
export async function holeAusschussIds(S) {
  const ids = new Set();
  try {
    const am = await S.AusschussMitglied.filter({ aktiv: true });
    (am || []).forEach((x) => { if (x.mitglied_id) ids.add(String(x.mitglied_id)); });
  } catch (e) { console.warn("AusschussMitglied:", e); }
  try {
    const alle = await S.Mitglied.list("-created_date", 1000);
    (alle || []).forEach((m) => {
      if (m.app_rolle && ["admin", "vorstand", "stellv_vorstand"].includes(m.app_rolle)) ids.add(String(m.id));
    });
  } catch (e) { console.warn("Mitglied.list:", e); }
  return [...ids];
}

/** Nur Mitglieder mit App-Konto können Push überhaupt empfangen. */
export async function holeIdsMitAppKonto(S, ids) {
  if (!ids?.length) return [];
  try {
    const alle = await S.Mitglied.list("-created_date", 1000);
    const mitKonto = new Set((alle || []).filter((m) => m.user_id).map((m) => String(m.id)));
    return ids.map(String).filter((id) => mitKonto.has(id));
  } catch (e) {
    return ids; // im Zweifel senden: ungültige Aliasse sind nur Information
  }
}
