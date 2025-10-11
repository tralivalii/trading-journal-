// service-worker.js

const CACHE_NAME = 'trading-journal-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // Note: We don't cache index.tsx directly, but the bundled output if there was one.
  // Since we use import maps, we cache the CDN URLs.
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.1.5/dist/purify.min.js',
  'https://aistudiocdn.com/react@^19.1.1',
  'https://aistudiocdn.com/react-dom@^19.1.1/',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.44.4/+esm'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Use a "Network First, falling back to Cache" strategy for most requests
  // This ensures users get the latest data when online, but can still use the app offline.
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          // If a specific request isn't in cache, you might want a generic fallback page
          // For a single-page app, returning the main index.html often works well.
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
