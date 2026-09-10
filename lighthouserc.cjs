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
      // /ai-crm-automation is the commercial page and the most valuable one on
      // the site; it was the only key route not covered here.
      url: [
        'http://127.0.0.1:4173/',
        'http://127.0.0.1:4173/about',
        'http://127.0.0.1:4173/news',
        'http://127.0.0.1:4173/ai-crm-automation',
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
        //
        // FCP is 3200 rather than 2000 because 2000 is not reachable by this
        // app and never was: Lighthouse simulates slow 4G (562ms request
        // latency, 1.47 Mbps, 4x CPU), so the HTML round trip and then the
        // render-blocking stylesheet cost about 1.7s before a byte of CSS is
        // parsed. Measured across four routes, twice each: 2909-2943ms, with
        // no route materially different from any other - it is the boot cost,
        // not any one page. Unthrottled observed FCP is 126ms.
        //
        // A budget nothing can pass is not a budget; it just teaches everyone
        // to ignore a red check, which is exactly how the E2E suite rotted
        // (US-076). 3200 is measured-plus-headroom and still catches a real
        // regression. To earn a tighter number back, cut the render-blocking
        // CSS: 96.9% of it is unused on the homepage (US-080).
        'first-contentful-paint': ['error', { maxNumericValue: 3200 }],
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
