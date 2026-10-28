// Service Worker for Progressive Web App
//
// Strategy summary:
//   - Cross-origin requests (Supabase API/functions, analytics, fonts, CDNs)
//     are never intercepted; the browser and HTTP cache handle them.
//   - HTML navigations: network-first, cached shell only when offline.
//   - /assets/*: build-hashed and immutable, so cache-first with no
//     background revalidation.
//   - Other same-origin GETs (icons, manifest, public images): stale-while-
//     revalidate in a runtime cache capped at RUNTIME_MAX_ENTRIES.

const CACHE_VERSION = 'v9';
const CACHE_PREFIX = 'pearson-portfolio-';
// Shell cache: precached app shell plus the latest index.html.
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
// Immutable hashed build assets.
const ASSET_CACHE = `${CACHE_PREFIX}assets-${CACHE_VERSION}`;
// Everything else same-origin.
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${CACHE_VERSION}`;
const CURRENT_CACHES = [CACHE_NAME, ASSET_CACHE, RUNTIME_CACHE];

// Hashed filenames accumulate across deploys within one CACHE_VERSION, so the
// asset cache is bounded too, just more generously.
const ASSET_MAX_ENTRIES = 200;
const RUNTIME_MAX_ENTRIES = 60;

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      // Activate this worker as soon as it has finished installing. Because
      // navigations are network-first (see handleNavigation) an immediate
      // takeover cannot pin clients to an old index.html, and it lets a fixed
      // worker self-heal already-open tabs.
      .then(() => self.skipWaiting())
  );
});

// Activate event - delete every cache of ours that this version doesn't use
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(async (cacheNames) => {
        const oldCaches = cacheNames.filter(
          (name) => name.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(name)
        );
        await Promise.all(
          oldCaches.map((name) => {
            console.log('[ServiceWorker] Deleting old cache:', name);
            return caches.delete(name);
          })
        );
        // Take control of open clients so the new routing applies without a
        // second reload.
        await self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Only handle our own origin. This covers chrome-extension:, analytics,
  // fonts, and the Supabase API/functions hosts: API responses must never be
  // served stale from a service worker cache.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigations (the HTML document) MUST be network-first. Serving a stale
  // cached index.html is what caused blank pages: the old shell referenced
  // hashed assets (index-<hash>.js/.css) that no longer exist after a deploy,
  // and Cloudflare Pages answers those missing asset URLs with index.html
  // (text/html) via the SPA fallback -> MIME-type errors -> nothing renders.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(assetCacheFirst(request, url));
    return;
  }

  // Same-origin API routes (if any) are never cached.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

// True for build-hashed assets whose content type is known and fixed. If the
// network returns HTML for one of these, the asset is gone (stale deployment)
// and Pages served the SPA fallback instead - never cache or return that.
function isHashedAsset(url) {
  return url.pathname.startsWith('/assets/') &&
    /\.(js|mjs|css)$/.test(url.pathname);
}

function looksLikeHtml(response) {
  const type = response.headers.get('Content-Type') || '';
  return type.includes('text/html');
}

// Drop the oldest entries (Cache keys come back in insertion order) once a
// cache grows past maxEntries.
async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const excess = keys.length - maxEntries;
    if (excess > 0) {
      await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
    }
  } catch (e) {
    /* ignore */
  }
}

async function putAndTrim(cacheName, maxEntries, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
    await trimCache(cacheName, maxEntries);
  } catch (e) {
    /* quota or opaque-response errors are not fatal */
  }
}

// A hashed asset resolved to HTML (or a hard 404): treat as a stale chunk.
// Drop any poisoned cache entry, ask open clients to recover, and return a
// clean 503 so the module/stylesheet loader fails fast instead of choking on
// an HTML body with the wrong MIME type.
async function staleChunkResponse(request, url) {
  try {
    const cache = await caches.open(ASSET_CACHE);
    await cache.delete(request);
  } catch (e) {
    /* ignore */
  }
  notifyClientsToRefresh(url.pathname);
  return new Response(
    JSON.stringify({
      error: 'CHUNK_LOAD_FAILED',
      message: 'Application update required. Please refresh the page.',
      asset: url.pathname,
    }),
    {
      status: 503,
      statusText: 'Service Unavailable - Refresh Required',
      headers: new Headers({
        'Content-Type': 'application/json',
        'X-SW-Stale-Chunk': 'true',
      }),
    }
  );
}

// Network-first handler for HTML navigations. Falls back to the cached shell
// only when the network is unreachable (genuine offline).
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Keep the latest shell for offline use.
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[ServiceWorker] Navigation offline, serving cached shell');
    const cached =
      (await cache.match('/index.html')) || (await cache.match('/'));
    return cached || offlineFallback(request);
  }
}

// Cache-first for /assets/*. Filenames carry a content hash, so a cached copy
// is always correct and there is nothing to revalidate.
async function assetCacheFirst(request, url) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);

  // Defend against a poisoned entry: an older worker may have cached an HTML
  // SPA-fallback body under a hashed asset URL. Never serve that.
  if (cached && !(isHashedAsset(url) && looksLikeHtml(cached))) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (isHashedAsset(url) && (looksLikeHtml(response) || response.status === 404)) {
      return staleChunkResponse(request, url);
    }

    if (response.ok) {
      putAndTrim(ASSET_CACHE, ASSET_MAX_ENTRIES, request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[ServiceWorker] Asset fetch failed:', error);
    return offlineFallback(request);
  }
}

// Stale-while-revalidate for non-asset same-origin GETs, bounded by
// RUNTIME_MAX_ENTRIES.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        putAndTrim(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES, request, response.clone());
      } else if (response.status === 404) {
        cache.delete(request);
      }
      return response;
    });

  if (cached) {
    network.catch(() => { /* already served from cache */ });
    return cached;
  }

  try {
    return await network;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed (no cache):', error);
    return offlineFallback(request);
  }
}

// Notify all clients to refresh due to stale assets
async function notifyClientsToRefresh(assetPath = '') {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => {
    client.postMessage({
      type: 'STALE_ASSETS_DETECTED',
      message: 'New version available. Please refresh the page.',
      asset: assetPath,
      timestamp: Date.now(),
    });
  });
  
  // Log for debugging
  console.warn('[ServiceWorker] Notified', clients.length, 'clients about stale assets');
}

// Offline fallback - return offline page
function offlineFallback(request) {
  const url = new URL(request.url);

  // Return offline page for navigation requests
  if (request.mode === 'navigate') {
    return new Response(
      `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Offline - Dan Pearson</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: #0a0f1e;
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .container {
              text-align: center;
              max-width: 500px;
            }
            h1 {
              font-size: 2.5rem;
              margin-bottom: 1rem;
              background: linear-gradient(135deg, #00b4d8 0%, #0077b6 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              font-size: 1.1rem;
              color: #94a3b8;
              margin-bottom: 2rem;
            }
            button {
              background: #00b4d8;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              font-size: 1rem;
              cursor: pointer;
              transition: all 0.2s;
            }
            button:hover {
              background: #0077b6;
              transform: translateY(-2px);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>You're Offline</h1>
            <p>It looks like you've lost your internet connection. Some content may not be available until you're back online.</p>
            <button onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
      </html>`,
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        }),
      }
    );
  }

  // For other requests, return a simple 503 response
  return new Response('Service Unavailable', {
    status: 503,
    statusText: 'Service Unavailable',
  });
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls;
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urls))
      .then(() => {
        console.log('[ServiceWorker] URLs cached:', urls);
      });
  }
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);

  if (event.tag === 'sync-forms') {
    event.waitUntil(syncForms());
  }
});

// Sync form submissions when back online
async function syncForms() {
  // Implementation for syncing forms stored in IndexedDB
  // This would sync contact forms, newsletter signups, etc.
  console.log('[ServiceWorker] Syncing forms...');
}

// Push notification handling
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New content available',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    vibrate: [200, 100, 200],
    tag: 'pearson-notification',
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification('Dan Pearson Portfolio', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

console.log('[ServiceWorker] Loaded successfully');
