/**
 * Caching-Logik des kombinierten Workers (/OneSignalSDKWorker.js lädt diese Datei).
 *
 * Strategie:
 *  - HTML/Navigation = Network-First (Cache nur als Offline-Fallback)
 *  - JS/CSS mit Hash-Namen (/assets/*) = Cache-First (immutable)
 *  - API-Calls und fremde Origins = nie anfassen (immer Network)
 *
 * CACHE_NAME bei jeder Worker-Änderung hochzählen (v1 -> v2 -> ...),
 * der activate-Handler räumt alte Caches automatisch weg.
 */
const CACHE_NAME = 'nz-cache-v1';
const HASHED_ASSET = /\/assets\/.+$/;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // OneSignal-CDN & co: Network
  if (url.pathname.startsWith('/api/')) return;    // API nie cachen

  const istNavigation = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html');
  const istHashAsset = HASHED_ASSET.test(url.pathname);

  if (istNavigation) {
    // Network-First: frisches HTML, Offline-Fallback aus dem Cache
    event.respondWith(
      fetch(req)
        .then((res) => {
          const kopie = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, kopie)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('/')))
    );
    return;
  }

  if (istHashAsset) {
    // Cache-First: Hash-Namen sind unveränderlich
    event.respondWith(
      caches.match(req).then((m) => m || fetch(req).then((res) => {
        const kopie = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, kopie)).catch(() => {});
        return res;
      }))
    );
  }
  // alles andere: kein Worker-Eingriff (normaler Browser-Cache)
});

/**
 * Push-Klick -> App mit Route öffnen/fokussieren.
 * Die Route wird im data-Objekt des Pushs mitgeschickt ({ route: '/...' }).
 */
self.addEventListener('notificationclick', (event) => {
  const route = (event.notification && event.notification.data && event.notification.data.route) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
      for (const client of liste) {
        if ('focus' in client) {
          try { client.postMessage({ nzPushRoute: route }); } catch (e) { /* egal */ }
          return client.focus();
        }
      }
      return self.clients.openWindow(route);
    })
  );
});
