import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock the SDK so we can assert init() is (or isn't) called without a real DSN.
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  reactRouterV6BrowserTracingIntegration: vi.fn(),
  replayIntegration: vi.fn(),
  ErrorBoundary: () => null,
}));

import * as SentrySDK from '@sentry/react';

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('initSentry', () => {
  it('is a graceful no-op and does not call Sentry.init when no DSN is set', async () => {
    // Explicitly force an empty DSN so the test does not depend on ambient
    // env (a developer's local .env may legitimately configure a real DSN).
    vi.stubEnv('VITE_SENTRY_DSN', '');
    const { initSentry } = await import('../sentry');

    expect(initSentry()).toBe(false);
    expect(SentrySDK.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry once when a DSN is configured', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@o1.ingest.us.sentry.io/1');
    const { initSentry } = await import('../sentry');

    expect(initSentry()).toBe(true);
    expect(SentrySDK.init).toHaveBeenCalledTimes(1);

    // Idempotent: a second call must not re-initialize.
    expect(initSentry()).toBe(true);
    expect(SentrySDK.init).toHaveBeenCalledTimes(1);
  });
});
