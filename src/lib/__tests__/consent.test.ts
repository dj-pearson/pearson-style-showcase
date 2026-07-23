import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStoredConsent,
  hasStoredConsent,
  getConsent,
  hasConsent,
  setConsent,
  acceptAll,
  rejectAll,
  initConsent,
  onConsentChange,
  CONSENT_VERSION,
} from '../consent';

describe('consent module', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the gtag/dataLayer spies each test.
    window.dataLayer = [];
    window.gtag = vi.fn();
  });

  it('defaults to denied for all optional categories before any choice', () => {
    expect(hasStoredConsent()).toBe(false);
    const consent = getConsent();
    expect(consent.necessary).toBe(true);
    expect(consent.analytics).toBe(false);
    expect(consent.functional).toBe(false);
  });

  it('necessary consent is always granted', () => {
    expect(hasConsent('necessary')).toBe(true);
  });

  it('acceptAll grants analytics and functional and persists a decision', () => {
    acceptAll();
    expect(hasStoredConsent()).toBe(true);
    expect(hasConsent('analytics')).toBe(true);
    expect(hasConsent('functional')).toBe(true);
  });

  it('rejectAll denies analytics and functional but still records a decision', () => {
    rejectAll();
    expect(hasStoredConsent()).toBe(true);
    expect(hasConsent('analytics')).toBe(false);
    expect(hasConsent('functional')).toBe(false);
  });

  it('setConsent stores granular choices', () => {
    setConsent({ analytics: true, functional: false });
    const stored = getStoredConsent();
    expect(stored?.analytics).toBe(true);
    expect(stored?.functional).toBe(false);
    expect(stored?.version).toBe(CONSENT_VERSION);
  });

  it('ignores a stored decision from an older schema version', () => {
    localStorage.setItem(
      'cookie-consent-v1',
      JSON.stringify({ analytics: true, functional: true, version: 0 })
    );
    expect(hasStoredConsent()).toBe(false);
    expect(getConsent().analytics).toBe(false);
  });

  it('pushes an update to Google Consent Mode when a choice is made', () => {
    setConsent({ analytics: true, functional: false });
    expect(window.gtag).toHaveBeenCalledWith(
      'consent',
      'update',
      expect.objectContaining({ analytics_storage: 'granted', functionality_storage: 'denied' })
    );
  });

  it('initConsent re-applies a stored decision to Consent Mode', () => {
    setConsent({ analytics: true, functional: true });
    (window.gtag as ReturnType<typeof vi.fn>).mockClear();
    initConsent();
    expect(window.gtag).toHaveBeenCalledWith(
      'consent',
      'update',
      expect.objectContaining({ analytics_storage: 'granted' })
    );
  });

  it('initConsent does nothing when no decision is stored', () => {
    initConsent();
    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('notifies subscribers on consent change', () => {
    const listener = vi.fn();
    const unsubscribe = onConsentChange(listener);
    acceptAll();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ analytics: true, functional: true });
    unsubscribe();
    rejectAll();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
