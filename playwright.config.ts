import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration.
 *
 * - baseURL comes from PLAYWRIGHT_BASE_URL (default http://localhost:8080).
 * - A dev server is started/stopped automatically via `webServer` (with dummy
 *   Supabase env so the client boots). Set PLAYWRIGHT_BASE_URL to run against an
 *   already-running server and the webServer is reused.
 * - Chromium + Firefox projects. In managed environments where Playwright's
 *   bundled browser is unavailable, set PLAYWRIGHT_CHROMIUM_PATH to a Chromium
 *   binary and it will be used for the chromium project.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

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

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
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
  },
});
