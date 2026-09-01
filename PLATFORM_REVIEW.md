# Platform review

Running deep-dive review of pearson-style-showcase against the standards in `CLAUDE.md`.
Each pass takes one area, records findings with `file:line`, fixes what is safe and in
scope, and leaves judgement calls for Dj. Verified with `npm run typecheck`,
`npx vitest run`, `npm run lint` and `npm run build` before each commit.

## Areas

| #   | Area                                                                               | Status          |
| --- | ---------------------------------------------------------------------------------- | --------------- |
| A   | UI, layout and design-system consistency                                           | first pass done |
| B   | Frontend correctness: routing, data fetching, loading/error states, effect cleanup | first pass done |
| C   | Edge functions: auth, input validation, error handling, secrets                    | first pass done |
| D   | Security: RLS, CSRF, sanitization, auth flows                                      | not started     |
| E   | Accessibility and mobile                                                           | not started     |
| F   | Performance: bundle budgets, lazy loading, re-renders                              | not started     |
| G   | Data layer: migrations vs. generated types                                         | not started     |

## Baseline

Taken on branch `claude/loop-prd-stories-8p07ja` before any change. All 68 `PRD.json`
stories are `passes: true`, and the completed state holds:

- `npm run typecheck` - 0 errors
- `npx vitest run` - 41 files, 472 tests, all passing
- `npm run lint` - 0 errors, 292 warnings (`no-explicit-any` and unused vars, mostly under `tools/automated-testing/`)
- `npm run build` - succeeds; prerenders 15 routes and 23 sitemap URLs
- `npm run size` - all four budgets pass

Two budgets sit close to their ceiling and are worth watching:
`three-vendor` 187.76 kB of 200 kB, `markdown-vendor` 216.87 kB of 240 kB.

## A. UI, layout and design system

`npx impeccable detect src` reported 37 anti-patterns. Twenty were one false positive
repeated, and the rest split into real problems and deliberate choices.

### Fixed: loading spinners had no accessible name

`src/components/LoadingSpinner.tsx` sets `role="status"`, `aria-busy="true"`, an
`aria-label` and sr-only text. Twenty call sites ignored it and hand-rolled
`<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />`
instead - a bare, unlabelled `div`. A screen reader announced nothing at all while
those views loaded, across the whole admin surface (accounting, command centre,
support, article and project managers) and on the public `/search` page.

All twenty now use `LoadingSpinner`, except the one inside a button
(`accounting/DataExporter.tsx:302`), which uses `Loader2` so the icon inherits the
button's `currentColor` rather than the spinner's hardcoded `text-primary`.

This is what impeccable flagged as `border-accent-on-rounded`; the rule was matching
the spinner's `rounded-full` plus `border-b-2`, not a card accent. The underlying
duplication was real even though the stated reason was not.

Thirteen of the twenty files were already failing `prettier --check` at HEAD, so the
commit carries formatting churn beyond the spinner change. The `.husky/pre-commit`
hook runs `prettier --write` through lint-staged, so that reformatting happens on
commit either way.

### Real, and Dj's call - visual identity

These match the tells `CLAUDE.md` calls out, but changing them alters how the public
site looks, so they are recorded rather than applied.

- Gradient text on headings: `src/index.css:370` (`.hero-gradient-text`),
  `src/pages/AuthorArchive.tsx:137`, `src/pages/CategoryArchive.tsx:97`,
  `src/pages/TagArchive.tsx:112`, `src/pages/Showcase.css:829`.
  `CLAUDE.md` asks for emphasis through weight and size instead.
- Violet-to-indigo gradient on the AI Generate button,
  `src/components/admin/tasks/TasksManager.tsx:293`.
- Body typeface is Inter, `src/index.css:130`.

### Real, and small enough to fix in a later pass

- Thick coloured left borders on alerts and cards, which `CLAUDE.md` names as the
  single most recognizable tell: `src/components/admin/OddTrafficMonitor.tsx:318`,
  `src/components/admin/SecurityAlertsDashboard.tsx:368`,
  `src/components/admin/support/TicketDetailView.tsx:489`, and
  `src/index.css:859` and `:864` (`.status-message[role='alert'|'status']`).
- `group-hover:animate-bounce` on the scroll-to-top arrow,
  `src/components/ReadingProgress.tsx:57`.

### Real, and not what the detector said

The five balance-sheet and P&L section headings in
`src/components/admin/accounting/FinancialReports.tsx` (lines 629, 660, 719, 750, 781)
use `text-green-700`, `text-red-700`, `text-blue-700`, `text-orange-700` and
`text-purple-700`. That is a coherent semantic colour system, not the purple tell
impeccable matched on. The real problem is that all five are hardcoded Tailwind
shades rather than theme tokens, and `tailwind.config.ts` runs `darkMode: 'class'` -
so on a dark surface these headings drop to poor contrast.

### Not defects

- `src/components/MarkdownRenderer.tsx:99` - `border-l-4` on a `<blockquote>` is a
  typographic convention, not a card side-tab.
- `src/index.css:1195` - the `animate-bounce` match is inside the
  `.a11y-reduced-motion` block that sets `animation: none !important`. It disables
  bounce rather than adding it.

## B. Frontend correctness

Swept effect cleanup, timers, routing and every `useQuery` / `await supabase` call site.

### Fixed: two window listeners survived unmount on `/showcase`

`src/pages/Showcase.tsx` registered `pointermove` and `pointerover` on `window` for the
custom cursor, and the cleanup never removed them - it carried the comment
`// pointer listeners on window` where the calls should have been, next to a
`// cleanup captured below` note at the registration site. The work was started and
left unfinished.

Both handlers closed over the cursor `dot`, `ring` and the page root, so navigating
away from `/showcase` kept those DOM nodes alive and kept running the handler on every
pointer move for the rest of the session, writing to elements already removed from the
document. Each return visit added another pair.

The handlers are declared inside an `if (fine)` block, so the fix hoists a
`removeCursorListeners` disposer into the effect scope and calls it from the cleanup.

### Fixed: date-archive cleanup could delete the wrong meta tag

`src/pages/DateArchive.tsx` appended its own `<meta name="robots" content="noindex,
nofollow">`, then on unmount removed whatever
`document.querySelector('meta[name="robots"][content="noindex, nofollow"]')` matched
first. `src/components/SEO.tsx:113` maintains a single shared `robots` meta and sets it
to exactly that value on any `noIndex` page, so the cleanup could delete SEO's node
instead and leak its own - once per visit to a legacy date URL.

It now holds the element it created and calls `metaRobots.remove()`. Covered by
`src/pages/__tests__/DateArchive.test.tsx`, which fails against the previous
implementation and passes against this one.

### Open question for Dj

`src/App.tsx:159-160` redirects legacy date URLs for `/2023/*` and `/2025/*` only.
There is no `/2024/*` or `/2026/*`, so legacy URLs from those years would land on the
404 page instead of `/news`. Nothing in the repo (`public/_redirects` included)
references 2024 or 2026 paths, so this may be correct - it depends on which legacy
URLs actually exist in the crawl data the list was built from. Worth confirming rather
than adding routes speculatively.

### Checked and sound

- Parameterized queries. All 108 `useQuery` call sites guard on their route
  param; none fire with an undefined `slug`, `topic`, `tag` or `id`.
- Supabase error handling. No call site drops the `error` field. Five looked
  suspicious on a mechanical scan and all five check it - the check just sits past a
  long insert payload. `SystemHealthCard.tsx` is the good example: it already refuses
  to read a failed metrics query as "zero errors", and reports degraded instead.
- Routing. Every page except the homepage is lazily imported, wrapped in both a
  local `ErrorBoundary` and a `Sentry.ErrorBoundary`, with a catch-all 404.
- Timer cleanup. The unmatched `setInterval` calls in `lib/registerSW.ts` and
  `lib/error-alerting.ts` are module singletons that live for the session, and the
  unmatched `setTimeout` calls are almost all "copied" toast resets. The 10-second
  `Promise.race` timeouts in `contexts/AuthContext.tsx:267` and `:448` leave a timer
  pending when the race is won, but `race` keeps the late rejection handled, so it
  costs one dangling timer and nothing else.
- `MarkdownRenderer.tsx:316` attaches click and keydown handlers to nodes inside a
  `dangerouslySetInnerHTML` subtree with no cleanup. React replaces that subtree when
  `sanitizedHtml` changes, so the handlers go with it, and `src/main.tsx` does not
  enable `StrictMode`, so there is no double-invoke to stack them.

## C. Edge functions

Thirty-one functions plus `_shared`, about 9,300 lines. Reviewed the auth model first,
since that is where a mistake is worth the most.

### How the auth model actually works

`danpearson-edge-functions/server.ts:274` is the gateway and it is well built: every
function is authenticated unless it appears in the `PUBLIC_FUNCTIONS` set, and an unset
`SUPABASE_JWT_SECRET` returns 503 rather than silently skipping the check. Default-deny
and fail-closed, both correct.

`supabase/config.toml` also carries `verify_jwt` flags. They apply only to the
Supabase-hosted runtime and to `supabase start`; the file says so itself. Nine deployed
functions have no entry there at all (`ai-content-generator`, `coolify-proxy`,
`create-invoice-from-document`, `generate-ai-tasks`, `google-indexing`,
`maintenance-runner`, `optimize-image`, `process-accounting-document`, `secure-vault`).
That is safe, because both the platform default and the gateway deny by default, but it
does weaken the file as the reference it is kept as.

### Fixed: six service-role functions accepted any valid JWT

`server.ts:275` states the invariant: "Functions holding the service role key still
check their own caller." Six did not. The gateway proved the caller held _a_ valid
token; nothing then checked _whose_. Every one of them then ran with
`SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely.

- `optimize-image` - `bucket` and `sourcePath` come straight from the request body and
  go to `supabase.storage.from(bucket).download(sourcePath)` on the service role, with
  a write of the result. That is an arbitrary storage read and write primitive for any
  token holder.
- `maintenance-runner` - dispatches `runTask` by name on the service role: session
  cleanup, database optimization, sitemap regeneration.
- `process-accounting-document` - reads uploaded financial documents and calls paid AI
  vision. It had a CSRF check, which proves a request is same-origin, not who sent it.
- `generate-ai-article`, `generate-ai-tasks` - paid AI generation. `generate-ai-tasks`
  had a per-IP rate limit, which caps volume rather than establishing identity.
- `send-article-webhook` - sends outbound webhooks.

All six now call `requireAdmin(req, corsHeaders, { allowServiceRole: true })`, which is
the helper the codebase already uses for exactly this and which the other service-role
functions were already calling. `allowServiceRole` matters in two places and both were
verified rather than assumed:

- the pg_cron scheduler posts `{"action":"run_due"}` to `maintenance-runner` with the
  service-role key as its bearer token
  (`supabase/migrations/20260716000000_maintenance_scheduler.sql:44`);
- `generate-ai-article:204` and `amazon-article-pipeline:860` call
  `send-article-webhook` through `invokeFunctionAndForget`, which sends the same key
  (`_shared/invoke-function.ts:40`).

Every other caller is admin-only UI. `useImageOptimization` currently has no consumer
at all, so `optimize-image` had no live caller to break.

After the change, the only service-role functions without a caller check are
`health-check`, `health-dashboard`, `newsletter-signup` and `oauth-proxy` - the four
that are deliberately in `PUBLIC_FUNCTIONS` and documented as such.

### Verification gap worth knowing about

`npm run typecheck` runs against `tsconfig.app.json`, which covers `src` only, and Deno
is not installed here, so nothing in `supabase/functions` is type-checked by any command
in `package.json` or by CI. The six edited files were parsed with esbuild to confirm they
are at least syntactically valid, which is weaker than a type check. A `deno check` step
would close this.

### Open question for Dj

`optimize-image` accepts any `bucket` name from the caller. Admin-gating it removes the
untrusted-caller problem, but an allow-list of buckets would be better than trusting the
body, since the default is `admin-uploads` and nothing else appears to be used.
