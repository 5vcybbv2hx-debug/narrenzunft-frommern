/**
 * KOMBINIERTER Root-Worker: OneSignal + App-Caching.
 *
 * SAVO-Learning: Zwei Root-Scope-Worker bekämpfen sich – einer wirft den
 * anderen raus, sämtliche Push-Anmeldungen sterben ohne Fehlermeldung.
 * Lösung: EIN Worker, EIN Scope. OneSignal-Worker importiert die
 * Caching-Logik per importScripts dazu.
 */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); // korrekte v16-SW-URL (page.sw.js liefert 404 und toetet die Worker-Installation)
importScripts('/cache-worker.js');
