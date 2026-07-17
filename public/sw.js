// Service Worker for Progressive Web App
// Version 1.0.0

const CACHE_VERSION = 'v8';
const CACHE_NAME = `pearson-portfolio-${CACHE_VERSION}`;

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
};

// Routes and their cache strategies
// IMPORTANT: JS assets use NETWORK_FIRST to handle deployment updates properly
// When new deployments happen, chunk hashes change, so we need fresh index.html
const ROUTE_STRATEGIES = {
  '/assets/index-': CACHE_STRATEGIES.NETWORK_FIRST, // Main JS bundle - always check network
  '/assets/': CACHE_STRATEGIES.STALE_WHILE_REVALIDATE, // Other assets - serve cached but revalidate
  '/api/': CACHE_STRATEGIES.NETWORK_FIRST, // API calls
};

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install event');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      // Activate this worker as soon as it has finished installing. Previous
      // versions deliberately waited, but that let a broken/stale worker keep
      // control indefinitely. Because navigations are now network-first (see
      // handleNavigation) an immediate takeover cannot pin clients to an old
      // index.html, and it lets a fixed worker self-heal already-open tabs.
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate event');

  event.waitUntil(
    caches.keys()
      .then(async (cacheNames) => {
        const oldCaches = cacheNames.filter((cacheName) => {
          // Delete old cache versions
          return cacheName.startsWith('pearson-portfolio-') && cacheName !== CACHE_NAME;
        });
        
        // Delete old caches
        await Promise.all(
          oldCaches.map((cacheName) => {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
        
        // Take control of all open clients immediately so the corrected
        // worker (and its network-first navigation handling) applies without
        // requiring a second manual reload.
        await self.clients.claim();
        console.log('[ServiceWorker] Activated and claimed clients.');
      })
  );
});

// External domains that should NOT be handled by the service worker
// These are third-party resources that have their own caching strategies
const EXTERNAL_DOMAINS = [
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'doubleclick.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cloudflareinsights.com',
  'cdn.jsdelivr.net',
];

// Check if URL is from an external domain we shouldn't handle
function isExternalDomain(hostname) {
  return EXTERNAL_DOMAINS.some(domain => hostname.includes(domain));
}

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip external third-party domains - let browser handle them directly
  // This prevents CSP issues and respects third-party caching
  if (isExternalDomain(url.hostname)) {
    return;
  }

  // Navigations (the HTML document) MUST be network-first. Serving a stale
  // cached index.html is what caused blank pages: the old shell referenced
  // hashed assets (index-<hash>.js/.css) that no longer exist after a deploy,
  // and Cloudflare Pages answers those missing asset URLs with index.html
  // (text/html) via the SPA fallback -> MIME-type errors -> nothing renders.
  // A fresh document always references the current asset hashes.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Determine cache strategy based on URL
  const strategy = getStrategyForUrl(url.pathname);

  event.respondWith(
    handleFetch(request, strategy)
  );
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

// A hashed asset resolved to HTML (or a hard 404/503): treat as a stale chunk.
// Drop any poisoned cache entry, ask open clients to recover, and return a
// clean 503 so the module/stylesheet loader fails fast instead of choking on
// an HTML body with the wrong MIME type.
async function staleChunkResponse(request, url) {
  try {
    const cache = await caches.open(CACHE_NAME);
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

// Get cache strategy for a given URL
function getStrategyForUrl(pathname) {
  for (const [route, strategy] of Object.entries(ROUTE_STRATEGIES)) {
    if (pathname.includes(route)) {
      return strategy;
    }
  }

  // Default: stale-while-revalidate for pages
  return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
}

// Handle fetch with appropriate strategy
async function handleFetch(request, strategy) {
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      return cacheFirst(request);

    case CACHE_STRATEGIES.NETWORK_FIRST:
      return networkFirst(request);

    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
    default:
      return staleWhileRevalidate(request);
  }
}

// Cache First strategy - serve from cache, fallback to network
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    return offlineFallback(request);
  }
}

// Network First strategy - try network, fallback to cache
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);

  try {
    const response = await fetch(request);

    // A hashed asset that came back as HTML means the SPA fallback fired for a
    // file that no longer exists (stale deployment). Recover instead of caching
    // an HTML body under a .js/.css URL.
    if (isHashedAsset(url) && (looksLikeHtml(response) || response.status === 404)) {
      return staleChunkResponse(request, url);
    }

    // Cache successful responses
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[ServiceWorker] Network failed, using cache:', error);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    return offlineFallback(request);
  }
}

// Stale While Revalidate strategy - serve cache immediately, update in background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const url = new URL(request.url);

  // Defend against a poisoned entry: a previous worker version may have cached
  // an HTML SPA-fallback body under a hashed asset URL. Never serve that.
  if (cached && isHashedAsset(url) && looksLikeHtml(cached)) {
    await cache.delete(request);
    return staleChunkResponse(request, url);
  }

  // If we have a cached version, return it immediately
  // and update the cache in the background (fire and forget)
  if (cached) {
    // Update cache in background - don't await
    fetch(request)
      .then((response) => {
        // Stale chunk: asset gone (HTML fallback) or a hard 404/503.
        if (isHashedAsset(url) && (looksLikeHtml(response) || response.status === 404)) {
          console.warn('[ServiceWorker] Stale asset detected, removing from cache:', url.pathname);
          cache.delete(request);
        } else if (response.ok) {
          cache.put(request, response.clone());
        } else if (response.status === 404 || response.status === 503) {
          // Stale chunk detected - remove from cache
          // This happens when a new deployment has different chunk hashes
          console.warn('[ServiceWorker] Stale asset detected, removing from cache:', url.pathname);
          cache.delete(request);
        }
      })
      .catch((error) => {
        // Silent failure for background updates - we already returned cached version
        console.debug('[ServiceWorker] Background revalidation failed:', error.message);
      });

    return cached;
  }

  // No cached version - must wait for network
  try {
    const response = await fetch(request);

    // A hashed asset that resolves to HTML is a stale deployment - recover.
    if (isHashedAsset(url) && (looksLikeHtml(response) || response.status === 404)) {
      return staleChunkResponse(request, url);
    }

    if (response.ok) {
      cache.put(request, response.clone());
    } else if (response.status === 404 || response.status === 503) {
      // For JS chunks that return 404/503, this likely means deployment updated
      // Notify clients to refresh with asset path for context
      if (url.pathname.endsWith('.js')) {
        console.warn('[ServiceWorker] JS chunk not found, notifying clients:', url.pathname);
        notifyClientsToRefresh(url.pathname);
      }
      // Return a more helpful error response
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

    return response;
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
