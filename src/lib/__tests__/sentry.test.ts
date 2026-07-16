import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock the SDK so we can assert init() is not called in the no-DSN path.
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  reactRouterV6BrowserTracingIntegration: vi.fn(),
  replayIntegration: vi.fn(),
  ErrorBoundary: () => null,
}));

import * as SentrySDK from '@sentry/react';
import { initSentry } from '../sentry';

afterEach(() => {
  vi.clearAllMocks();
});

describe('initSentry', () => {
  it('is a graceful no-op and does not call Sentry.init when no DSN is set', () => {
    // No VITE_SENTRY_DSN in the test env.
    expect(initSentry()).toBe(false);
    expect(SentrySDK.init).not.toHaveBeenCalled();
  });
});
