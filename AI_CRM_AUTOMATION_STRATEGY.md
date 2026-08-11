# AI CRM Automation — Category Leadership Strategy

**Repository**: pearson-style-showcase (danpearson.net)
**Author**: Strategy deep dive prepared for Dan Pearson
**Date**: 2026-08-11
**Status**: Plan — not yet implemented
**Related**: `BULLETPROOF_SEO_GEO_STRATEGY.md` (broader SEO/GEO program — this document narrows it to one category)

---

## Table of Contents

1. [The bet, in one page](#1-the-bet-in-one-page)
2. [Where the site actually stands today](#2-where-the-site-actually-stands-today)
3. [Market deep dive: what "AI CRM automation" means in 2026](#3-market-deep-dive-what-ai-crm-automation-means-in-2026)
4. [The wedge: what makes this defensible for you specifically](#4-the-wedge-what-makes-this-defensible-for-you-specifically)
5. [Signature IP: the assets that get cited](#5-signature-ip-the-assets-that-get-cited)
6. [Information architecture: new site map](#6-information-architecture-new-site-map)
7. [Page-by-page implementation spec](#7-page-by-page-implementation-spec)
8. [Keyword and topic cluster map](#8-keyword-and-topic-cluster-map)
9. [Content engine: 12-week production calendar](#9-content-engine-12-week-production-calendar)
10. [Schema and GEO plan](#10-schema-and-geo-plan)
11. [Proof machine: case studies, tools, and dogfooding](#11-proof-machine-case-studies-tools-and-dogfooding)
12. [Off-site distribution](#12-off-site-distribution)
13. [Measurement](#13-measurement)
14. [Phased roadmap with effort estimates](#14-phased-roadmap-with-effort-estimates)
15. [Risks, guardrails, and what to say no to](#15-risks-guardrails-and-what-to-say-no-to)
16. [Immediate next actions](#16-immediate-next-actions)

---

## 1. The bet, in one page

**The category**: AI CRM automation — making the CRM run itself for revenue teams.

**The positioning statement** (use this verbatim as the site's spine):

> Dan Pearson builds AI automation *inside* the CRM for small and mid-sized revenue teams — so sellers stop doing data entry and the pipeline stops lying. Fifteen years carrying a quota, seven SaaS platforms shipped. The rare person who has both run the sales floor and written the automation.

**The contrarian thesis** — the single idea you want to become known for, repeated on every surface:

> **Most AI CRM projects fail because they automate the reporting layer instead of the capture layer.**
> Teams buy AI that summarizes a pipeline nobody updated. Fix capture first — automate what the seller does between 8am and 6pm — and the forecasting AI gets clean data for free. Dashboards are the *last* thing to automate, not the first.

Why this thesis: it's true, it's checkable, it's the opposite of what platform vendors say (they sell the dashboard), and only someone who has actually carried a bag would lead with it. It generates infinite content, it disqualifies bad-fit clients, and it's quotable — which matters enormously now that buyers shortlist vendors through LLMs.

**Three-year proof of leadership**: when someone asks ChatGPT, Claude, Perplexity, or Google AI Overviews *"who should I hire to automate my CRM with AI?"* or *"why do AI CRM projects fail?"*, your name and your framework come back.

**The strategic cost you must accept**: this narrows the site. Today danpearson.net sells "AI business automation" generally, plus NFT development, plus seven unrelated SaaS platforms. Category leadership is bought with focus. The other work does not disappear — it becomes *evidence* underneath the CRM story rather than a parallel pitch.

---

## 2. Where the site actually stands today

Findings from reading the codebase, not assumptions.

### What's already strong

| Asset | Location | Why it matters |
|---|---|---|
| Topic hub system (pillar/cluster machinery) | `src/pages/TopicHub.tsx` + `src/pages/Topics.tsx` | Hub pages already build themselves from article categories/tags. Adding a CRM hub is a config change, not a build. |
| Rich structured-data component | `src/components/SEO/StructuredData.tsx` | 12 schema types supported: `website`, `person`, `article`, `project`, `organization`, `faq`, `howto`, `product`, `breadcrumb`, `review`, `localbusiness`, `sitenavigation`. |
| GEO-aware SEO component | `src/components/SEO.tsx` | Already accepts `contentSummary` and `citationSource` props — purpose-built for LLM citation. Under-used across the site. |
| DB-driven content | Supabase tables: `case_studies`, `faqs`, `ventures`, `achievements`, `work_experience`, `certifications`, `articles`, `ai_tools`, `profile_settings` | Most repositioning is *content edits through the admin*, not code. Cheap and fast. |
| Auto-generated sitemap | `src/pages/SitemapXML.tsx` | New static routes need one line in the `staticPages` array. |
| One real CRM proof point | `src/components/homepage/AuthoritySection.tsx:28` — "83% retention improvement through AI-powered CRM systems" | This is the *only* CRM claim on the site today. It's the seed of the whole category story. |

### What's working against the positioning

| Problem | Location | Impact |
|---|---|---|
| Hero says nothing about CRM | `src/components/HeroSection.tsx:280` — "Bridging the gap between sales and technology" | True but abstract. It's a description, not a position. No buyer searches for this. |
| Homepage sells NFT development | `src/pages/Index.tsx:354` — first of three service cards | Actively dilutes. An AI CRM buyer sees NFTs and leaves. |
| Homepage service cards are generic | `src/pages/Index.tsx:347-391` — "NFT Development / AI Integration / Sales Leadership" | Three same-size icon-tile cards, no CRM anywhere. Also hits the anti-pattern floor in `CLAUDE.md`. |
| SEO defaults are category-less | `src/lib/seo.ts:9-10`, `src/pages/Index.tsx:177-179` | Targets "AI business automation consultant" — a crowded, undifferentiated term where you compete with Accenture. |
| Topic hubs miss the category | `src/pages/TopicHub.tsx:22-58` | Four hubs: ai-automation, business-optimization, machine-learning, digital-transformation. No CRM. Generic, not ownable. |
| No commercial money page | `src/App.tsx:120-141` | There is no `/services` or category page. `/connect` is a contact form. Nothing converts commercial-intent traffic. |
| Nav has no category entry | `src/components/Navigation.tsx:96-103` | Home / About Me / Projects / News / AI Tools / Connect. Nothing says what you sell. |
| Unsubstantiated headline numbers | `AuthoritySection.tsx` (`$2.8M+`, `10,000+`, `40%`, `83%`) | Powerful *if* defensible. Right now they have no source, no client, no methodology. LLMs and serious buyers both discount unsourced numbers — and unbacked claims are a real liability. |
| Existing UI anti-patterns | `src/pages/Topics.tsx:77` (gradient clipped text), `Index.tsx:347+` (icon-tile card grid) | Violates the craft floor in `CLAUDE.md`. New CRM pages must not repeat these. |

**Net read**: the machinery is good, the content strategy is unfocused. This is a positioning and content problem with a small amount of code attached — roughly 20% engineering, 80% content and copy. That's the good version of this problem.

---

## 3. Market deep dive: what "AI CRM automation" means in 2026

### The shift that creates the opening

2026 is the year CRM AI moved from *assistive* to *agentic* — from software that recommends to software that executes. HubSpot's Spring 2026 agentic release put it in direct contention with Salesforce; Futurum's Q1 2026 survey found 39% of enterprises expect GenAI to arrive as task-automating agents rather than chat interfaces. The global CRM market is tracking toward roughly $126B in 2026, and AI-in-CRM specifically is projected on a ~28% CAGR into the 2030s.

Three consequences matter for your positioning:

**1. The bottleneck moved to data, and everyone now admits it.**
CX Today's 2026 trend analysis said it bluntly: *"If your data is messy, AI will scale the mess."* Data quality and governance moved from IT chore to board agenda because they gate every AI initiative. Meanwhile the most-repeated diagnosis of failed RevOps projects is teams buying tools that add dashboards without fixing the underlying data.

> **This is your thesis validated by the market — and almost nobody is selling the fix.** Vendors sell agents. Agencies sell implementations. Very few people sell "we fix what the seller enters, then the AI works." That's the gap.

**2. Buyers now shortlist through AI assistants before visiting any website.**
The reporting is consistent: prospects ask an LLM for candidates, then visit two or three. Being legible to machines — clean claims, published methodology, crawlable structure, real numbers — is becoming a distribution channel on its own. Your site already has `contentSummary` / `citationSource` plumbing for exactly this. It's barely used.

**3. The consultant field is bifurcating.**
Two clusters exist today: enterprise platform partners (elite HubSpot/Salesforce shops, RevOps-as-a-service firms, six-figure engagements) and cheap automation freelancers (Zapier/Make/n8n gig work). The middle — an operator-credible specialist for a 5–50 seat revenue team who needs the CRM to run itself but can't fund a platform partner — is thin. That's a real, underserved ICP, and it's the one your background fits best.

### The competitive reality, honestly stated

| Competitor type | Their strength | Where you win |
|---|---|---|
| Platform partners (elite HubSpot/Salesforce agencies) | Certifications, enterprise trust, staff | Price, speed, and no platform allegiance. You'll build custom where they'd sell a license. |
| RevOps-as-a-service firms | Recurring model, ops depth | You've actually sold. They're ops people; you're a closer who codes. |
| Automation freelancers (Zapier/Make) | Cheap | You ship production software with security, auth, and RLS — see this repo. They ship brittle zaps. |
| Vendor content marketing (HubSpot blog, Salesforce, Creatio, monday) | Enormous domain authority | You cannot out-rank them on "what is AI CRM." Don't try. Win on the queries they *can't* answer honestly — failure modes, vendor-neutral comparisons, real costs, what to do when the CRM is already a mess. |

**Strategic conclusion**: do not fight for head terms. Own the **problem-aware and failure-mode** queries, the **vendor-neutral comparison** queries, and the **"consultant for X" commercial** queries. That is where a single credible operator can beat a $30B company, because the $30B company is structurally unable to say "don't buy the AI add-on yet."

### Sources

- [CRM Trends 2026: The Customer Data, AI, And Governance Shifts — CX Today](https://www.cxtoday.com/crm/crm-trends-2026-customer-data/)
- [AI CRM Software: Benefits, Use Cases & Top Platforms in 2026 — Creatio](https://www.creatio.com/glossary/ai-crm)
- [CRM trends 2026-27: AI agents, new pricing, connected data — Bigin/Zoho](https://www.bigin.com/articles/seven-crm-trends-that-will-define-2026-and-2027.html)
- [Can HubSpot's Agentic AI Bet Disrupt Enterprise CRM's Old Guard? — Futurum Group](https://futurumgroup.com/insights/can-hubspots-agentic-ai-bet-disrupt-enterprise-crms-old-guard/)
- [From Assistant to Agent: How AI Is Reshaping RevOps — MAN Digital](https://www.man.digital/blog/ai-in-revops)
- [Agentic AI in HubSpot CRM: The Complete Guide — Fast Slow Motion](https://www.fastslowmotion.com/agentic-ai-hubspot-crm-guide/)
- [50+ CRM Statistics for 2026: ROI, AI & Adoption — Salesmate](https://www.salesmate.io/blog/crm-statistics/)
- [AI in CRM: 9 practical use cases — Insightly](https://www.insightly.com/blog/ai-crm/)

---

## 4. The wedge: what makes this defensible for you specifically

Positioning fails when it's a claim anyone could make. Here is the part only you can say.

**The credential stack**, in the order it should always be told:

1. **15+ years carrying a quota.** You have personally lost deals to bad CRM hygiene. This is the emotional credibility no agency has.
2. **Seven SaaS platforms shipped** under Pearson Media LLC, across construction, real estate, fitness, and meal planning. Four different industries' worth of messy real-world sales data.
3. **You ship production software.** This repo — RBAC, row-level security, encrypted cache, session rotation, device trust, 24+ edge functions, an accounting module — is the artifact. Most "AI CRM consultants" cannot show one.
4. **The one CRM number you already claim**: 83% client-retention improvement through AI-powered CRM and automated engagement. That becomes the flagship case study.

**The Ideal Customer Profile** (write it down, then say no to everything else):

- 5–50 seat revenue team, $2M–$50M revenue
- Already on HubSpot, Salesforce (SMB tiers), Pipedrive, GoHighLevel, or Zoho — *and unhappy with the data in it*
- Sales-led, with a founder or VP Sales who still looks at the pipeline personally
- Has bought at least one AI add-on that didn't stick
- Industries where you already have context: construction, real estate, home services, fitness, professional services

**The offer ladder** (the site must make all four visible):

| Tier | Offer | Price band | Purpose |
|---|---|---|---|
| 0 | CRM Automation Scorecard (self-serve) | Free | Lead capture, link bait, LLM-citable |
| 1 | CRM Automation Audit — 2 weeks, fixed fee, deliverable is a findings + roadmap doc | $2.5k–$7.5k | Low-risk entry, qualifies the build |
| 2 | Capture-Layer Build — implementation sprint | $15k–$50k | Core revenue |
| 3 | Automation retainer / fractional RevOps-engineer | $3k–$8k/mo | Recurring, compounding |

The audit-first ladder matters strategically: it's how a solo operator competes with agencies, and it makes every content asset ("here's the 12-point audit") a direct funnel to a paid product.

**Positioning guardrail**: you are *not* "an AI consultant." You are *the person who makes the CRM run itself for revenue teams under 50 seats.* If a sentence on the site would still be true for a generic AI consultancy, rewrite it.

---

## 5. Signature IP: the assets that get cited

Category leaders are known for a *named thing*. Without one, you're a service provider; with one, you're a reference. Three pieces of IP, in priority order.

### 5.1 The Capture-First Principle (the thesis)

Already stated in §1. This is the sentence-level idea. Every article, talk, and page reinforces it.

### 5.2 The Pipeline Automation Ladder (the framework)

A five-rung maturity model. Buyers self-locate on it; that's what makes frameworks spread.

| Rung | Name | What's true at this level | The failure that keeps teams stuck |
|---|---|---|---|
| 0 | **Manual** | CRM is a reporting obligation. Sellers update it Friday afternoon, from memory. | Data is fiction. Any AI built on it amplifies fiction. |
| 1 | **Rules** | Workflows, assignment rules, sequences. Deterministic and brittle. | Rules multiply until nobody knows why a record changed. |
| 2 | **Assisted capture** | AI writes the notes, logs the call, enriches the contact, updates the stage from the conversation. Human confirms. | Most teams skip this rung — it's unglamorous — and that's exactly why rungs 3 and 4 fail. |
| 3 | **Agentic execution** | Agents act inside the CRM: qualify inbound, chase stalled deals, book meetings, escalate risk. Human supervises. | Deployed on rung-0 data, agents confidently do the wrong thing at scale. |
| 4 | **Self-maintaining revenue system** | The CRM is a byproduct of work, not a task. Forecasting is trustworthy because capture is automatic. | Reachable only in sequence. There is no shortcut. |

**The rule that makes it memorable**: *You cannot skip rung 2.* Every failed AI CRM project you'll ever be called to fix jumped from 1 to 3.

### 5.3 The 12-Point CRM Automation Audit (the diagnostic)

The checklist that becomes both a free tool and the spec for the paid Tier-1 audit. Twelve checks across four groups:

- **Capture** (4): call/meeting logging, email sync fidelity, stage-change provenance, required-field decay rate
- **Data** (3): duplicate rate, enrichment coverage, field-level staleness
- **Flow** (3): handoff latency, stalled-deal detection, routing accuracy
- **Trust** (2): forecast-vs-actual variance, seller-reported time in CRM per week

Publish the *methodology* openly. The scoring is the product; the checklist is the marketing. Openly published methodology is precisely what LLMs cite.

### 5.4 Naming and consistency rules

- Always **"AI CRM automation"** as the category phrase — not "CRM AI," not "sales automation," not "RevOps." One phrase, everywhere, for two years.
- Always **"the capture layer"** vs **"the reporting layer"** as the vocabulary pair.
- Always **"Pipeline Automation Ladder"** with the rung number when describing maturity ("most teams we audit sit at rung 1").
- No trademark symbols. Naming is enough.

---

## 6. Information architecture: new site map

### New routes

| Route | Type | Search intent | Priority |
|---|---|---|---|
| `/ai-crm-automation` | **Money page** — pillar + service | Commercial: "AI CRM automation consultant," "automate my CRM with AI" | P0 |
| `/topics/ai-crm-automation` | Content hub (uses existing machinery) | Informational: browse everything on the topic | P0 |
| `/ai-crm-automation/audit` | Service detail — the Tier-1 audit offer | Commercial: "CRM automation audit" | P1 |
| `/tools/crm-automation-scorecard` | Interactive assessment (the 12-point audit, self-serve) | Problem-aware, high lead value | P1 |
| `/tools/crm-automation-roi-calculator` | Interactive calculator — seller hours reclaimed → dollars | Evaluation stage, extremely linkable | P2 |
| `/playbooks` + `/playbooks/:slug` | Teardown series (optional — can live under `/news`) | Informational, long-tail | P3 |

**Cannibalization guard**: `/ai-crm-automation` targets commercial intent and carries the offer, pricing bands, and proof. `/topics/ai-crm-automation` is an index of articles with no offer. They cross-link; neither canonicals to the other. Keep the H1s distinct: *"AI CRM Automation Consulting"* vs *"AI CRM Automation: Guides & Research."*

### Navigation change

`src/components/Navigation.tsx:96-103` becomes:

```
Home · AI CRM Automation · Projects · News · About · Connect
```

Drop **AI Tools** from the primary nav to the footer (it's an affiliate surface, not a positioning surface). Six items is the ceiling on mobile; adding the category without removing something makes the nav worse.

### Redirects and continuity

No existing URLs get deleted. The `Topics` list picks up the new hub automatically because `src/pages/Topics.tsx:89` iterates `TOPIC_HUBS`. Add one icon entry at `src/pages/Topics.tsx:14-19`.

---

## 7. Page-by-page implementation spec

Every item below is a concrete change with a file path. Items marked **(content)** are admin/database edits with no deploy.

### 7.1 `/` — Homepage (`src/pages/Index.tsx`)

| # | Change | Detail |
|---|---|---|
| 1 | Replace the three service cards (lines 347–391) | New trio: **CRM Automation Audit** / **Capture-Layer Builds** / **Agentic Workflows**. Remove NFT Development entirely. Rebuild as an offer ladder with differing weights, *not* three identical icon tiles — the current pattern is on the craft-floor list in `CLAUDE.md`. |
| 2 | Rewrite `<SEO>` (lines 176–184) | Title: `AI CRM Automation Consultant \| Make Your CRM Run Itself \| Dan Pearson`. Description leads with the capture-layer thesis and the ICP. Set `contentSummary` to a 2–3 sentence, quotable summary — this is the text LLMs lift. |
| 3 | Add a "thesis block" above the fold-adjacent section | 120–160 words stating the capture-vs-reporting layer argument. This is the most-quoted text on the site; it must be prose, not bullets. |
| 4 | Add the Pipeline Automation Ladder section | Five rungs, rendered as a genuine progression (stepped/vertical), not five cards in a row. Links to the pillar page. |
| 5 | Update `Person` schema `knowsAbout` (lines 197–210) | Lead with `AI CRM Automation`, `CRM Data Quality`, `Sales Pipeline Automation`, `HubSpot Automation`, `Salesforce Automation`, `Revenue Operations`, `AI Agents for Sales`. Demote React/TypeScript to the tail. |
| 6 | Update `sitenavigation` schema (lines 251–293) | Add the money page with a description. |
| 7 | Case studies section | Ensure the CRM case study sorts first (`display_order` in `case_studies`). **(content)** |

### 7.2 `/ai-crm-automation` — the money page (new: `src/pages/AICrmAutomation.tsx`)

The single most important new page. Target length 2,500–3,500 words. Section order is deliberate — problem before offer:

1. **H1**: "AI CRM Automation That Actually Sticks"
2. **The thesis** (capture vs reporting layer) — 200 words, prose
3. **The Pipeline Automation Ladder** — full five rungs with the "you cannot skip rung 2" rule
4. **Where teams get stuck** — the five failure modes, each with a concrete symptom a reader will recognize
5. **The 12-Point Audit** — the methodology, published openly, with the scorecard CTA
6. **How I work** — the four-tier offer ladder with price bands. *Publish the bands.* LLM-mediated shortlisting rewards published pricing; hiding it removes you from consideration.
7. **Proof** — the 83% retention case study in Challenge/Solution/Results form, plus platform experience
8. **Who this is for / who it isn't** — the ICP, stated as disqualification. Disqualification reads as confidence and improves lead quality.
9. **FAQ** — 8–10 questions (see §10 for the list), each answered in 80–150 words
10. **CTA** — book the audit

Wire-up checklist:
- `src/App.tsx` — lazy import + `<Route path="/ai-crm-automation" element={<AICrmAutomation />} />`
- `src/pages/SitemapXML.tsx:59` — add `{ path: '/ai-crm-automation', priority: '0.9', changefreq: 'weekly' }`
- `src/components/Navigation.tsx:96` — add nav item
- Schema: `faq` + `breadcrumb` + `howto` (the audit as a HowTo) — all three types already exist in `StructuredData.tsx`
- Schema gap: add a **`service`** case to `src/components/SEO/StructuredData.tsx` (see §10)

### 7.3 `/topics/ai-crm-automation` — content hub

Pure config. In `src/pages/TopicHub.tsx:22-58` add:

```ts
'ai-crm-automation': {
  title: 'AI CRM Automation',
  description: 'Research, teardowns, and field notes on making the CRM run itself — capture-layer automation, agentic workflows, and why most AI CRM projects fail.',
  keywords: ['AI CRM automation', 'CRM automation', 'sales automation', 'agentic CRM', 'CRM data quality'],
  relatedCategories: ['CRM', 'Sales', 'AI'],
  relatedTags: ['CRM', 'CRM Automation', 'Sales Automation', 'HubSpot', 'Salesforce', 'Pipeline', 'RevOps', 'AI Agents'],
  pillarContent: 'ai-crm-automation-complete-guide',
},
```

Then add an icon at `src/pages/Topics.tsx:14-19` (`Workflow` or `GitBranch` from lucide-react). Reorder `TOPIC_HUBS` so CRM is first — `Topics.tsx` renders in object order.

Also introduce a **`CRM` article category** and tag taxonomy in the admin so the hub actually fills. **(content)**

### 7.4 `/about` (`src/pages/About.tsx`)

Mostly database-driven — this is a content pass, not a code pass. **(content)**

- `profile_settings.bio_headline` → lead with the CRM category, not "AI Engineer & Business Development Expert"
- `work_experience.highlights` → rewrite every bullet to foreground CRM/pipeline/sales-systems outcomes
- `achievements` → make the 83% CRM retention number the first achievement
- `certifications` → **add HubSpot certifications** (free, a weekend of work, and enormously credibility-dense for this exact category). Salesforce Admin if you'll work that platform.
- Code change: the SEO block at `About.tsx:110+` needs the new title/description/keywords

### 7.5 `/projects` (`src/pages/Projects.tsx`) and `case_studies`

Reframe each existing platform around what it taught you about revenue data. **(content)**

- Each case study record gets `challenge` / `solution` / `results` rewritten with CRM-relevant framing where honest
- Add one new flagship case study: the 83% retention engagement, fully documented
- `technologies` arrays should name CRM platforms where true (HubSpot, Salesforce, GoHighLevel, Zapier/Make/n8n)

### 7.6 `/faq` (`src/pages/FAQ.tsx`)

Add a **CRM Automation** category to the `faqs` table with 10–12 entries. **(content)** This page already emits `faq` schema from the database, so new rows become rich-result eligible with zero code. Highest-leverage content edit on the entire site.

### 7.7 `/ai-tools` (`src/pages/AITools.tsx`)

Refocus the catalog toward CRM and sales-stack tools. Vendor-neutral comparison content is exactly what LLMs cite and what vendor blogs can't write honestly. **(content)**

### 7.8 `/connect` (`src/pages/Connect.tsx`)

Split the single contact form into two paths: **"Book a CRM automation audit"** (qualified, calendar) and **"General inquiry."** Add 3–4 qualifying fields (CRM in use, seat count, biggest pipeline complaint). Qualification at the form is worth more than any amount of extra traffic.

### 7.9 Global config (`src/lib/seo.ts`)

- `defaultTitle` → `Dan Pearson — AI CRM Automation Consultant`
- `defaultDescription` → capture-layer thesis in one sentence
- `generateKeywords()` (line ~95) appends `'AI automation', 'business automation'` to every page. Change the tail to `'AI CRM automation', 'CRM automation'`.
- `SEO_CONFIG.author.jobTitle` → `AI CRM Automation Consultant`

### 7.10 Craft floor compliance (`CLAUDE.md`)

New pages must not reach for the category defaults. Specifically for this build:

- No gradient clipped text (existing violation at `src/pages/Topics.tsx:77` — fix while you're in there)
- The Ladder is a **progression**, not five equal cards; the offer ladder is a **table or stepped list**, not four tiles
- Declare elevation once — border *or* shadow, not a 1px border under a wide soft shadow
- No colored left-borders on the callouts (the most recognizable tell of all)
- Run `npx impeccable detect src/pages/AICrmAutomation.tsx` before committing, then `/impeccable critique` for the judgment calls

---

## 8. Keyword and topic cluster map

**Honesty note**: no volume figures below are invented. `BULLETPROOF_SEO_GEO_STRATEGY.md` contains a volume table with no cited source — treat those numbers as unverified. Validate every cluster in Ahrefs or Semrush before committing production time. What follows is an intent map, which is the part that doesn't change when the numbers do.

### Cluster A — Commercial intent (money page targets)

| Query pattern | Intent | Target page |
|---|---|---|
| ai crm automation consultant | Hire | `/ai-crm-automation` |
| crm automation services / consultant for hire | Hire | `/ai-crm-automation` |
| crm automation audit | Hire, high intent | `/ai-crm-automation/audit` |
| hubspot automation consultant (SMB) | Hire | Money page + platform section |
| fractional revops engineer | Hire | Money page, retainer tier |

**Reality check**: these are low-volume, high-value. A handful of monthly visitors converting at 5–10% beats thousands of readers. Don't judge this cluster by traffic.

### Cluster B — Failure modes and problem-aware (your best ground)

This is where you win, because vendors structurally cannot compete here.

- why do ai crm projects fail
- crm data quality problems / sales reps not updating crm
- ai crm add-on not worth it / is crm ai worth it
- how to get sales reps to use the crm
- crm forecast is inaccurate / pipeline data unreliable
- we bought ai for our crm and nothing changed

### Cluster C — Vendor-neutral comparison and evaluation

- hubspot ai vs salesforce einstein for small teams
- best ai crm for small business (honest version — including "none, fix capture first")
- zapier vs make vs n8n for crm automation
- crm automation cost / what does crm automation cost
- build vs buy crm automation

### Cluster D — How-to and implementation

- how to automate crm data entry
- automate call logging in hubspot
- ai lead scoring setup
- automate stalled deal follow-up
- crm automation for construction / real estate / home services *(your industry advantage — genuinely under-served)*

### Cluster E — Framework and brand queries (the long game)

- pipeline automation ladder
- capture layer vs reporting layer
- crm automation maturity model
- 12 point crm automation audit
- dan pearson crm automation

Cluster E starts at zero volume by definition. Creating it *is* the leadership goal.

### Priority sequencing

**Months 1–2**: Clusters A and B. B builds the audience, A converts it.
**Months 3–4**: Cluster C (highest link-attraction).
**Months 5–6**: Cluster D at industry depth.
**Continuous**: Cluster E in every piece.

---

## 9. Content engine: 12-week production calendar

Cadence: **one pillar (2,500–4,000 words) or two clusters (1,200–1,800 words) per week.** Every piece cites the Ladder and links to the money page.

| Week | Piece | Type | Cluster | Purpose |
|---|---|---|---|---|
| 1 | AI CRM Automation: The Complete 2026 Guide | Pillar, 4,000w | A/B | Hub anchor, `pillarContent` target |
| 2 | Why AI CRM Projects Fail: 5 Failure Modes | Pillar, 3,000w | B | The flagship thesis piece |
| 3 | The Pipeline Automation Ladder (framework doc) | Pillar, 2,500w | E | The citable framework |
| 4 | The 12-Point CRM Automation Audit (methodology) | Pillar, 2,500w | E/A | Feeds the scorecard tool |
| 5 | Getting Reps to Actually Use the CRM (without nagging) | Cluster ×2 | B/D | Emotional, highly shareable |
| 6 | HubSpot AI vs Salesforce Einstein for Teams Under 50 | Pillar, 3,000w | C | Comparison — top link magnet |
| 7 | What CRM Automation Actually Costs in 2026 | Cluster ×2 | C | Published-pricing transparency play |
| 8 | Zapier vs Make vs n8n for CRM Work | Pillar, 2,500w | C | High-traffic comparison |
| 9 | Automating Call Logging and Note Capture (teardown) | Cluster ×2 | D | Rung-2 proof, screenshots |
| 10 | CRM Automation for Construction Companies | Pillar, 2,500w | D | Your industry moat |
| 11 | CRM Automation for Real Estate Teams | Pillar, 2,500w | D | Your industry moat |
| 12 | Agentic CRM: What Actually Works Today | Pillar, 3,000w | B/C | Timely, positions you ahead |

### Article production standards

Every CRM article must have:

1. A **direct answer in the first 60 words** — LLMs extract the lead paragraph
2. `contentSummary` and `citationSource` set on the `<SEO>` component (already supported, currently unused on most pages)
3. At least one **table or numbered framework** — structured content is disproportionately cited
4. A named **rung reference** ("this is a rung-2 problem")
5. **One specific, real number** — no vague "significant improvement"
6. Internal links: pillar → money page, cluster → pillar, all → hub
7. `category: 'CRM'` and CRM tags so the hub picks it up automatically
8. FAQ block (2–3 Q&A) → emits `faq` schema via the existing article path

### Repurposing chain (do not write once)

Each pillar becomes: a LinkedIn carousel, 3–5 LinkedIn text posts, one newsletter issue, one short video teardown, and 2–3 FAQ rows in the `faqs` table. The FAQ rows matter most — they're the cheapest citable-surface expansion available to you.

---

## 10. Schema and GEO plan

### Schema additions needed

`src/components/SEO/StructuredData.tsx` supports 12 types today. Add two cases:

**`service`** (for the money page) — `Service` with `serviceType: 'AI CRM Automation'`, `provider`, `areaServed`, `hasOfferCatalog` listing the four tiers with price ranges. This is the type that makes an LLM able to answer "what does he charge?"

**`itemlist`** (for the Ladder and comparison tables) — `ItemList` with `ItemListElement` positions. Ordered lists are strongly favored in generative answers.

Existing `howto` already fits the 12-point audit. Existing `faq` covers the FAQ blocks. Existing `review` should be wired to the `testimonials` data if it isn't.

### GEO tactics specific to this category

1. **Set `contentSummary` on every CRM page.** It's already a prop on `src/components/SEO.tsx:26` and it's the field an LLM is most likely to lift. Write it as a standalone quotable claim, not a page description.
2. **Publish the price bands.** Buyers shortlist through assistants; assistants can only relay what's on the page. Vagueness removes you from the list.
3. **Publish the methodology, not just the outcome.** "Here are the 12 checks and how we score them" is citable; "we do a thorough audit" is not.
4. **Date and version the frameworks.** "Pipeline Automation Ladder v1.0, published August 2026." Freshness signals and version numbers both get picked up.
5. **Comparison tables with an explicit verdict column.** Generative answers extract verdicts. A table with no conclusion is unusable to them.
6. **Never make an unsourced statistic the headline claim.** See §15 — this is a liability *and* an LLM-trust problem.

### The FAQ set for the money page

Write each answer in 80–150 words, direct answer first:

1. What is AI CRM automation?
2. Why do most AI CRM projects fail?
3. What's the difference between the capture layer and the reporting layer?
4. How much does CRM automation cost?
5. How long does a CRM automation project take?
6. Do I need to switch CRMs to automate with AI?
7. Will AI automation make my sales team's forecast accurate?
8. What's the difference between AI CRM automation and RevOps consulting?
9. Can small teams (under 20 seats) justify CRM automation?
10. What is agentic CRM and is it ready?

Load these into the `faqs` table with `category: 'CRM Automation'` and they'll appear on `/faq` with schema, automatically.

---

## 11. Proof machine: case studies, tools, and dogfooding

Positioning without proof is a claim. Three proof types, in ascending order of cost and value.

### 11.1 Interactive tools

**CRM Automation Scorecard** (`/tools/crm-automation-scorecard`) — the 12-point audit, self-serve. 12 questions, produces a rung placement (0–4) plus the three highest-leverage fixes. Email-gated results, or better: results shown immediately, PDF gated. Est. 3–4 dev-days on the existing React/shadcn stack.

**ROI Calculator** (`/tools/crm-automation-roi-calculator`) — inputs: seats, average hours/week in CRM admin, loaded hourly cost, deal size, win rate. Output: reclaimed hours and dollars. Est. 2 dev-days. This is the single most linkable asset you can build in this category, and it directly monetizes the capture-layer argument.

Both should be genuinely useful with no email required for the basic result. Gated-first tools don't get cited or linked; ungated tools do, and the citation is worth more than the address.

### 11.2 The teardown series

Publicly automate a real CRM workflow, end to end, with screenshots and the actual configuration. One per month. Nobody in this category shows their work at implementation depth — most content stops at "AI can help with lead scoring." Teardowns are what convert a technical buyer.

### 11.3 Dogfooding — your strongest and cheapest asset

You run this. The admin in this repo already has task management with AI generation, smart alerts, activity logging, an accounting module, and 24+ edge functions. Publish a page — `/showcase` already exists as a home for it — showing the automation stack that runs Pearson Media: what's automated, what it replaced, what broke. Real screenshots, real numbers.

**This is the highest-credibility, lowest-cost asset available to you.** It's already built. It just isn't visible.

### 11.4 Claims substantiation (blocking)

Before any of the above ships, the four headline numbers in `AuthoritySection.tsx` need a source each: which client, what period, how measured. Where a number can't be substantiated, either soften it to something defensible or cut it. This is a Phase-0 blocker, not a nice-to-have — see §15.

---

## 12. Off-site distribution

The site is the asset; it is not the distribution.

| Channel | Cadence | Angle |
|---|---|---|
| **LinkedIn** | 3–4×/week | Your buyers live here. Failure modes and rung diagnoses, not motivation. Every post is a repurposed article fragment. |
| **Newsletter** | Weekly | `NewsletterSignup` component already exists. One rung-level tip per issue. |
| **Podcasts** | 1–2/month as guest | Sales/RevOps/SMB-ops shows. The "quota-carrier who codes" angle books easily. |
| **HubSpot / GoHighLevel partner directories** | One-time | Cheap, category-relevant backlinks and buyer-intent listings. |
| **Communities** | Ongoing | RevOps Co-op, Pavilion, r/sales, r/CRM. Answer failure-mode questions with substance, never with a link-drop. |
| **GitHub** | Ongoing | Open-source one small CRM automation utility. Developer-credible proof, and it ranks. |
| **Guest posts** | 1/month | RevOps and sales-ops publications. Always the capture-layer thesis. |

---

## 13. Measurement

### Leading indicators (weekly)

- CRM-cluster articles published
- `/ai-crm-automation` sessions and scroll depth
- Scorecard completions and ROI calculator uses
- Audit inquiries (the only number that pays)

### Lagging indicators (monthly)

- Rankings across Clusters A–D
- Referring domains to the pillar and tools
- Newsletter subscribers from CRM content
- Closed audit engagements and audit→build conversion rate

### The AI-citation panel (monthly, manual — 30 minutes)

Run the same 10 prompts across ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews. Record whether you're mentioned, and whether the *framework* is mentioned even when you aren't (that's leading-edge category adoption).

Prompts: *who should I hire to automate my CRM with AI* · *why do AI CRM projects fail* · *what does CRM automation cost* · *best AI CRM consultant for small business* · *how do I get sales reps to update the CRM* · *CRM automation maturity model* · *should I buy my CRM's AI add-on* · *HubSpot AI vs Salesforce Einstein small team* · *fractional RevOps engineer* · *AI CRM automation consultant Des Moines*

Log to a simple table; the trend over six months is the real scoreboard.

### Instrumentation

`useAnalytics()` / `trackCTA` already exist (`src/components/Analytics.tsx`). Add events: `scorecard_started`, `scorecard_completed`, `roi_calculated`, `audit_cta_clicked`, `pricing_viewed`, `ladder_expanded`.

---

## 14. Phased roadmap with effort estimates

### Phase 0 — Decide and substantiate (Week 0, ~1 day, no code)

- Confirm the narrowing decision and accept its cost
- Substantiate or soften the four headline numbers
- Write the 83% retention case study from primary sources
- Lock the positioning statement, thesis, and Ladder wording

**Gate**: do not start Phase 1 until the claims are defensible.

### Phase 1 — Positioning surfaces (Weeks 1–2, ~4–5 dev-days + copy)

- Homepage: SEO block, thesis block, service cards, Ladder section, Person schema
- `src/lib/seo.ts` defaults
- Money page `/ai-crm-automation` v1 (full copy)
- `service` schema case in `StructuredData.tsx`
- Navigation + sitemap entries
- Topic hub config + icon + reorder
- About/profile content pass **(content)**

**Result**: the site says what you do, and can be found for it.

### Phase 2 — Content engine (Weeks 3–6, ~2 days/week writing)

- Weeks 1–4 of the calendar (the four pillars)
- CRM FAQ rows loaded **(content)**
- CRM case study published **(content)**
- Article standards applied to every new piece

**Result**: the hub has substance; the framework exists in public.

### Phase 3 — Proof tools (Weeks 7–10, ~6–8 dev-days)

- Scorecard tool
- ROI calculator
- Dogfooding / automation-stack page
- First two teardowns
- `/ai-crm-automation/audit` service detail page

**Result**: lead capture and link-attraction come online.

### Phase 4 — Compounding (Weeks 11+, ongoing)

- Weeks 5–12 of the calendar
- Off-site distribution at cadence
- Monthly AI-citation panel
- Quarterly refresh of the pillars

### Total engineering

Roughly **12–17 dev-days** of code across Phases 1–3. The larger investment is writing — call it 2 focused days per week for three months. **The content is the strategy; the code is the container.**

---

## 15. Risks, guardrails, and what to say no to

| Risk | Severity | Mitigation |
|---|---|---|
| **Unsubstantiated claims** ($2.8M, 83%, 40%, 10,000 users) | **High** | Source each or soften it. A category leader gets fact-checked. Overstated numbers are both a legal and a credibility exposure, and LLMs increasingly discount unsourced figures. Phase-0 blocker. |
| Narrowing costs non-CRM leads | Medium | Real, and worth it. Keep `/projects` and `/ai-tools` intact as secondary surfaces; the homepage and money page carry the focus. |
| The other six SaaS platforms look scattered | Medium | Reframe them as multi-industry revenue-data evidence, not as separate offerings. |
| Vendor blogs out-rank you on head terms | Medium | Don't contest them. Clusters B and C are the ground you can hold. |
| Slow results (SEO is 6–12 months) | Medium | LinkedIn and the newsletter carry months 1–3 while the site compounds. |
| Content quality drops under cadence | Medium | Halve the cadence before halving the standard. One excellent pillar beats four thin posts, especially for citation. |
| New pages ship generic AI-template UI | Low | `CLAUDE.md` craft floor + `npx impeccable detect` before every commit. |
| Framework doesn't catch on | Low | Even unadopted, it structures your content and improves conversion. No downside. |

### Say no to

- NFT development on the homepage — it goes, entirely
- "AI consultant" as the primary self-description anywhere
- Generic AI-automation content that could sit on any of a thousand blogs
- Gated-first tools (gate the PDF, never the answer)
- Chasing "what is AI" head terms
- Adding a seventh nav item instead of removing one

---

## 16. Immediate next actions

**This week — yours (no code):**

1. Approve or amend the positioning statement and thesis in §1
2. Substantiate the four headline numbers, or decide which get softened
3. Reconstruct the 83% CRM retention engagement: client type, timeframe, what was built, how measured
4. Start the HubSpot certifications — free, high credibility density for this exact category

**This week — mine (on approval):**

1. Build `/ai-crm-automation` with full copy, `service` + `faq` + `howto` schema, route, sitemap, and nav wiring
2. Homepage: rewrite the SEO block, replace the three service cards, add the thesis block and Ladder section, update `Person` schema
3. Add the `ai-crm-automation` topic hub and reorder `TOPIC_HUBS`
4. Update `src/lib/seo.ts` defaults
5. Draft the 10 CRM FAQ rows for admin loading

**Then:** the first two pillars (the complete guide and the failure-modes piece), followed by the scorecard tool.

---

**One-line summary**: narrow from "AI business automation" to **AI CRM automation**, lead with the capture-layer thesis, publish the Pipeline Automation Ladder and the 12-point audit as open methodology, build a money page and two free tools around them, and produce twelve weeks of failure-mode and comparison content that vendor blogs structurally cannot write.
