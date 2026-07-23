/**
 * Helper to (re)open the cookie preferences dialog from anywhere in the app
 * (e.g. a footer "Cookie settings" link or a policy page button). The
 * CookieConsentBanner listens for this event and opens its preferences dialog.
 */

/** Custom event name the CookieConsentBanner subscribes to. */
export const OPEN_PREFERENCES_EVENT = 'consent:open-preferences';

/** Dispatch the event that opens the cookie preferences dialog. */
export function openCookiePreferences(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES_EVENT));
}
