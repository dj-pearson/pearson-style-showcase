import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Playwright E2E configuration.
 *
 * - baseURL comes from PLAYWRIGHT_BASE_URL (default http://localhost:8080).
 * - A dev server is started/stopped automatically via `webServer` (with dummy
 *   Supabase env so the client boots). Set PLAYWRIGHT_BASE_URL to run against an
 *   already-running server and the webServer is reused.
 * - Chromium + Firefox projects. In managed environments where Playwright's
 *   bundled browser is unavailable, a system Chromium is discovered
 *   automatically (see resolveChromium); PLAYWRIGHT_CHROMIUM_PATH overrides it.
 * - PLAYWRIGHT_PREVIEW=1 (`npm run test:e2e:preview`, which builds first)
 *   swaps the dev server for `vite preview` of dist/ and runs only the
 *   `preview` project: e2e/preview/**, chromium with JavaScript disabled, to
 *   check the prerendered HTML a non-rendering crawler receives. The dev
 *   server never runs scripts/prerender.mjs, so these specs cannot run there.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';

/**
 * Finds a Chromium to drive.
 *
 * Playwright pins an exact browser build and refuses to start when the
 * installed one does not match, with a "run npx playwright install" message -
 * which is the wrong advice in an image that ships a preinstalled Chromium and
 * blocks the download. That mismatch failed all 25 public E2E tests here on a
 * revision that was one digit off. PLAYWRIGHT_CHROMIUM_PATH always wins;
 * otherwise any chromium build under PLAYWRIGHT_BROWSERS_PATH is used, and
 * failing that Playwright's own bundled build.
 */
function resolveChromium(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;

  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || root === '0' || !existsSync(root)) return undefined;

  const candidates = readdirSync(root)
    .filter((entry) => entry.startsWith('chromium-') || entry === 'chromium')
    // Highest build revision first, so the newest install wins.
    .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
    // chrome-linux64 is the layout of newer Playwright builds (1200+).
    .flatMap((entry) => [
      join(root, entry, 'chrome-linux', 'chrome'),
      join(root, entry, 'chrome-linux64', 'chrome'),
    ]);

  return candidates.find((candidate) => existsSync(candidate));
}

const chromiumExecutable = resolveChromium();
const chromiumLaunch = chromiumExecutable
  ? { launchOptions: { executablePath: chromiumExecutable } }
  : {};

const previewMode = !!process.env.PLAYWRIGHT_PREVIEW;
const previewURL = 'http://127.0.0.1:4173';

const devServer = {
  // Bind explicitly to IPv4; the vite config's default host ("::") can fail
  // to bind on IPv6-less hosts.
  command: 'npm run dev -- --host 127.0.0.1 --port 8080',
  url: baseURL,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  env: {
    // Dummy config so the Supabase client (which fails fast on missing env)
    // can initialize; E2E tests mock network calls rather than hit real APIs.
    VITE_SUPABASE_URL: 'http://localhost:54321',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_FUNCTIONS_URL: 'http://localhost:54321/functions/v1',
  },
};

// Serves the existing dist/; it does not build. See e2e/preview/vite.preview.config.ts
// for how it approximates Cloudflare Pages (404.html with a 404 status).
const previewServer = {
  command:
    'npx vite preview --config e2e/preview/vite.preview.config.ts --host 127.0.0.1 --port 4173 --strictPort',
  url: previewURL,
  reuseExistingServer: !process.env.CI,
  timeout: 60_000,
};

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000, // 30s per test
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e-results', open: 'never' }]],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: previewMode
    ? [
        {
          name: 'preview',
          testDir: './e2e/preview',
          testMatch: '**/*.spec.ts',
          use: {
            ...devices['Desktop Chrome'],
            ...chromiumLaunch,
            baseURL: previewURL,
            javaScriptEnabled: false,
          },
        },
      ]
    : [
        {
          name: 'chromium',
          testIgnore: 'preview/**',
          use: { ...devices['Desktop Chrome'], ...chromiumLaunch },
        },
        {
          name: 'firefox',
          testIgnore: 'preview/**',
          use: { ...devices['Desktop Firefox'] },
        },
      ],

  webServer: previewMode ? previewServer : devServer,
});
