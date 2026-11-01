// Moved out of index.html so the CSP script-src can drop 'unsafe-inline'.
// Loaded as a classic, non-async script placed BEFORE the async gtag.js tag,
// so consent defaults are always queued before gtag.js processes dataLayer.

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

gtag('config', 'G-8R95ZXMV6L', { anonymize_ip: true, send_page_view: false });
