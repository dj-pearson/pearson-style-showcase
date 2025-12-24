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
            console.warn('[SW] Stale assets detected:', event.data.message, event.data.asset);
            showStaleAssetsNotification(event.data.asset);
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

  // Create notification content using DOM methods for security
  const container = document.createElement('div');
  container.className = 'flex items-center gap-3';

  const textContainer = document.createElement('div');
  textContainer.className = 'flex-1';

  const title = document.createElement('p');
  title.className = 'font-medium';
  title.textContent = 'Update Available';

  const description = document.createElement('p');
  description.className = 'text-sm opacity-90';
  description.textContent = 'A new version is available. Refresh to update.';

  const updateBtn = document.createElement('button');
  updateBtn.id = 'sw-update-btn';
  updateBtn.className = 'px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded transition-colors text-sm font-medium';
  updateBtn.textContent = 'Update';

  textContainer.appendChild(title);
  textContainer.appendChild(description);
  container.appendChild(textContainer);
  container.appendChild(updateBtn);
  notification.appendChild(container);

  document.body.appendChild(notification);

  updateBtn.addEventListener('click', () => {
    newWorker.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  });

  // Auto-remove after 10 seconds
  setTimeout(() => {
    notification.remove();
  }, 10000);
}

/**
 * Show notification when stale assets are detected
 * This happens when a new deployment has different chunk hashes
 */
function showStaleAssetsNotification(assetPath?: string) {
  // Don't show multiple notifications
  if (document.getElementById('stale-assets-notification')) {
    return;
  }

  const notification = document.createElement('div');
  notification.id = 'stale-assets-notification';
  notification.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-amber-600 text-white p-4 rounded-lg shadow-lg z-[100]';

  // Create notification content using DOM methods for security
  const outerContainer = document.createElement('div');
  outerContainer.className = 'flex flex-col gap-2';

  const topContainer = document.createElement('div');
  topContainer.className = 'flex items-start gap-3';

  // Create SVG icon using createElementNS for proper SVG rendering
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'w-6 h-6 flex-shrink-0 mt-0.5');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('viewBox', '0 0 24 24');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('d', 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15');

  svg.appendChild(path);

  const textContainer = document.createElement('div');
  textContainer.className = 'flex-1';

  const title = document.createElement('p');
  title.className = 'font-semibold';
  title.textContent = 'Update Required';

  const description = document.createElement('p');
  description.className = 'text-sm opacity-90';
  description.textContent = 'A new version was deployed. The page will refresh automatically, or click the button below.';

  textContainer.appendChild(title);
  textContainer.appendChild(description);

  topContainer.appendChild(svg);
  topContainer.appendChild(textContainer);

  const refreshBtn = document.createElement('button');
  refreshBtn.id = 'stale-assets-refresh-btn';
  refreshBtn.className = 'w-full px-4 py-2 bg-white/20 hover:bg-white/30 rounded transition-colors font-medium';
  refreshBtn.textContent = 'Refresh Now';

  outerContainer.appendChild(topContainer);
  outerContainer.appendChild(refreshBtn);
  notification.appendChild(outerContainer);

  document.body.appendChild(notification);

  refreshBtn.addEventListener('click', () => performStaleAssetsRecovery());

  // Auto-refresh after 5 seconds if user doesn't act
  // This prevents the app from staying in a broken state
  setTimeout(() => {
    console.log('[SW] Auto-refreshing due to stale assets...');
    performStaleAssetsRecovery();
  }, 5000);
}

/**
 * Perform recovery from stale assets by clearing caches and refreshing
 */
async function performStaleAssetsRecovery() {
  try {
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[SW] Cleared', cacheNames.length, 'caches');
    }

    // Unregister service worker to ensure completely fresh load
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('[SW] Unregistered service workers');
    }

    // Force reload bypassing cache
    window.location.reload();
  } catch (error) {
    console.error('[SW] Recovery failed:', error);
    // Fallback to simple reload
    window.location.reload();
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
