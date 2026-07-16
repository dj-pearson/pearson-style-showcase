import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Only run the app's Vitest suites. Edge-function tests under
    // supabase/functions are Deno tests (run with `deno test`), not Vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'supabase/**'],
    // Provide dummy Supabase config so the client module (which fails fast on
    // missing env vars) can initialize under test. These are never used to make
    // real network calls - tests mock the client via src/test/mocks/supabase.ts.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_FUNCTIONS_URL: 'http://localhost:54321/functions/v1',
    },
    // Use the 'threads' pool rather than Vitest 4's default 'forks' pool.
    // The forks pool can fail to start ("Timeout starting forks runner") on some
    // Node versions/CI environments; the threads pool starts reliably and runs
    // the full suite. See US-051.
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'src/main.tsx',
      ],
      // Enforce minimum coverage on files exercised by the test run. As the
      // dedicated test stories (US-004..US-012) land, these can be ratcheted up.
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
