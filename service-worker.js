// service-worker.js

const CACHE_NAME = 'trading-journal-cache-v3'; // Bump version to force update
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  // App shell and crucial assets
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.1.5/dist/purify.min.js',
  // CDN modules from importmap
  'https://aistudiocdn.com/react@^19.1.1',
  'https://aistudiocdn.com/react-dom@^19.1.1/',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.44.4/+esm',
  'https://aistudiocdn.com/idb@^8.0.3',
  'https://aistudiocdn.com/@google/genai@^1.21.0'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Activate new worker immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // For navigation requests, use a network-first strategy.
  // If network fails, serve the cached index.html. This allows the SPA to handle routing.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For all other requests (CSS, JS, images from CDN), use a cache-first strategy
  // to make the app load super fast.
  event.respondWith(
    caches.match(request).then(response => {
      return response || fetch(request).then(fetchResponse => {
        // Optionally, cache new requests on the fly
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(request, fetchResponse.clone());
          return fetchResponse;
        });
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
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients
  );
});