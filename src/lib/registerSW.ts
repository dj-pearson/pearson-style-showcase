/**
 * Service Worker Registration
 * Handles PWA offline functionality
 */

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('[SW] Service Worker registered successfully:', registration.scope);

        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;

          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                showUpdateNotification(newWorker);
              }
            });
          }
        });

        // Listen for controller change (new service worker activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[SW] New service worker activated');
          // Optionally reload the page to use new service worker
          // window.location.reload();
        });

        // Listen for stale assets detection from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'STALE_ASSETS_DETECTED') {
            console.warn('[SW] Stale assets detected:', event.data.message);
            showStaleAssetsNotification();
          }
        });

      } catch (error) {
        console.error('[SW] Service Worker registration failed:', error);
      }
    });
  } else {
    console.warn('[SW] Service Workers are not supported in this browser');
  }
}

function showUpdateNotification(newWorker: ServiceWorker) {
  // Show a notification to the user that an update is available
  const notification = document.createElement('div');
  notification.className = 'fixed bottom-4 right-4 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg z-50 max-w-sm';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="flex-1">
        <p class="font-medium">Update Available</p>
        <p class="text-sm opacity-90">A new version is available. Refresh to update.</p>
      </div>
      <button
        id="sw-update-btn"
        class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded transition-colors text-sm font-medium"
      >
        Update
      </button>
    </div>
  `;

  document.body.appendChild(notification);

  const updateBtn = document.getElementById('sw-update-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    });
  }

  // Auto-remove after 10 seconds
  setTimeout(() => {
    notification.remove();
  }, 10000);
}

/**
 * Show notification when stale assets are detected
 * This happens when a new deployment has different chunk hashes
 */
function showStaleAssetsNotification() {
  // Don't show multiple notifications
  if (document.getElementById('stale-assets-notification')) {
    return;
  }

  const notification = document.createElement('div');
  notification.id = 'stale-assets-notification';
  notification.className = 'fixed bottom-4 right-4 bg-amber-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="flex-1">
        <p class="font-medium">Update Required</p>
        <p class="text-sm opacity-90">A new version was deployed. Please refresh to continue.</p>
      </div>
      <button
        id="stale-assets-refresh-btn"
        class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded transition-colors text-sm font-medium"
      >
        Refresh
      </button>
    </div>
  `;

  document.body.appendChild(notification);

  const refreshBtn = document.getElementById('stale-assets-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      // Clear caches before refreshing
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      window.location.reload();
    });
  }
}

/**
 * Unregister all service workers (useful for development)
 */
export async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();

    for (const registration of registrations) {
      await registration.unregister();
      console.log('[SW] Service Worker unregistered');
    }
  }
}

/**
 * Check if the app is running as a PWA (installed)
 */
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}
