/**
 * OneSignal-Konfiguration. Die App-ID ist PUBLIC (sie gehört ins Frontend),
 * der REST-API-Key liegt als Secret ONESIGNAL_API_KEY in den App-Settings
 * und kommt NIE in den Frontend-Code.
 *
 * Bis die App-ID hier eingetragen ist, ist Push sauber deaktiviert
 * (alle Push-Funktionen laufen dann als No-Op, nichts bricht).
 */
export const ONESIGNAL_APP_ID = ''; // TODO: OneSignal-App-ID des EIGENEN Projekts eintragen

export const PUSH_AKTIV = ONESIGNAL_APP_ID !== '';
