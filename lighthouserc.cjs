/**
 * Lighthouse CI configuration.
 *
 * Enforces performance/quality budgets on the built app across the three most
 * important public routes. Run locally or in CI via `npm run lighthouse`
 * (which builds the app first, then invokes `lhci autorun`).
 *
 * Notes:
 * - The app is served with `vite preview` (SPA fallback so client-side routes
 *   like /about and /news resolve). Dummy VITE_* env vars must be present at
 *   build+preview time so the Supabase client can initialize; CI supplies them.
 * - In sandboxed/CI Linux runners Chrome needs --no-sandbox. Set CHROME_PATH to
 *   point at a specific Chromium binary when the bundled one is unavailable.
 * - Reports are written to ./.lighthouseci (git-ignored) rather than uploaded,
 *   so the check is self-contained and needs no external network.
 */

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview -- --host 127.0.0.1 --port 4173',
      startServerReadyPattern: 'Local|localhost|ready in',
      startServerReadyTimeout: 60000,
      url: [
        'http://127.0.0.1:4173/',
        'http://127.0.0.1:4173/about',
        'http://127.0.0.1:4173/news',
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage --disable-gpu',
      },
    },
    assert: {
      assertions: {
        // Category score thresholds.
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],

        // Core Web Vitals / performance budgets.
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%',
    },
  },
};
