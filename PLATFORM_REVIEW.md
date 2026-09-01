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
| D   | Security: RLS, CSRF, sanitization, auth flows                                      | first pass done |
| E   | Accessibility and mobile                                                           | first pass done |
| F   | Performance: bundle budgets, lazy loading, re-renders                              | fixed           |
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

## D. Security

Reconstructed the final RLS state by replaying all 68 migrations in order (a policy
that looks alarming in a 2025 migration is usually dropped by a later one), then read
the sanitization and CSRF paths.

### RLS coverage is complete

All 82 tables have `ENABLE ROW LEVEL SECURITY`, with 199 policies in the final state.
The permissive early policies that stand out on a naive grep - `projects` open for
UPDATE and DELETE, `newsletter_subscribers` readable by everyone - were correctly
dropped and replaced later. Only the end state matters and it is mostly sound.

### Fixed: anonymous read of subscriber emails on amazon_price_alerts

`supabase/migrations/20251113000002_amazon_price_tracking.sql:184-201` creates four
policies named "Users can view own alerts", "update own alerts" and "delete own
alerts". Every predicate is `USING (true)` and none carries a `TO` clause, so they
applied to the public role. The table has no `user_id` column at all - it keys on
`user_email` - so "own row" was never expressible with `auth.uid()`. The names describe
an intent the SQL does not implement.

The anon key ships in the frontend bundle, so anyone could `select * from
amazon_price_alerts` and harvest every subscriber's email address, or update and delete
any row. This does not depend on the UI: `src/components/AmazonPriceTracker.tsx` is the
only consumer and nothing renders it, but the policy is live regardless.

`supabase/migrations/20260901000001_restrict_price_alert_and_reset_token_rls.sql` moves
SELECT, UPDATE and DELETE to `public.has_role(auth.uid(), 'admin')`, matching how
`newsletter_subscribers` was fixed in `20251007232740`. INSERT stays public because
creating your own alert is the intended anonymous action, the same shape as
`contact_submissions` and `support_tickets`.

Consequence worth knowing: the `userAlerts` query in `AmazonPriceTracker.tsx:88` now
returns nothing for an anonymous visitor. That component is not mounted anywhere, so
nothing changes today, but wiring it up later needs an edge function on the service
role to read alerts back - which is exactly what `newsletter-signup` already does for
its table.

### Fixed: anyone could write password reset tokens

`password_reset_tokens` scoped SELECT and UPDATE to `user_id = auth.uid()` but left
INSERT as `WITH CHECK (true)` for the public role
(`20251007234031_6706ee2a-3603-487f-829a-9a94ade3f4e3.sql:13`), so a client could write
a reset-token row for any `user_id`. No application code touches this table and tokens
are issued server-side where the service role bypasses RLS, so closing the client-side
insert costs nothing.

### Still permissive, and probably fine - worth one look from Dj

These carry `USING (true)` for the public role in the final state. Most are the
"anonymous action" pattern and are correct; a few are worth confirming.

- Correct by design: `contact_submissions`, `support_tickets`, `ai_tool_submissions`,
  `page_visits` (anonymous INSERT only), and the public SELECTs on `articles`,
  `projects`, `ai_tools`, `article_categories`, `ventures`, `profile_settings`.
- Worth confirming: `system_metrics`, `admin_activity_log`, `secure_vault_access_log`,
  `email_logs` and `automated_alerts` all allow INSERT from the public role. These are
  audit and monitoring tables, so a forged row means a poisoned audit trail or a
  distorted health reading on the command centre. Writers are edge functions on the
  service role, which bypasses RLS, so restricting these to the service role would
  likely break nothing.
- Also open to the public role for full read and write: `amazon_products`,
  `article_products`, `link_health`, `dashboard_stats_cache`, `amazon_api_throttle`.
- `accounting_documents` grants SELECT, INSERT and UPDATE to any `authenticated` user
  with `USING (true)`, so financial documents are not scoped per user. Low risk while
  authentication is admin-only, but it is not least privilege.

### Checked and sound

- Markdown sanitization. `src/components/MarkdownRenderer.tsx:243` and `:451` allow no
  event-handler or `style` attributes, set `ALLOW_DATA_ATTR: false` and
  `ALLOW_UNKNOWN_PROTOCOLS: false`, pin `ALLOWED_URI_REGEXP` to http/https/mailto/tel,
  and then re-walk the output to strip `img` sources beginning `data:image/svg`,
  `javascript:` or `vbscript:`. `button` was deliberately removed from `ALLOWED_TAGS`
  in favour of `span[data-custom-btn]` to close onclick injection. Custom button, alert
  and badge syntax whitelists its style, type and variant values and re-validates the
  URL at click time.
- CSRF. `supabase/functions/_shared/csrf.ts` pairs a strict Origin allow-list with a
  required `x-csrf-token` header. A missing Origin still has to clear the header
  requirement, and a cross-site attacker cannot set a custom header without passing
  preflight, so the combination holds.
- Secrets. No key, token or password literal anywhere in `src` or
  `supabase/functions`; the only JWT-shaped string is a fixture in
  `lib/__tests__/production-logger.test.ts` that tests log masking. No `.env` file is
  tracked, only `.env.example`.

## E. Accessibility and mobile

### The gap: nothing checked accessibility on the admin surface

`e2e/public/accessibility.spec.ts` runs axe-core against six routes - `/`, `/about`,
`/news`, `/projects`, `/connect`, `/search` - and gates on serious and critical WCAG
2.1 A/AA violations. That is real coverage, and the public site is in good shape
because of it.

Nothing covered the other 74 admin components, and `eslint-plugin-jsx-a11y` was not
configured, so no static rule caught anything anywhere.

The plugin is now wired into `eslint.config.js` at `warn`. Warnings keep the count
visible in `npm run lint` and in CI without gating a build that has a real backlog to
work down; the comment there says to tighten to `error` once it is cleared.
`jsx-a11y/label-has-for` is explicitly off: it is deprecated upstream and reports the
same controls as `label-has-associated-control` with a worse message.

`npm run lint` goes from 292 to 391 warnings, still 0 errors.

### Fixed

- `src/components/SocialShare.tsx:124` - the compact share button is icon-only with no
  accessible name, so it announced as just "button". This one is public, on article
  pages. Now `aria-label="Share this page"` with the icon `aria-hidden`.
- `src/components/admin/support/NotificationSettings.tsx:195` - same shape on the add
  recipient button.
- `src/components/LazyVideo.tsx:265` - custom video controls appeared on
  `onMouseEnter` and hid on `onMouseLeave`, so a keyboard user never saw them at all.
  `onFocus` and `onBlur` now mirror the mouse handlers.

### The backlog the linter now reports

- 49 `label-has-associated-control`. Cleared in a dedicated pass; see below.
- 17 `control-has-associated-label`. Audited and cleared; see below.
- 19 `no-static-element-interactions` and `click-events-have-key-events`. Cleared; see below.
- A few known false positives, left alone: `heading-has-content` in `ui/alert.tsx:39`
  and `ui/card.tsx:36` and `anchor-has-content` in `ui/pagination.tsx:48` are shadcn
  forwardRef wrappers that receive children from the call site, and the
  `no-redundant-roles` hits in `ui/accessible-table.tsx` look like a deliberate choice
  in a file named for the purpose.

### Checked and sound

- Every `<img>` in `src` has an `alt` attribute. The single apparent miss in
  `auth/MFAEnrollment.tsx:90` is the word `<img>` inside a code comment.
- `src/components/Navigation.tsx:119` reports as a static element with a click handler,
  but it is the mobile menu backdrop and the keyboard path is already there: Escape is
  handled at `:85` with a cleaned-up listener, and the toggle at `:200` carries both
  `aria-label` and `aria-expanded`. False positive.
- Mobile CSS holds up against what `CLAUDE.md` asks for: `src/index.css` has 11
  occurrences of 44px minimum touch targets, `safe-area-inset` and `100dvh`, plus two
  `prefers-reduced-motion` blocks, one of which kills `animate-bounce`, `animate-spin`
  and `animate-pulse` outright.
- `LoadingSpinner` carries `role="status"`, `aria-busy` and an sr-only label, and after
  the area A pass every loading state in the app routes through it.

## F. Performance

Nothing fixed in this pass. The one substantive finding needs a build investigation
rather than a config guess, and an attempted fix was measured and backed out.

### The entry chunk drags in 337 kB gzip of vendor code the homepage never uses

The built entry statically imports six vendor chunks, and `dist/index.html`
modulepreloads all six. Two of them have no business there:

- `charts-vendor` - 403.30 kB raw, 109.34 kB gzip. The entry imports exactly one
  symbol from it (`import{c as Lf}from"./charts-vendor-*.js"`).
- `three-vendor` - 849.11 kB raw, 228.52 kB gzip. The entry imports two symbols.

Neither package is reachable from the eager graph in source. `Interactive3DOrb` is
lazy at `src/pages/Index.tsx:27`, and every recharts consumer (`RevenueChart`,
`AmazonAffiliateStats`, `FinancialOverview`, `AIBillingTracker`, `ui/chart.tsx`,
`AmazonPriceTracker`) sits behind the lazily loaded admin dashboards. So these are
shared transitive helpers that Rollup placed inside those named chunks; reaching them
now costs the whole chunk. Because the imports are static, the browser must fetch both
before the entry can execute.

This also contradicts what `CLAUDE.md` claims for the architecture ("Three.js
lazy-loaded only when needed", "Main bundle ~45KB gzipped"). The main bundle is
177.63 kB gzip.

Resolved. A throwaway Rollup plugin walking the entry chunk's module graph named the
cause exactly: `clsx` had been absorbed into `charts-vendor`. It is about 500 bytes and
is imported by `src/lib/utils.ts` (the `cn()` helper, used by nearly every component)
and by `class-variance-authority`, so the entry hard-depended on 403 kB of recharts to
reach it. `three-vendor` was reached the same way, through Vite's `preload-helper` and
react-dom's commonjs shim.

The object form of `manualChunks` let Rollup place those shared micro-modules inside
whichever vendor chunk referenced them first. Switching to a path-matching function form
alone does not fix it - anything left unassigned is still Rollup's choice, and it keeps
choosing the big chunks. The fix is to name the shared utilities explicitly:
`clsx`, `class-variance-authority` and `tailwind-merge` into a `utils-vendor` chunk, and
`vite/preload-helper` into `vite-helpers`.

Measured on the built output and then in Chromium against `vite preview`:

|                                    | before                            | after                                 |
| ---------------------------------- | --------------------------------- | ------------------------------------- |
| entry chunk                        | 589.05 kB raw, 177.63 kB gzip     | 490.94 kB raw, 142.28 kB gzip         |
| `main bundle` (size-limit, brotli) | 150.2 kB                          | 118.68 kB                             |
| `charts-vendor` on the homepage    | fetched (109.21 kB gzip)          | never fetched                         |
| `three-vendor` on the homepage     | fetched up front (226.32 kB gzip) | fetched on demand when the orb mounts |

The browser run confirms the behaviour rather than just the byte counts: React mounts
with no page errors, the hero still renders its canvas, the `Interactive3DOrb` chunk and
`three-vendor` load only when the orb does, and `charts-vendor` is never requested. All
four size-limit budgets still pass.

Correcting an earlier note in this document: the first attempt was reported as having
removed all six `modulepreload` hints from `index.html`. That was a bad grep - the tags
read `rel="modulepreload" crossorigin href=`, and the pattern used expected
`modulepreload" href=`. The hints were never lost. Reverting that attempt was still
right, for the real reason: it shrank the entry without removing either heavy
dependency, because it never assigned `clsx`.

### react-syntax-highlighter no longer loads with every article

`MarkdownRenderer.tsx:4` imported the full Prism build, roughly 200 language
definitions, at module scope. It was most of `markdown-vendor`, so every article page
paid about 780 kB raw for it whether or not the article held a single fenced code block.

Split rather than narrowed, so no language coverage is lost. The highlighter moved to
`src/components/article/CodeBlock.tsx`, which `MarkdownRenderer` now pulls in through
`React.lazy`. The Suspense fallback renders the same code in a plain `<pre><code>`, so
the text is on screen from the first paint and is replaced by the highlighted version
when the chunk arrives - nothing is hidden while it loads.

The lazy import alone would not have helped: `manualChunks` grouped
`react-syntax-highlighter` with `react-markdown`, which any article needs, so the
highlighter would have been dragged in eagerly regardless. It now has its own
`syntax-vendor` chunk.

|                                   | before                        | after                                            |
| --------------------------------- | ----------------------------- | ------------------------------------------------ |
| `markdown-vendor`                 | 790.85 kB raw, 271.54 kB gzip | 157.35 kB raw, 47.70 kB gzip                     |
| highlighter                       | inside `markdown-vendor`      | `syntax-vendor`, 633.51 kB raw, loaded on demand |
| `markdown-vendor` budget (brotli) | 218.23 kB of 240 kB, 91%      | 41.82 kB of 60 kB                                |

Verified by the built graph: the only static importer of `syntax-vendor` is the
`CodeBlock` chunk, which is itself only reachable through a dynamic import.
`src/components/__tests__/MarkdownRenderer.codeblock.test.tsx` covers the behaviour -
the code text is present before the chunk resolves, per-token highlighting appears
after it, and prose without a fence is untouched.

Budgets in `package.json` were retuned to match: `markdown-vendor` from 240 KB to
60 KB, since a limit five times the chunk would catch nothing, and a new 240 KB budget
covers `syntax-vendor`.

### Fixed: @babel/runtime was dragging three.js into unrelated chunks

Splitting the highlighter exposed the same absorption bug found earlier with `clsx`.
`CodeBlock` came out of the first build with a bare `import "./three-vendor.js"`, which
would have put 843 kB of three.js on any article page containing a code block. The
cause was `@babel/runtime`, which many libraries emit calls into and which had been
absorbed into `three-vendor`. Pinning it to `utils-vendor` alongside `clsx` removed the
edge.

### Still open: six admin chunks bare-import three-vendor

`AIToolsManager`, `AccountingDashboard`, `AmazonPipelineManager`, `ArticleManager`,
`CommandCenterDashboard` and `ProjectManager` each carry a side-effect-only
`import "./three-vendor.js"`, so opening any of them fetches 843 kB of three.js that
none of them render. This predates the highlighter work and was not introduced by it.

A module-graph scan finds no direct edge from any module in those chunks into
`three-vendor`, so this is Rollup chunk-level bookkeeping rather than a stray shared
module of the kind `clsx` and `@babel/runtime` turned out to be. It needs more than the
scan that resolved those two, so it is recorded rather than guessed at.

### Budgets are close to their ceilings

All four pass, two with little room: `three-vendor` 186.53 kB of 200 kB (93%),
`markdown-vendor` 218.16 kB of 240 kB (91%). `main bundle` 150.2 kB of 250 kB and
`react-vendor` 47.34 kB of 50 kB (95%). A single dependency bump could turn CI red.

### Checked and sound

- Route splitting. Every page except the homepage is lazily imported; the largest
  route chunks are `AccountingDashboard` at 50.64 kB gzip and `SupportTicketDashboard`
  at 14.40 kB.
- React Query defaults at `src/App.tsx:64` are deliberate and sensible: 5 minute
  `staleTime`, 10 minute `gcTime`, `retry: 1`, `refetchOnWindowFocus: false`.
- Polling is bounded and documented. `refetchInterval` appears seven times, all on
  admin or status views at 60 seconds or 5 minutes. React Query does not refetch on an
  interval while the tab is unfocused, so a backgrounded admin tab is not polling.
- React Query DevTools are behind `import.meta.env.DEV` (`src/App.tsx:13`), so the
  dynamic import is statically dropped from production.
- Production builds emit no source maps unless they are being uploaded to Sentry and
  deleted afterwards (`vite.config.ts:95`).

## G. Data layer

Cross-checked every `.from('...')` in `src` and `supabase/functions` (83 distinct
names) against the 74 tables in `src/integrations/supabase/types.ts` and against the
tables the migrations actually create.

### Fixed: security_events did not exist, and its absence disabled the login rate limit

Eleven call sites read from or write to `security_events` and no migration ever created
it.

The audit rows are the smaller half of this. `checkRateLimit` in
`supabase/functions/admin-auth/index.ts:104` counts recent `login_failure` rows for an
IP address to throttle admin logins, and on a query error it deliberately fails open:

    if (error) {
      console.error('Rate limit check failed:', error);
      // Fail open if DB check fails (allow the attempt)
      return true;
    }

With the table absent every count errors, so the branch that returns `false` was
unreachable and the brute-force guard has never engaged. `admin-auth` is in
`PUBLIC_FUNCTIONS` (`danpearson-edge-functions/server.ts:81`), so it is reachable
without a token by design - which is correct for a login endpoint and is exactly why
the throttle matters. The lockout-notification check at `:451` runs the same query and
returns `false` on error, so no lockout email has ever been sent either, and
`recordFailedAttempt` at `:127` swallows its insert failure, so nothing was recorded to
notice the gap.

`supabase/migrations/20260901000002_create_security_events.sql` creates the table with
the union of all six writers' columns, an index on
`(event_type, ip_address, created_at DESC)` to serve exactly the rate-limit and lockout
queries, and RLS: admin-only reads, since the rows carry emails, IPs and user agents;
INSERT for the `authenticated` role so `SecurityAuditContext` and `error-alerting` keep
working from the browser while an anonymous caller cannot poison the audit trail. The
security-critical writers hold the service role and bypass RLS regardless. Written with
`IF NOT EXISTS` and `DROP POLICY IF EXISTS` so it is safe whether or not the table was
ever created by hand outside the migration history.

`ip_address` is `text` rather than `inet` because `admin-auth` records the literal
string `'unknown'` when it cannot resolve a client address.

### The reason this class of bug survives: the client is untyped

`src/integrations/supabase/client.ts:150` calls `createClient(...)` with no `Database`
generic. Every `.from()` therefore accepts any table name and every column comes back
as `any`. `types.ts` is 4,028 lines of generated types that constrain nothing at the
query layer - the `Tables<'articles'>` helper is used for component props in 12 files,
and that is all it does.

That is how `security_events` survived across eleven call sites, and it is the same
hole that let `_shared/ai-helper.ts` query `api_key_env_var` and `is_lightweight` -
columns that exist in no migration and no generated type - until commit 8ed5673 caught
it by reading the code.

Adding the generic is the fix, and it is a project rather than a one-line change: it
would immediately fail typecheck on the 15 table names below. Recommended as its own
piece of work, because until it lands nothing mechanical will catch the next one.

### Generated types are stale by 14 tables

These exist in the migrations and are queried by code, but are absent from `types.ts`:
`accounting_documents`, `achievements`, `amazon_price_alerts`, `amazon_price_history`,
`amazon_price_stats`, `case_studies`, `certifications`, `faqs`, `media_assets`,
`media_folders`, `page_visits`, `traffic_rules`, `trusted_devices`, `work_experience`.

`CLAUDE.md` is right that this file must be regenerated rather than hand-edited, so
that is the action here - and it now also needs to pick up `security_events`. Nothing
in `package.json` regenerates it, so it happens only when someone remembers.

### Checked and sound

- Every one of the 83 referenced table names other than `security_events` exists in
  the migrations. The apparent hits on `accounting`, `admin` and `x` were scan
  artifacts: `x` comes from a doc comment in `src/test/mocks/supabase.ts:38` and the
  other two have no call sites at all.
- All 82 tables have RLS enabled, as recorded in area D.

## E2. The label pass

The 49 `label-has-associated-control` warnings turned out to be three different bugs
sharing one rule, which is why a single mechanical rewrite would have been wrong.

**14 were not form controls at all.** `admin/ActivityLogViewer.tsx` (12) and
`support/TicketDetailView.tsx` (2) used `<label>` to style a read-only caption above a
`<p>` or `<pre>` holding a value. There is no control to associate. They are now
`<span>`, which is the same `display: inline` default, so nothing moved on screen.

**30 were real controls with no association.** A native `<label>` sitting beside an
`Input`, `Textarea` or Radix `Select`, with no `htmlFor` and no `id`, across
`TaskFormDialog` (13), `KnowledgeBaseManager` (6), `ProjectsManager` (5),
`CannedResponseManager` (4) and two others. Each now gets `htmlFor` and a matching
`id`, built from `useId()` so a component rendered twice on one page cannot collide -
which a static id would not survive. For Radix `Select` the id goes on `SelectTrigger`,
since the root renders no focusable element.

**5 needed hand work.** Two `Select` fields in `TicketDetailView` put their
`SelectTrigger` past an inline `onValueChange` body, further than the scan window; a
`Switch` in `KnowledgeBaseManager:370` sits before its label rather than after; and
`AITaskGeneratorDialog:246` separates its label from its `Textarea` with a header row
holding a Paste button.

**1 was already correct.** `BulkImportDialog:303` wraps a hidden
`<input type="file">` in a `<label>` - the standard styled-upload pattern, associated by
nesting. jsx-a11y misses it because the label's text lives inside `Button > span`,
deeper than the rule's default depth of 2. Annotated with a disable and the reason
rather than rewritten.

`npm run lint` goes from 391 to 342 warnings, still 0 errors, with
`label-has-associated-control` at zero.

`src/components/admin/tasks/__tests__/TaskFormDialog.test.tsx` covers it:
`getByLabelText` resolves a label to its control only through a real association, so all
six assertions fail against the previous code and pass against this one. One of them
checks that two mounted instances share no ids, which is what pins the `useId` choice.

Worth recording: the first version of that test queried the render container and passed
for the wrong reason. Radix renders the dialog through a portal into `document.body`, so
the container held no labels at all and "no unassociated labels" was vacuously true. The
test now queries `document.body` and asserts it found labels before judging them.

## E3. control-has-associated-label

Audited all 17 reports individually rather than treating the count as a backlog.
Fourteen were false positives on correct code, two were real, and one was the file
input already handled in the label pass.

### Fixed: three controls with no accessible name

- `src/components/AccessibilityWidget.tsx:336`. A `<button role="switch">` named by a
  `<label htmlFor>`. `button` is a labelable element, so that is valid HTML, but the
  button's only child is `aria-hidden`, leaving no content to name it, and naming a
  button through `label[for]` is handled inconsistently across browsers. It now carries
  `aria-labelledby` pointing at the label's id, which is unambiguous everywhere. This is
  the accessibility widget itself, so it is the one place where getting this wrong is
  most pointed.
- `src/components/admin/MediaLibrary.tsx:746`. A `<video controls>` preview with no
  name, sitting next to an `<img>` that does set `alt`. Now takes the same
  `alt_text || original_name`.
- `src/components/admin/tasks/BulkImportDialog.tsx:341`. The hidden file input inside
  the styled upload label. The label pass had annotated it with an eslint-disable
  because the association was by nesting only. Giving the input an id and the label a
  matching `htmlFor` makes the association explicit, satisfies both rules, and let the
  disable comment come back out.

### Rule turned off, with the audit behind it

The remaining 14 are all `<input id="is_active" />` beside `<Label htmlFor="is_active">`
across the accounting managers, `AIModelConfigManager`, `AmazonReportImporter`,
`DocumentUpload` and `Showcase.tsx:816`. Each was checked by resolving the control's
`id` against an `htmlFor` in the same file; all 14 resolve.

`control-has-associated-label` inspects an element's own subtree and cannot follow
`htmlFor` to a sibling id, so this pattern - the correct one, and the dominant one here -
will always report. It is now off, with the reasoning recorded in `eslint.config.js`
next to the rule. Mapping `Label` through the jsx-a11y `components` setting was tried
first and is worse, not better: it takes the count from 16 to 281, because every
`<Input>` then counts as a native input needing a label the rule still cannot resolve.

`npm run lint` goes from 342 to 325 warnings, still 0 errors.

## E4. Keyboard interaction

Twenty-one reports across `click-events-have-key-events`,
`no-static-element-interactions` and `no-noninteractive-element-interactions`. Six were
controls a keyboard could not reach, two of those hiding a separate bug; the rest were
presentational or load-event noise.

### Fixed: six controls that only a mouse could operate

- `admin/support/SupportTicketInbox.tsx:456-486`. The five stat tiles above the inbox
  (Open, In Progress, Waiting, Active, Archived) set the status filter on click. They
  were `<div>`s: no role, no tab stop, no key handler, so the filters could not be
  reached without a mouse. They are `<button type="button">` now, each with an
  `aria-label` saying what it filters to, since the visible text is just a count and a
  one-word noun.
- `admin/support/SupportTicketInbox.tsx:601`. The ticket row body, which opens a ticket
  on click. It holds no interactive descendants, so it became a button directly.

### Fixed: two decorative controls that did nothing

Both surfaced from chasing the warnings rather than from the rule itself.

- `admin/MediaLibrary.tsx:343`. The per-asset `<Checkbox>` had `checked={isSelected}`
  and no `onCheckedChange`. It was painted state, not a control: selection worked only
  through the card's click handler, so keyboard users could not select an asset at all.
  It now has `onCheckedChange`, an `aria-label` naming the asset, and a
  `stopPropagation` on its own click so a pointer click does not also fire the card
  handler and cancel itself. The card keeps its click as a larger pointer target, with
  a disable and the reason: it contains a control, so it cannot become a button.
- `admin/support/TicketDetailView.tsx:781`. Each AI-suggested response rendered a
  "Use This Response" `<Button>` with no `onClick` at all, inside a `<div>` that
  carried the real handler. The button looked actionable and was not, and the card was
  unreachable by keyboard. The card is now the `<button>`, and the inner one uses
  `asChild` over a `<span>` so it keeps its styling without nesting a button in a
  button - the same trick `BulkImportDialog` already uses.

### Rule narrowed rather than switched off

`no-noninteractive-element-interactions` counts `onLoad` and `onError` among its default
handlers, so every lazy-loaded `<img>` tracking its own load state trips it -
`OptimizedImage.tsx:156` and `PerformanceOptimized.tsx:41`. Those are not user
interactions and carry no keyboard expectation. The rule now lists only the pointer and
key handlers, so it still reports a real click on a non-interactive element.

### Two presentational cases, one of which improved

`Navigation.tsx:119` is the mobile menu backdrop. Escape is already handled at `:85` and
the toggle carries `aria-expanded`, so the keyboard path exists. Marking it
`aria-hidden="true"` is what it should have been anyway - it is decoration behind the
menu - and that alone satisfied both rules, so the disable that was drafted for it came
straight back out.

`LazyVideo.tsx:261` reveals its custom controls on hover and focus. The container is not
a control; the video inside it takes focus. Annotated with the reason.

### Coverage

`src/components/admin/support/__tests__/SupportTicketInbox.test.tsx` asserts each stat
filter resolves by button role and accessible name and is a real `BUTTON` element. All
six assertions fail against the previous divs.

`npm run lint` goes from 325 to 304 warnings, still 0 errors. No `jsx-a11y` interaction
warnings remain; what is left is 4 `no-redundant-roles`, 3 `no-autofocus`, 2
`media-has-caption`, 2 `heading-has-content` and 1 `anchor-has-content`, all previously
assessed as deliberate choices or shadcn wrapper false positives.
