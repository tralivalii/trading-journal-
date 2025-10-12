// service-worker.js

const CACHE_NAME = 'trading-journal-cache-v4'; // Bump version to force update
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
        // Use addAll with a catch to prevent installation failure if one resource fails
        return cache.addAll(urlsToCache).catch(err => {
          console.error('Failed to cache initial assets:', err);
        });
      })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // For navigation requests, use a Cache First strategy.
  // This ensures the app shell loads instantly when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          // If we have a cached response, return it.
          if (cachedResponse) {
            return cachedResponse;
          }
          // Otherwise, try to fetch from the network.
          return fetch(request).catch(() => {
            // If the network fails (offline), return the cached index.html as a fallback.
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // For all other requests (assets, API calls), use a Network First strategy.
  // This keeps data fresh while providing an offline fallback for assets.
  event.respondWith(
    fetch(request)
      .then(networkResponse => {
        // If the fetch is successful, clone the response and cache it.
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        // If the network request fails, try to serve from the cache.
        return caches.match(request).then(cachedResponse => {
          return cachedResponse; // This will be undefined if not in cache, resulting in a standard network error.
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