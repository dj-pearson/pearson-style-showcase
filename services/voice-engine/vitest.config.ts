import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Rendering starts Chromium and ffmpeg; the default 5s is not enough on CI.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'threads',
  },
});
