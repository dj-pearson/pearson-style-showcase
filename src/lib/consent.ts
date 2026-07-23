/**
 * Cookie / tracking consent management.
 *
 * Implements a lightweight consent store that drives Google Consent Mode v2 and
 * gates optional tracking (analytics, session replay). The design goal is
 * privacy-by-default: until a visitor makes a choice, all non-essential storage
 * is treated as denied.
 *
 * Consent categories:
 *  - "necessary": always on (security, load balancing, consent record itself).
 *  - "analytics": Google Analytics 4 page views / events.
 *  - "functional": preference storage beyond strictly-necessary (e.g. session
 *    replay for diagnostics, remembered UI state that isn't essential).
 *
 * The stored decision is versioned so the banner can be re-shown if the policy
 * (and therefore the categories) materially changes.
 */

export type ConsentCategory = 'necessary' | 'analytics' | 'functional';

export interface ConsentState {
  necessary: true;
  analytics: boolean;
  functional: boolean;
  /** Consent record schema version. Bump to re-prompt all users. */
  version: number;
  /** ISO timestamp of when the decision was recorded. */
  updatedAt: string;
}

/** Bump when the set of categories or the privacy policy materially changes. */
export const CONSENT_VERSION = 1;

const STORAGE_KEY = 'cookie-consent-v1';

/** Broadcast to same-tab listeners (React banner, Sentry init) on change. */
export const CONSENT_CHANGE_EVENT = 'consent:change';

declare global {
  interface Window {
    // Matches the declarations in analytics.ts / Analytics.tsx (non-optional).
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/** A denied-by-default consent state (used before any decision is made). */
function deniedState(): ConsentState {
  return {
    necessary: true,
    analytics: false,
    functional: false,
    version: CONSENT_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Read the stored consent decision. Returns null when the visitor has not yet
 * made a choice, or when the stored record is from an older schema version
 * (in which case they should be re-prompted).
 */
export function getStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.version !== CONSENT_VERSION) return null;
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      functional: Boolean(parsed.functional),
      version: CONSENT_VERSION,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Whether a valid consent decision already exists (banner can stay hidden). */
export function hasStoredConsent(): boolean {
  return getStoredConsent() !== null;
}

/**
 * The effective consent to apply right now. When no decision has been recorded,
 * everything optional is denied (privacy by default).
 */
export function getConsent(): ConsentState {
  return getStoredConsent() ?? deniedState();
}

/** Convenience check for a single optional category. */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  return getConsent()[category];
}

/**
 * Push the current consent into Google Consent Mode. Safe to call before or
 * after gtag.js loads — commands queue on window.dataLayer either way.
 */
function applyToGoogleConsentMode(state: ConsentState): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  const gtag =
    typeof window.gtag === 'function'
      ? window.gtag
      : (...args: unknown[]) => {
          window.dataLayer.push(args);
        };
  const granted = 'granted';
  const denied = 'denied';
  gtag('consent', 'update', {
    ad_storage: denied,
    ad_user_data: denied,
    ad_personalization: denied,
    analytics_storage: state.analytics ? granted : denied,
    functionality_storage: state.functional ? granted : denied,
    personalization_storage: state.functional ? granted : denied,
    security_storage: granted,
  });
}

/**
 * Persist a consent decision, sync Google Consent Mode, and notify listeners.
 */
export function setConsent(choice: { analytics: boolean; functional: boolean }): ConsentState {
  const state: ConsentState = {
    necessary: true,
    analytics: choice.analytics,
    functional: choice.functional,
    version: CONSENT_VERSION,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode / blocked). Consent Mode still
    // gets updated for this session below; the banner will simply re-appear
    // next load, which is the safe/expected behavior.
  }

  applyToGoogleConsentMode(state);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_CHANGE_EVENT, { detail: state }));
  }

  return state;
}

/** Accept every optional category. */
export function acceptAll(): ConsentState {
  return setConsent({ analytics: true, functional: true });
}

/** Reject every optional category (necessary stays on). */
export function rejectAll(): ConsentState {
  return setConsent({ analytics: false, functional: false });
}

/**
 * Re-apply whatever decision is currently stored to Google Consent Mode. Call
 * once on app startup so a returning visitor's choice takes effect immediately.
 * No-ops (leaving the denied default in place) when no decision exists.
 */
export function initConsent(): void {
  const stored = getStoredConsent();
  if (stored) {
    applyToGoogleConsentMode(stored);
  }
}

/**
 * Subscribe to consent changes within the current tab. Returns an unsubscribe
 * function. Used by React components and by the Sentry initializer.
 */
export function onConsentChange(listener: (state: ConsentState) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ConsentState>).detail ?? getConsent();
    listener(detail);
  };
  window.addEventListener(CONSENT_CHANGE_EVENT, handler);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, handler);
}
