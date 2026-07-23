# Compliance Audit — Legal Documents, ADA/WCAG, GDPR/US Privacy

**Date:** July 23, 2026
**Scope:** danpearson.net (React + Vite SPA, Cloudflare Pages + Supabase)
**Areas:** Required legal pages, cookie/tracking consent (GDPR / ePrivacy / CCPA-CPRA),
web accessibility (ADA / WCAG 2.1 AA).

This document records the audit findings and the remediation shipped in the same change set.
Items marked **Operational** require a human action (verifying an email alias, having counsel
review policy text) and cannot be completed in code.

---

## 1. Executive summary

| Domain                        | Before                    | After                                                          |
| ----------------------------- | ------------------------- | -------------------------------------------------------------- |
| Privacy Policy page           | ❌ Missing                | ✅ `/privacy`                                                  |
| Terms of Service page         | ❌ Missing                | ✅ `/terms`                                                    |
| Cookie Policy page            | ❌ Missing                | ✅ `/cookies`                                                  |
| Accessibility Statement       | ✅ Present                | ✅ Improved (real review date)                                 |
| Cookie consent banner         | ❌ None                   | ✅ GDPR/CCPA banner + granular preferences                     |
| Analytics gated by consent    | ❌ Loaded unconditionally | ✅ Google Consent Mode v2, denied by default                   |
| Session Replay (Sentry) gated | ❌ Always on              | ✅ Consent-gated + text/media masked                           |
| "Do Not Sell/Share" (CCPA)    | ❌ Absent                 | ✅ Addressed in Privacy Policy                                 |
| GDPR data-subject rights      | ❌ Absent                 | ✅ Documented + contact route                                  |
| Form privacy notices          | ⚠️ Weak                   | ✅ Linked to Privacy Policy                                    |
| Footer legal links            | ⚠️ Accessibility only     | ✅ Privacy / Terms / Cookies / Accessibility / Cookie settings |
| WCAG skip-link targets        | ⚠️ 2 pages broken         | ✅ Fixed                                                       |
| In-app "Reduce Motion"        | ⚠️ Didn't stop 3D/GSAP    | ✅ Honored by hero + 3D orb                                    |
| Automated a11y/consent tests  | ❌ None                   | ✅ Consent unit tests added                                    |

---

## 2. Legal / privacy findings & remediation

### 2.1 Missing required pages — FIXED

No Privacy Policy, Terms of Service, or Cookie Policy existed. Added three pages sharing a common
`LegalPageLayout` (consistent SEO, landmarks, typography):

- `src/pages/PrivacyPolicy.tsx` → `/privacy`
- `src/pages/TermsOfService.tsx` → `/terms`
- `src/pages/CookiePolicy.tsx` → `/cookies`

Routed in `src/App.tsx`, linked from the footer, and added to `sitemap.xml`.

The Privacy Policy covers: controller identity, categories of data collected (contact form,
newsletter, consent-gated analytics/diagnostics, admin device data), purposes and **legal bases**,
third-party processors (Supabase, Google, Sentry, Cloudflare, email), international transfers,
retention, **GDPR/UK-GDPR data-subject rights**, **US state rights incl. CCPA/CPRA "do not
sell/share"**, security, children, and contact routes.

### 2.2 No consent mechanism; analytics loaded unconditionally — FIXED

GA4 (`index.html`) and Sentry Session Replay initialized on every load with no consent.

Implemented a privacy-by-default consent system:

- **`index.html`** now sets **Google Consent Mode v2** defaults to `denied` for
  `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`,
  `functionality_storage`, `personalization_storage` (only `security_storage` granted), with
  `wait_for_update`. GA still loads but collects nothing until consent is granted.
- **`src/lib/consent.ts`** — versioned consent store (localStorage), Consent Mode updates,
  and a same-tab change event. Privacy-by-default: no stored decision → everything optional denied.
- **`src/components/CookieConsentBanner.tsx`** — first-visit banner with equally-weighted
  **Accept all / Reject all** (GDPR: rejecting must be as easy as accepting) plus a
  **Customize** dialog for granular per-category opt-in. Re-openable any time via the footer
  "Cookie settings" link and from the policy pages.
- **`src/lib/sentry.ts`** — Session Replay is now added only with **functional** consent, and
  configured with `maskAllText` + `blockAllMedia` so replays never capture personal data. Error
  monitoring itself continues under legitimate interest.

### 2.3 Forms lacked privacy notices — FIXED

- `ContactForm.tsx` now shows a privacy notice linking to `/privacy`.
- `NewsletterSignup.tsx` now links to the Privacy Policy in its consent microcopy.

### 2.4 Operational follow-ups (human action required)

- **Legal review:** the policy text is a strong, accurate baseline but should be reviewed by
  counsel before being relied upon, and jurisdiction (Iowa) / entity ("Pearson Media LLC")
  confirmed.
- **Email aliases:** ensure `privacy@danpearson.net` and `legal@danpearson.net` are monitored.
- **Data-subject request workflow:** define who fulfills access/deletion requests and the SLA.
- **Processor DPAs:** confirm Data Processing Agreements are in place with Supabase, Google
  (GA), Sentry, Cloudflare, and the email provider.

---

## 3. Accessibility (WCAG 2.1 AA) findings & remediation

The site already had a strong a11y foundation (statement page, preferences widget, route
announcer, skip link, focus-visible system, OS + in-app high-contrast and reduced-motion CSS).
The audit surfaced these gaps:

### 3.1 Broken skip-link / focus target on two pages — FIXED (medium)

`Status.tsx` and `AdminDashboard.tsx` used `<main>` without `id="main-content"`, so the skip
link and `RouteAnnouncer` focus move silently failed. Added the id to both.

### 3.2 In-app "Reduce Motion" didn't stop JS/WebGL animation — FIXED (medium)

The widget toggle only added a CSS class, which cannot stop GSAP or the WebGL orb's
`autoRotate`/`useFrame`. `HeroSection.tsx` and `Index.tsx` now also read
`preferences.reducedMotion` from `AccessibilityContext` (combined with the OS setting), so the
in-app toggle genuinely disables the hero choreography and unmounts the 3D orb.

### 3.3 OS change clobbered the user's manual motion choice — FIXED (low)

`AccessibilityContext` tracked no "explicit" flag, so a later OS `prefers-reduced-motion` change
overwrote a manual toggle. Added `reducedMotionExplicit`; the OS listener now defers to an
explicit in-app choice.

### 3.4 Accessibility statement showed today's date — FIXED (low)

`Accessibility.tsx` rendered `new Date()` as "Last updated", which is misleading for a formal
statement. Replaced with a fixed `LAST_REVIEWED` constant.

### 3.5 No automated a11y/consent tests — PARTIALLY ADDRESSED

Added `src/lib/__tests__/consent.test.ts` (10 tests) covering the consent state machine and
Consent Mode integration. `AccessibilityProvider` is now included in the shared test wrapper
(`src/test/test-utils.tsx`) so a11y context is exercised across the suite.

**Recommended next:** add `jest-axe` smoke tests and focused tests for `AccessibilityWidget`
(focus trap / Escape) and `RouteAnnouncer`.

### 3.6 Remaining low-severity / manual items

- Contrast spot-check of cyan `--primary` text on light-tinted card fills (passes on dark
  surfaces; verify tinted fills with a contrast tool).
- `About.tsx` alt text can misdescribe a `/placeholder.svg` fallback.
- Redundant landmark ARIA in `Article.tsx` (`role="status"`/`role="main"` on `<main>`).

---

## 4. Files changed

**New**

- `src/lib/consent.ts`, `src/lib/cookie-preferences.ts`
- `src/components/CookieConsentBanner.tsx`
- `src/components/legal/LegalPageLayout.tsx`
- `src/pages/PrivacyPolicy.tsx`, `src/pages/TermsOfService.tsx`, `src/pages/CookiePolicy.tsx`
- `src/lib/__tests__/consent.test.ts`
- `docs/COMPLIANCE_AUDIT.md`

**Modified**

- `index.html` (Consent Mode v2 default)
- `src/main.tsx` (init stored consent early)
- `src/App.tsx` (routes + banner mount)
- `src/lib/sentry.ts` (consent-gated, masked replay)
- `src/components/Footer.tsx` (legal links + Cookie settings)
- `src/components/ContactForm.tsx`, `src/components/NewsletterSignup.tsx` (privacy notices)
- `src/contexts/AccessibilityContext.tsx` (explicit reduced-motion flag)
- `src/components/HeroSection.tsx`, `src/pages/Index.tsx` (honor in-app reduced motion)
- `src/pages/Accessibility.tsx` (fixed review date)
- `src/pages/Status.tsx`, `src/pages/AdminDashboard.tsx` (skip-link target id)
- `src/pages/SitemapXML.tsx` (index legal + accessibility pages)
- `src/test/test-utils.tsx` (wrap tests in AccessibilityProvider)

## 5. Verification

- `npm run build` — succeeds.
- `npx vitest run` — 376 tests pass (incl. 10 new consent tests).
- Type-check clean for all changed files (two unrelated pre-existing errors in
  `useSecureQuery.ts` / `secure-supabase.test.ts` are out of scope).
