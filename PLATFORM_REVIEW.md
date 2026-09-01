# Platform review

Running deep-dive review of pearson-style-showcase against the standards in `CLAUDE.md`.
Each pass takes one area, records findings with `file:line`, fixes what is safe and in
scope, and leaves judgement calls for Dj. Verified with `npm run typecheck`,
`npx vitest run`, `npm run lint` and `npm run build` before each commit.

## Areas

| #   | Area                                                                               | Status          |
| --- | ---------------------------------------------------------------------------------- | --------------- |
| A   | UI, layout and design-system consistency                                           | first pass done |
| B   | Frontend correctness: routing, data fetching, loading/error states, effect cleanup | not started     |
| C   | Edge functions: auth, input validation, error handling, secrets                    | not started     |
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
