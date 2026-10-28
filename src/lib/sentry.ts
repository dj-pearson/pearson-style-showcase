/**
 * Sentry error tracking / performance monitoring.
 *
 * Initialization is a graceful no-op when VITE_SENTRY_DSN is not set, so local
 * development and unconfigured builds work unchanged.
 */
import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom';
import { hasConsent, onConsentChange } from './consent';

/** Resolve the deployment environment from Vite env / hostname. */
function resolveEnvironment(): 'development' | 'staging' | 'production' {
  if (import.meta.env.DEV) return 'development';

  const explicit = import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined;
  if (explicit === 'development' || explicit === 'staging' || explicit === 'production') {
    return explicit;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('staging') || host.includes('preview') || host.endsWith('.pages.dev')) {
      return 'staging';
    }
  }
  return 'production';
}

/** Performance trace sample rate: full in staging, 10% in production. */
function tracesSampleRateFor(environment: string): number {
  return environment === 'production' ? 0.1 : 1.0;
}

let initialized = false;
let replayRequested = false;

/**
 * Add Session Replay at runtime. The replay integration is about 40 KB of
 * gzip, so it is fetched as its own chunk only once Sentry is initialized and
 * the visitor has granted functional consent, instead of riding in the entry
 * bundle for every visitor.
 */
function loadReplay(): void {
  if (replayRequested) return;
  replayRequested = true;
  import('@sentry/react')
    .then(({ replayIntegration, addIntegration }) => {
      // Mask text/media by default so replays don't capture personal data.
      addIntegration(replayIntegration({ maskAllText: true, blockAllMedia: true }));
    })
    .catch(() => {
      // Replay is best-effort; allow a retry on the next consent change.
      replayRequested = false;
    });
}

/**
 * Initialize Sentry. Safe to call once at app startup. No-ops (and returns
 * false) when no DSN is configured.
 */
export function initSentry(): boolean {
  if (initialized) return true;

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    // Graceful no-op: the app runs normally without error tracking configured.
    return false;
  }

  const environment = resolveEnvironment();

  // Session Replay records user interactions, so it is treated as a
  // consent-gated ("functional") technology. Error/performance monitoring
  // itself runs under legitimate interest for site security and reliability.
  const integrations = [
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
  ];

  Sentry.init({
    dsn,
    environment,
    integrations,
    tracesSampleRate: tracesSampleRateFor(environment),
    // Replay: capture 10% of all sessions, and 100% of sessions with an error
    // (only takes effect once the replay integration is loaded after consent).
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  initialized = true;

  // Replay is added after init (now, or whenever functional consent is granted
  // later in the session) without requiring a page reload.
  if (hasConsent('functional')) loadReplay();
  onConsentChange((state) => {
    if (state.functional) loadReplay();
  });

  return true;
}

// Re-export the pieces the app wires up (ErrorBoundary in App.tsx).
export { Sentry };
