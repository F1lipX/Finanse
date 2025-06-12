const CACHE_NAME = 'finance-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.png'
];

// Instalacja — caching plików statycznych
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Aktywacja — czyszczenie starych cache'y
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
});

// Fetch — obsługa offline
self.addEventListener('fetch', event => {
  const { request } = event;

  // Tylko GET
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      return (
        cachedResponse ||
        fetch(request).catch(() => {
          if (request.destination === 'document') {
            return caches.match('/index.html'); // fallback do strony
          }
        })
      );
    })
  );
});
