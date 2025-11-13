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

/**
 * Prompt user to install PWA
 */
export function setupInstallPrompt() {
  let deferredPrompt: any = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();

    // Stash the event so it can be triggered later
    deferredPrompt = e;

    // Show install button or banner
    showInstallPrompt(deferredPrompt);
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;
  });
}

function showInstallPrompt(deferredPrompt: any) {
  // Only show if not already installed and user hasn't dismissed recently
  if (isPWA() || localStorage.getItem('pwa-install-dismissed')) {
    return;
  }

  const installBanner = document.createElement('div');
  installBanner.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-card border border-border p-4 rounded-lg shadow-lg z-50';
  installBanner.innerHTML = `
    <div class="flex items-start gap-3">
      <img src="/icon-192.png" alt="App Icon" class="w-12 h-12 rounded-lg" />
      <div class="flex-1">
        <p class="font-medium mb-1">Install Dan Pearson Portfolio</p>
        <p class="text-sm text-muted-foreground">Get quick access from your home screen</p>
      </div>
      <button id="pwa-dismiss-btn" class="text-muted-foreground hover:text-foreground">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div class="flex gap-2 mt-3">
      <button
        id="pwa-install-btn"
        class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
      >
        Install
      </button>
      <button
        id="pwa-later-btn"
        class="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
      >
        Maybe Later
      </button>
    </div>
  `;

  document.body.appendChild(installBanner);

  // Install button
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[PWA] User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} the install prompt`);
        deferredPrompt = null;
      }
      installBanner.remove();
    });
  }

  // Dismiss buttons
  const dismissBtn = document.getElementById('pwa-dismiss-btn');
  const laterBtn = document.getElementById('pwa-later-btn');

  [dismissBtn, laterBtn].forEach(btn => {
    btn?.addEventListener('click', () => {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      installBanner.remove();
    });
  });
}
