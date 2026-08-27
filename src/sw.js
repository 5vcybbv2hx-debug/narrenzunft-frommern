// Service worker for the preview/dev environment only.
// Bypasses the CDN cache for Vite-related requests to prevent stale dep chunks
// from creating duplicate React instances ("dispatcher.useState is null").
//
// The CDN sends Cache-Control: max-age=31536000, immutable for /node_modules/.vite/deps/*
// which causes the browser to cache chunks from multiple optimization passes.
// This SW intercepts those requests and always fetches from the network.
//
// SW_VERSION: bump to force the browser to install a new SW and clear all caches.
const SW_VERSION = 'v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Bypass cache for all Vite-related JS/CSS to prevent stale chunks
  if (
    url.pathname.includes('/node_modules/.vite/') ||
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@react-refresh/') ||
    url.pathname.startsWith('/src/')
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => fetch(event.request))
    );
  }
});