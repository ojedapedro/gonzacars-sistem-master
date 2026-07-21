// Service Worker — Gonzacars Sistema
// Strategy: Network-first pass-through (no caching)
// This SW satisfies PWA requirements without interfering with Firebase or any fetch call.

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Take control of all open tabs immediately
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // CRITICAL: always call respondWith() explicitly.
  // An empty fetch handler causes "message channel closed" errors and
  // can silently drop requests to Firebase, Google APIs, etc.
  e.respondWith(fetch(e.request));
});
