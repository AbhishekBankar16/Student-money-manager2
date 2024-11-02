// Cache versioning
const cacheName = 'moneyManagerCache-v1';

// Assets to cache
const assetsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/icon.png',
  '/manifest.json',
  // Add other assets as needed
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) => {
      console.log('Caching app shell');
      return cache.addAll(assetsToCache).catch((error) => {
        console.error('Error caching app shell:', error);
      });
    })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== cacheName) {
            console.log('Removing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return the cached response if available, otherwise fetch from the network
      return response || fetch(event.request).then((fetchResponse) => {
        console.log('Fetched response:', fetchResponse);
        return caches.open(cacheName).then((cache) => {
          // Cache the fetched response
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    })
  );
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('Error occurred:', event);
});

// Debugging
self.addEventListener('fetch', (event) => {
  console.log('Fetch event:', event);
});

// Testing
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) => {
      console.log('Caching app shell');
      return cache.addAll(assetsToCache).then(() => {
        self.skipWaiting();
      });
    })
  );
});