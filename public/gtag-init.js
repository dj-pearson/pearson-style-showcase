// Moved out of index.html so the CSP script-src can drop 'unsafe-inline'.
// Loaded with `defer` from index.html. It defines dataLayer and gtag() and
// queues the consent defaults. It does NOT load gtag.js: src/lib/consent.ts
// injects that only once the visitor grants analytics consent, so Google's
// script is never fetched for a visitor who hasn't opted in. Deferred and
// module scripts run in document order, so this runs before the module entry,
// whose initConsent() calls gtag().

window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}

// Google Consent Mode v2 - privacy by default.
// All optional storage starts DENIED and is only granted after the visitor
// consents via the cookie banner (see src/lib/consent.ts). This runs before
// gtag('config') so no consent-gated data is collected until a choice is made.
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'denied',
  personalization_storage: 'denied',
  security_storage: 'granted',
  wait_for_update: 500
});

gtag('js', new Date());

// send_page_view is off: src/components/Analytics.tsx sends one page_view per
// route change, including the first.
gtag('config', 'G-8R95ZXMV6L', { anonymize_ip: true, send_page_view: false });
