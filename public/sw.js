self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Pass-through fetch event to satisfy PWA requirements
});
