// Renovation Expense Tracker - Service Worker
// Strategy: app-shell precache + stale-while-revalidate for assets + network-first for API GETs.
// Bump SW_VERSION on each release to invalidate stale caches.

const SW_VERSION = 'v3';
const STATIC_CACHE = `reno-static-${SW_VERSION}`;
const RUNTIME_CACHE = `reno-runtime-${SW_VERSION}`;
const API_CACHE = `reno-api-${SW_VERSION}`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon-32.png',
  '/favicon-64.png',
  '/apple-touch-icon.png',
  '/pwa-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Use Promise.allSettled so a single 404 won't fail install
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET; let everything else (POST/PATCH/DELETE) go to network untouched.
  if (request.method !== 'GET') return;

  // /api/* GET — network-first with cache fallback.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // SPA navigation — fall back to cached index.html offline.
  if (request.mode === 'navigate') {
    event.respondWith(navigationFallback(request));
    return;
  }

  // Same-origin static assets — stale-while-revalidate (instant from cache, refresh in background).
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Cross-origin assets (e.g., Azure Blob photos w/ SAS) — cache-first long-term.
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }
});

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await fetchPromise) || new Response('Offline', { status: 503 });
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function navigationFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const fallback = (await cache.match('/index.html')) || (await cache.match('/'));
    if (fallback) return fallback;
    return new Response('Offline', { status: 503 });
  }
}

// Listen for skipWaiting message from the page (used to trigger update without manual reload)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ---------------- Push notifications ----------------

self.addEventListener('push', (event) => {
  let data = { title: 'RenoTrack', body: '', url: '/', tag: 'reno', icon: '/pwa-192.png', badge: '/pwa-192.png' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }
  const promise = self.registration.showNotification(data.title, {
    body: data.body,
    tag: data.tag,
    icon: data.icon,
    badge: data.badge,
    data: { url: data.url },
  });
  event.waitUntil(promise);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // If an app window is already open, focus it and navigate.
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // ignore — cross-origin or unsupported
            }
          }
          return;
        }
      }
      // Otherwise open a new window.
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
    })()
  );
});
