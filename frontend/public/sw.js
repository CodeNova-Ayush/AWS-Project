/**
 * MergeDeck PWA Service Worker
 * Provides offline resilience, smart asset caching, and fast loading.
 */

const CACHE_NAME = 'mergedeck-pwa-v5';

const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.png',
];

// 1. Install event: Pre-cache app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pre-caching error (non-fatal):', err);
        return self.skipWaiting();
      })
  );
});

// 2. Activate event: Clean up old cache versions & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch event: Stale-while-revalidate for static assets, network-first for navigation, network-only for APIs
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle standard HTTP/HTTPS requests
  if (!url.protocol.startsWith('http')) return;

  // Never cache API calls, OAuth callbacks, or live backend endpoints
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/auth-callback') ||
    url.pathname === '/health' ||
    url.pathname === '/docs' ||
    url.pathname === '/openapi.json'
  ) {
    return;
  }

  // A. Navigation requests (HTML pages) -> Network-first with offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Attempt to load from cache
          const cached = await caches.match(request);
          if (cached) return cached;

          // If offline and not in cache, fallback to offline UI
          const offlineFallback = await caches.match('/offline.html');
          if (offlineFallback) return offlineFallback;

          return new Response('You are offline. Please reconnect to access MergeDeck.', {
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // B. Static assets (Expo bundles, scripts, stylesheets, fonts, images) -> Cache-first with stale-while-revalidate
  const isStaticAsset =
    url.pathname.startsWith('/_expo/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(js|css|png|jpg|jpeg|svg|woff|woff2|ttf|ico)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // C. Default: Network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Allow client pages to trigger immediate SW update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
