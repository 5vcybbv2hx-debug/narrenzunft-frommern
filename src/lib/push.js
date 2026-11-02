/**
 * Zentrales Push-Modul (OneSignal Web SDK v16).
 *
 * LEARNINGS aus der SAVO-App (bleiben verbindlich):
 *  1. OneSignal wird GENAU EINMAL initialisiert – hier, aufgerufen aus main.jsx.
 *     Kein zweiter init-Aufruf an irgendeiner anderen Stelle.
 *  2. init ist idempotent: "already initialized"-Fehler werden ignoriert,
 *     die Kette läuft IMMER weiter. Ein Push-Fehler darf nie etwas brechen.
 *  3. Login-Kette: verknuepfePushMitglied() wirft NIE (1 Retry nach 3 s).
 *  4. Sichtbares Feedback per Toast, nie nur console.error.
 *  5. Status-Zeile im Profil: Abo-Status, Notification.permission, external_id.
 */

import { toast } from 'sonner';
import { ONESIGNAL_APP_ID, PUSH_AKTIV } from '@/lib/pushConfig';
export { PUSH_AKTIV };

let initGestartet = false;

/**
 * Merkt sich, dass das Mitglied Push im Profil BEWUSST ausgeschaltet hat.
 * Ohne dieses Flag würde die Selbstheilung beim nächsten Login die
 * Subscription wieder aktivieren — das Ausschalten wäre wirkungslos.
 */
export const PUSH_AUS_KEY = 'nz_push_aus';

export function pushBewusstAus() {
  try { return localStorage.getItem(PUSH_AUS_KEY) === '1'; } catch { return false; }
}
let oneSignalReady = null; // Promise<OneSignal | null>

/** Entwicklung/Preview erkennen (dort läuft der Vite-Worker, Push ist aus). */
function istProduktion() {
  const host = window.location.hostname;
  return !['preview', 'sandbox', 'localhost', '127.0.0.1'].some(h => host.includes(h))
    && !window.location.pathname.includes('/editor/preview')
    && !window.location.search.includes('preview');
}

/**
 * Genau EINMAL aufrufen (main.jsx). Lädt das SDK, initialisiert OneSignal,
 * registriert den KOMBINIERTEN Root-Worker (OneSignal + Caching, ein Scope)
 * und verdrahtet den Push-Klick-Handler.
 */
export function initPush() {
  if (initGestartet) return; // Todsünde Nr. 2: zweites init
  initGestartet = true;

  if (!PUSH_AKTIV) {
    console.info('[Push] OneSignal App-ID nicht gesetzt – Push deaktiviert (kein Fehler).');
    return;
  }
  if (!istProduktion()) {
    console.info('[Push] Preview/Dev – Push bleibt aus, hier läuft der Vite-Worker.');
    return;
  }
  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] Kein ServiceWorker-Support.');
  }

  // SDK laden (OneSignal v16 Page-SDK)
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  const script = document.createElement('script');
  script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  script.defer = true;
  script.onerror = () => toast.error('Push fehlgeschlagen: OneSignal-SDK konnte nicht geladen werden');
  document.head.appendChild(script);

  // EIN kombiniertes Worker-File, EIN Root-Scope: OneSignal + App-Caching zusammen.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/OneSignalSDKWorker.js')
      .catch(e => console.warn('[Push] Worker-Registrierung fehlgeschlagen:', e));
  }

  oneSignalReady = new Promise((resolve) => {
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.init({ appId: ONESIGNAL_APP_ID });
        window.__NZ_OneSignal = OneSignal;
        console.info('[Push] OneSignal initialisiert.');
      } catch (e) {
        // Idempotent: bereits initialisiert ist KEIN Fehler – weiterlaufen lassen.
        if (!/already/i.test(String(e?.message || ''))) console.warn('[Push] OneSignal init:', e);
        window.__NZ_OneSignal = OneSignal;
      }
      // Push-Klick -> SPA-Navigation (Route liegt im data-Objekt des Pushs)
      try {
        OneSignal.Notifications?.addEventListener?.('click', (event) => {
          const route = event?.notification?.data?.route;
          if (route) window.dispatchEvent(new CustomEvent('nz-push-navigate', { detail: String(route) }));
        });
      } catch (e) { console.warn('[Push] Click-Listener:', e); }
      resolve(OneSignal);
    });
  });
}

/**
 * Verknüpft das eingeloggte Mitglied (Mitglied-Entity-ID = external_id).
 * Wird nach dem Login aufgerufen; wirft NIE, bricht die Login-Kette NIE.
 */
export async function verknuepfePushMitglied(mitgliedId) {
  if (!PUSH_AKTIV || !mitgliedId) return;
  const externalId = String(mitgliedId);
  try {
    const OneSignal = await oneSignalReady;
    if (!OneSignal) return;
    const login = async () => {
      await OneSignal.login(externalId);
      try { localStorage.setItem('nz_push_external_id', externalId); } catch { /* privat-Modus */ }
      // Selbstheilung: Erlaubnis erteilt, aber Token nie abgeschlossen
      // (typischer iOS-PWA-Zustand) -> Subscription nachziehen.
      // AUSSER das Mitglied hat Push im Profil bewusst ausgeschaltet.
      try {
        if (!pushBewusstAus()
          && OneSignal.Notifications?.permission === true
          && OneSignal.User?.PushSubscription?.optedIn !== true) {
          await OneSignal.User.PushSubscription.optIn();
        }
      } catch (e) { console.warn('[Push] Subscription-Nachzug:', e); }
    };
    try {
      await login();
      try {
        if (!sessionStorage.getItem('nz_push_ok_toast')) {
          sessionStorage.setItem('nz_push_ok_toast', '1');
          toast.success(`Push aktiv ✓ (ID: …${externalId.slice(-6)})`);
        }
      } catch { /* Toast-Fehler egal */ }
    } catch (e) {
      console.error('[Push] OneSignal login:', e);
      toast.error(`Push fehlgeschlagen: ${e?.message || 'unbekannter Fehler'} – retry in 3 s`);
      // Genau 1 Retry nach 3 Sekunden
      setTimeout(async () => {
        try {
          await login();
          toast.success(`Push aktiv ✓ (ID: …${externalId.slice(-6)})`);
        } catch (e2) {
          console.error('[Push] OneSignal login (Retry):', e2);
          toast.error(`Push fehlgeschlagen: ${e2?.message || 'unbekannter Fehler'}`);
        }
      }, 3000);
    }
  } catch (e) {
    // Nie nach außen werfen: Login-Kette hat Vorrang.
    console.warn('[Push] verknuepfePushMitglied:', e);
  }
}

/** Aktuellen Push-Status für die Profil-Diagnose-Zeile. */
export async function getPushStatus() {
  const status = {
    aktiv: PUSH_AKTIV,
    abonniert: false,
    erlaubnis: typeof Notification !== 'undefined' ? Notification.permission : 'unavailable',
    externalId: null,
    deaktiviert: pushBewusstAus(),
  };
  try { status.externalId = localStorage.getItem('nz_push_external_id') || null; } catch { /* egal */ }
  if (!PUSH_AKTIV) return status;
  const OneSignal = await oneSignalReady;
  if (!OneSignal) return status;
  try {
    // ECHTES Abonnement (Token vorhanden), nicht nur Erlaubnis — sonst zeigt
    // die Diagnose 'aktiv' obwohl iOS nie einen Token abgeschlossen hat.
    const echt = OneSignal.User?.PushSubscription?.optedIn;
    status.abonniert = echt === true || (echt === undefined && OneSignal.Notifications?.permission === true);
  } catch { /* egal */ }
  try { status.externalId = OneSignal.User?.externalId ? String(OneSignal.User.externalId) : status.externalId; } catch { /* egal */ }
  return status;
}

/**
 * Push-Erlaubnis aktiv einholen (Button "Benachrichtigungen aktivieren").
 *
 * WICHTIG (Lehre aus dem Fall "Annehmen geht nicht"): Der OneSignal-Slidedown
 * ist KEIN verlässlicher Weg. Er wird von iOS/Safari verschluckt und erscheint
 * nach einmaligem Wegtippen für dieses Gerät nie wieder — der Klick läuft dann
 * ins Leere, ohne dass irgendetwas passiert. Deshalb:
 *   1. direkte Browser-Erlaubnis über Notification.requestPermission(),
 *   2. danach Subscription aktiv nachziehen (optIn),
 *   3. Slidedown nur noch als harmloser Zusatz-Fallback.
 * Rückgabe sagt der UI, was passiert ist (ok / blockiert / kein SDK).
 */
export async function fragePushAb() {
  const ergebnis = {
    ok: false,
    erlaubnis: typeof Notification !== 'undefined' ? Notification.permission : 'unavailable',
    grund: null,
  };
  if (!PUSH_AKTIV) { ergebnis.grund = 'inaktiv'; return ergebnis; }

  // 1) Echte Browser-Erlaubnis — funktioniert im Klick-Kontext auf iOS-PWA,
  //    Android und Desktop. 'denied' kann der Browser nicht mehr nachfragen.
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) { console.warn('[Push] requestPermission:', e); }
  }
  ergebnis.erlaubnis = typeof Notification !== 'undefined' ? Notification.permission : 'unavailable';

  const OneSignal = await oneSignalReady;
  if (!OneSignal) { ergebnis.grund = 'sdk'; return ergebnis; }

  // 2) Erlaubnis da -> Subscription wirklich abschließen. Ohne diesen Schritt
  //    bleibt der Zustand "erlaubt, aber kein Token" (typisch iOS).
  if (ergebnis.erlaubnis === 'granted') {
    try { await OneSignal.Notifications?.requestPermission?.(); } catch (e) { console.warn('[Push] OS requestPermission:', e); }
    try { await OneSignal.User?.PushSubscription?.optIn?.(); } catch (e) { console.warn('[Push] optIn:', e); }
    ergebnis.ok = true;
    return ergebnis;
  }

  // 3) Immer noch 'default' (Prompt verschluckt) -> Slidedown als Zusatz,
  //    danach Status erneut lesen.
  if (ergebnis.erlaubnis === 'default') {
    try { await OneSignal.Slidedown.promptPush(); } catch (e) { console.warn('[Push] promptPush:', e); }
    try { await OneSignal.Notifications?.requestPermission?.(); } catch (e) { console.warn('[Push] OS requestPermission:', e); }
    ergebnis.erlaubnis = typeof Notification !== 'undefined' ? Notification.permission : 'unavailable';
    if (ergebnis.erlaubnis === 'granted') {
      try { await OneSignal.User?.PushSubscription?.optIn?.(); } catch (e) { console.warn('[Push] optIn:', e); }
      ergebnis.ok = true;
    } else {
      ergebnis.grund = 'nicht_bestaetigt';
    }
    return ergebnis;
  }

  ergebnis.grund = 'blockiert';
  return ergebnis;
}

/**
 * Push im Profil ein- oder ausschalten.
 *
 * Aus = abbestellen (optOut), Erlaubnis bleibt erhalten: das Mitglied kann
 * später ohne neue Systemabfrage wieder einschalten. Das Flag PUSH_AUS_KEY
 * verhindert, dass der Login die Subscription heimlich wieder aktiviert.
 */
export async function setzePushAbo(an) {
  const ergebnis = { ok: false, abonniert: false, deaktiviert: false, erlaubnis:
    typeof Notification !== 'undefined' ? Notification.permission : 'unavailable', grund: null };
  if (!PUSH_AKTIV) { ergebnis.grund = 'inaktiv'; return ergebnis; }

  if (an) {
    const r = await fragePushAb();
    if (r.ok) {
      try { localStorage.removeItem(PUSH_AUS_KEY); } catch { /* egal */ }
      ergebnis.ok = true;
    } else {
      ergebnis.grund = r.grund;
    }
    const status = await getPushStatus();
    ergebnis.abonniert = status.abonniert;
    ergebnis.deaktiviert = pushBewusstAus();
    ergebnis.erlaubnis = status.erlaubnis;
    ergebnis.ok = ergebnis.ok || status.abonniert;
    return ergebnis;
  }

  // Ausschalten: abbestellen, Entscheidung merken. Fehler dürfen nicht
  // verschluckt werden — sonst denkt das Mitglied, es sei aus.
  try {
    const OneSignal = await oneSignalReady;
    if (OneSignal?.User?.PushSubscription?.optOut) {
      await OneSignal.User.PushSubscription.optOut();
    }
  } catch (e) {
    console.warn('[Push] optOut:', e);
    ergebnis.grund = 'optout_fehlgeschlagen';
  }
  try { localStorage.setItem(PUSH_AUS_KEY, '1'); } catch { /* egal */ }
  const status = await getPushStatus();
  ergebnis.abonniert = status.abonniert;
  ergebnis.deaktiviert = true;
  ergebnis.erlaubnis = status.erlaubnis;
  // ok nur, wenn wirklich kein Abo mehr besteht
  ergebnis.ok = status.abonniert === false;
  if (!ergebnis.ok) ergebnis.grund = 'optout_fehlgeschlagen';
  return ergebnis;
}

/** Plattform-Hinweis, wie man eine blockierte Erlaubnis wieder freischaltet. */
export function pushHinweisBlockiert() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) {
    return 'iPhone-Einstellungen → Benachrichtigungen → Narrenzunft App → "Zulassen" aktivieren (iOS fragt nur einmal).';
  }
  if (/Android/i.test(ua)) {
    return 'Chrome → Schloss-Symbol neben der Adresse → Benachrichtigungen → "Zulassen", dann Seite neu laden.';
  }
  return 'Im Browser auf das Schloss links neben der Adresse klicken → Benachrichtigungen → "Zulassen", dann Seite neu laden.';
}