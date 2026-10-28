// Moved out of index.html so the CSP script-src can drop 'unsafe-inline'.
// Loaded as a classic, non-async script placed BEFORE the async gtag.js tag,
// so consent defaults are always queued before gtag.js processes dataLayer.

// Async Google Fonts stylesheet: the <link id="font-inter" rel="preload">
// above this script used to flip itself to rel=stylesheet via an inline
// onload handler, which CSP without 'unsafe-inline' blocks.
(function () {
  var link = document.getElementById('font-inter');
  if (!link) return;
  var apply = function () { link.rel = 'stylesheet'; };
  link.addEventListener('load', apply, { once: true });
  // If the preload already finished before this listener attached.
  if (link.sheet) apply();
})();

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
