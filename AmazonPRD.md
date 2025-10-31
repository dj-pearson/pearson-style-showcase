Here’s a full PRD you can hand to a dev team. I kept the flow plain and tied it to Make.com triggering a Supabase Edge Function each day.

---

# PRD: Daily Amazon Product Article Pipeline

## 1) Summary

Set up a daily job that picks Amazon items, plans SEO, writes a full post, inserts Amazon links, and publishes to your React TypeScript site. The daily trigger runs in Make.com and calls a Supabase Edge Function at a set time.

## 2) Goals

* Post fresh product content every day without manual work.
* Use solid SEO steps so posts have a real shot in search.
* Add Amazon Associates links with your tag in the right spots.
* Keep logs, alerts, and a review switch if you want to approve before going live.

## 3) Scope

**In scope**

* Make.com cron flow
* Supabase Edge Function to run the pipeline
* Amazon Product Advertising API pull
* SEO plan, outline, and draft
* Link build with your Amazon tag
* Save to DB and publish to site
* Admin settings page
* Logs and alerts

**Out of scope**

* Custom site theme work
* Image editing
* Price tracking beyond simple fetch

## 4) Roles

* You (admin)
* Reader (site visitor)
* System (jobs, API calls)

## 5) High-Level Flow

1. Make.com runs daily at your chosen time.
2. Make calls your Supabase Edge Function webhook.
3. Edge Function picks a niche, fetches Amazon items, filters, and ranks.
4. Edge Function builds an SEO plan and outline.
5. Edge Function writes the draft with your AI writer.
6. Edge Function adds affiliate links and product boxes.
7. Edge Function saves to Supabase (draft or publish).
8. Frontend pulls and shows the post.

## 6) Detailed Flow

### 6.1 Trigger (Make.com)

* Time: once per day at a set hour.
* Action: HTTP call to Supabase Edge Function URL with a secret header.

### 6.2 Input rules

* Niche list from settings (array of tags like “home office,” “travel gear,” “fitness”).
* Daily post count (default 1).
* Min rating (default 4.0).
* Price range per niche (optional).
* Review switch: auto-publish on/off.
* Word count target (e.g., 1,500–2,200).

### 6.3 Product fetch (Amazon API)

* Query by niche keywords.
* Pull: ASIN, title, brand, rating, rating count, price, main image, bullet points, URL.
* Drop items that are out of stock, poor rating, or missing data.
* Rank by rating, rating count, price fit, and brand match (simple score).

### 6.4 SEO plan

For each post:

* Main keyword
* 4–6 related keywords
* Search intent (buying, compare, review)
* Title options (5)
* Meta title (<= 60 chars)
* Meta description (<= 155 chars)
* H1/H2/H3 plan
* FAQ (4–6 Qs)

### 6.5 Draft build

Sections:

* Hook intro (2–3 lines, pain points + quick promise)
* Who this is for
* Buyer guide (features to look for + tips)
* Top 3–5 items with:

  * Short summary
  * Pros and cons
  * Key specs
  * Best for tag
  * Button/link to Amazon with your tag
* Comparisons (when useful)
* FAQs (use the list above)
* Closing with next steps

Tone: plain, helpful, no fluff.

### 6.6 Affiliate linking

* Link pattern: `https://www.amazon.com/dp/{ASIN}/?tag={YOUR_TAG}`
* Place links in:

  * Product box button
  * Text link in first product section
  * Bottom call-to-action
* Mark links as nofollow and sponsored in HTML attributes.
* Add short note: “As an Amazon Associate I earn from qualifying purchases.”

### 6.7 Media

* Use the main image from API where allowed.
* Store image URL; do not hotlink if your theme blocks it. If download is needed, save to your storage bucket with a safe filename.

### 6.8 Save and publish

* Save post, products, and SEO fields in Supabase tables.
* If review switch is off, set status to “published.”
* If on, set status to “draft” and send an email or Slack alert.

### 6.9 Logs & alerts

* Store per-run logs: start, end, item count, success/fail.
* On fail, send alert (email/Slack) with short message and run id.

---

## 7) System Design

### 7.1 Architecture

* Make.com: time trigger → HTTP call
* Supabase Edge Function: main runner
* Amazon Product Advertising API: product data
* AI writer: prompt calls (your current writer API)
* Supabase DB: posts, products, settings, logs
* React TypeScript frontend: renders posts

### 7.2 Data model (Supabase)

Tables (simplified):

**settings**

* id (uuid, pk)
* niches (jsonb array)
* daily_post_count (int)
* min_rating (numeric)
* price_min (numeric, nullable)
* price_max (numeric, nullable)
* review_required (bool)
* word_count_target (int)
* amazon_tag (text)
* last_run_at (timestamptz)

**runs**

* id (uuid, pk)
* started_at (timestamptz)
* finished_at (timestamptz, nullable)
* status (text: success|fail|partial)
* note (text, nullable)

**products**

* id (uuid, pk)
* asin (text, unique)
* title (text)
* brand (text)
* rating (numeric)
* rating_count (int)
* price (numeric)
* image_url (text)
* niche (text)
* last_seen_at (timestamptz)

**posts**

* id (uuid, pk)
* slug (text, unique)
* title (text)
* meta_title (text)
* meta_description (text)
* status (text: draft|published)
* niche (text)
* main_keyword (text)
* related_keywords (jsonb)
* search_intent (text)
* outline (jsonb)
* content_html (text)
* word_count (int)
* published_at (timestamptz, nullable)
* run_id (uuid fk)

**post_products**

* id (uuid, pk)
* post_id (uuid fk)
* asin (text fk to products.asin)
* summary (text)
* pros (jsonb)
* cons (jsonb)
* specs (jsonb)
* best_for (text)
* affiliate_url (text)

**logs**

* id (uuid, pk)
* run_id (uuid fk)
* level (text: info|warn|error)
* message (text)
* ctx (jsonb)
* created_at (timestamptz)

Indexes on `asin`, `slug`, and `status`.

---

## 8) Make.com Scenario

**Modules**

1. Scheduler (daily at HH:MM, your timezone)
2. HTTP Make a request

   * Method: POST
   * URL: `https://<project-ref>.supabase.co/functions/v1/daily-pipeline`
   * Headers:

     * `Authorization: Bearer <service-role-or-edge-key>`
     * `x-pipeline-secret: <shared-secret>`
     * `Content-Type: application/json`
   * Body JSON:

     * `{ "requestedCount": <int>, "runReason": "daily" }`
3. Error handler route:

   * On non-2xx, send email/Slack with payload and response.

No loops in Make; the Edge Function handles all loops and branching.

---

## 9) Supabase Edge Function: Steps

**Input**

* `requestedCount` (default to settings.daily_post_count)
* `runReason` (for logs)

**Process**

1. Read settings.
2. Start run record.
3. Pick niche(s) for today. Rotate or random with weight.
4. For each post to create:

   * Build Amazon API query from niche keywords.
   * Fetch results; apply filters (rating, stock, price).
   * Rank and keep top 3–5.
   * Build SEO plan (prompt to your AI).
   * Build outline (prompt).
   * Write draft (prompt with word count target).
   * Insert affiliate links and product boxes.
   * Build slug and fields.
   * Save products and post.
   * If review off, set status to published and set published_at.
5. Write logs as you move through each step.
6. End run record with status.

**Output**

* JSON summary: posts created, drafts, published list, warnings, errors.

**Fail paths**

* Amazon API fail: retry with backoff up to 3 times.
* AI fail: retry once; if still bad, skip that post and log error.
* DB fail: log and stop the run.

---

## 10) SEO Plan Template (stored as JSON)

```
{
  "mainKeyword": "...",
  "relatedKeywords": ["...", "...", "...", "..."],
  "searchIntent": "buying|compare|review",
  "titleOptions": ["...", "...", "...", "...", "..."],
  "metaTitle": "...",
  "metaDescription": "...",
  "headings": [
    {"level": "H1", "text": "..."},
    {"level": "H2", "text": "..."},
    {"level": "H2", "text": "..."},
    {"level": "H3", "text": "..."}
  ],
  "faqs": [
    {"q": "...", "a": "..."},
    {"q": "...", "a": "..."}
  ]
}
```

---

## 11) Writing Rules

* Short lines. Plain words. Helpful tone.
* No keyword stuffing. Use main keyword in title, H1, first 100 words, one H2, and closing.
* Related keywords appear where they fit.
* Each product block has pros, cons, specs, and a “best for” tag.
* Add a short note about affiliate links near the top or bottom.

---

## 12) Link Rules

* Button label: “View on Amazon”
* Text link early in the post: “[Product Name] on Amazon”
* `rel="nofollow sponsored"` on all affiliate links
* Use your tag every time
* If a link 404s during run, drop that product and pick the next best one

---

## 13) Admin Settings UI (simple page)

* Niche tags (list)
* Daily post count
* Min rating
* Price min/max (optional)
* Word count target
* Amazon tag
* Review required (toggle)
* Test run button
* Last run status and link to logs

---

## 14) Validation & Testing

* Unit tests for:

  * Rank score function
  * Slug maker
  * Link maker
  * Outline builder
* Dry run flag: does everything except publish
* Staging mode: writes to staging tables or with `status=draft`
* Run 3 days in test with review on; spot check drafts
* Spot check that affiliate tag is present in all links
* Spot check meta fields and H1/H2 layout

---

## 15) Rollout Plan

* Week 1: DB tables, settings page, Make.com call to a “hello-world” Edge Function
* Week 2: Amazon API fetch + rank + product store
* Week 3: SEO plan + outline + draft builder
* Week 4: Link build + publish + logs + alerts
* Week 5: Staging runs, tune prompts, go live with review on
* Week 6: Turn on auto-publish if you’re happy

---

## 16) Metrics

* Posts per week
* % published vs draft
* Avg rating of picked items
* CTR on buttons and text links
* Organic visits per post (30/60/90 days)
* Time to first visit from search
* Fail rate per run

---

## 17) Security

* Make.com calls Edge Function with a shared secret header
* Use a service key or Edge key stored in Supabase config, never in client
* Store Amazon keys in Supabase secrets
* Log only needed fields, no secrets in logs

---

## 18) Rate Limits & Backoff

* Amazon API: respect quota

  * Space calls by 500–800 ms
  * Exponential backoff on 429 or 5xx
* AI writer: short retry then skip

---

## 19) Risks & Fixes

* Samey content: rotate niches, add buyer tips, add FAQs drawn from real questions
* API limits: cache results, spread requests
* Low search results: adjust keyword picker and titles, add internal links
* Broken links: quick head check during run, drop bad items

---

## 20) Open Questions

* Do you want price shown, and if so, show “at time of publish” text?
* Do you want schema.org markup (Article + Product + FAQ)?
* Should we auto-post to your social accounts after publish?

---

## 21) Prompts (short samples you can store)

**SEO plan prompt**

* “Give a main keyword and 5 related keywords for ‘{NICHE}’ buyers. Add search intent, 5 title options, a meta title, meta description, and an H1/H2/H3 plan. Add 5 FAQs. Keep it short and clear.”

**Outline prompt**

* “Using this SEO plan, write a clean outline with sections: intro, who this helps, buyer guide, product picks (5 spots), FAQs, closing.”

**Draft prompt**

* “Write a {WORD_COUNT} word post from this outline. Plain talk. Helpful. Add product slots with: summary, pros, cons, specs, best for. Do not make up specs that don’t exist. Leave space for a button link.”

---

If you want, I can turn this into a Notion page or add ClickUp tasks next.


AMAZON API PRD SECTION:
Great catch. Yes—add a short “PA-API calling rules” section to the PRD so the build is smooth and you don’t fight 403/429s.

# PRD Addendum: Amazon Product Advertising API (PA-API 5.0) Calling Rules

## 1) Endpoint, host, region, target

* HTTP method: `POST`
* Path: `/paapi5/{Operation}` (for example: `/paapi5/searchitems`)
* Host and region must match the marketplace you hit. For US:
  `host: webservices.amazon.com`, `region: us-east-1`. Full table is in the docs. ([Amazon Web Services][1])
* Each call needs an `x-amz-target` header. Example for SearchItems:
  `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems` ([Amazon Web Services][2])

## 2) Required headers (case sensitive)

* `host`: per locale (US: `webservices.amazon.com`) ([Amazon Web Services][2])
* `content-type`: `application/json; charset=utf-8` ([Amazon Web Services][2])
* `content-encoding`: `amz-1.0` (easy to miss) ([Amazon Web Services][2])
* `x-amz-date`: UTC in `YYYYMMDD'T'HHMMSS'Z'` (example: `20160925T120000Z`) ([Amazon Web Services][2])
* `x-amz-target`: per operation (see above) ([Amazon Web Services][2])
* `Authorization`: SigV4 header built from your keys, signed headers list, and signature ([Amazon Web Services][2])

## 3) Body (JSON) must include

* `PartnerTag`: your tracking ID for that marketplace (for example, `store-20` for US) ([Amazon Web Services][1])
* `PartnerType`: `Associates` ([Amazon Web Services][1])
* `Marketplace`: site for the locale (for example, `www.amazon.com`) ([Amazon Web Services][2])
* `Resources`: request only what you need (for example: `Images.Primary.Medium`, `ItemInfo.Title`, `Offers.Listings.Price`) ([Amazon Web Services][3])
* For Search: `Keywords`, `SearchIndex` (varies by locale) ([Amazon Web Services][2])

## 4) SigV4 notes (non-SDK)

* Service string: `ProductAdvertisingAPIv1` (used in the credential scope) ([Amazon Web Services][1])
* Sign the canonical request with `AWS4-HMAC-SHA256`, using the same `x-amz-date`, host, region, and the exact header names in `SignedHeaders`. The AWS SigV4 guide walks the exact steps. ([docs.aws.amazon.com][4])

## 5) Locale map (common ones)

* US: host `webservices.amazon.com`, region `us-east-1`
* UK: host `webservices.amazon.co.uk`, region `eu-west-1`
* DE/FR/IT/ES: host `webservices.amazon.{de|fr|it|es}`, region `eu-west-1`
* JP: host `webservices.amazon.co.jp`, region `us-west-2`
* CA/MX/BR: host `webservices.amazon.{ca|com.mx|com.br}`, region `us-east-1`
  Full table lives in the docs and should be followed exactly. ([Amazon Web Services][1])

## 6) Throttling and retries

* PA-API returns 429 for too many requests. Use a small request rate, then backoff: retry after a short wait, then longer waits. If you still get 429, drop non-essential calls for that run. ([Stack Overflow][5])
* Add simple jitter so runs don’t stack at the same second.

## 7) Common failure checks

* 403 with auth errors: wrong signature, wrong service string, or headers mismatch. Rebuild SigV4 exactly as in the guide. ([docs.aws.amazon.com][4])
* 400: often missing `content-encoding: amz-1.0` or bad `x-amz-target`. ([Amazon Web Services][2])
* Wrong marketplace link: your `PartnerTag` must match the marketplace you called. Use the right `-20`, `-21`, etc. ([Amazon Web Services][1])

## 8) Minimal request shape (for docs)

```
POST /paapi5/searchitems HTTP/1.1
host: webservices.amazon.com
content-type: application/json; charset=utf-8
content-encoding: amz-1.0
x-amz-date: 20250130T120000Z
x-amz-target: com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems
Authorization: AWS4-HMAC-SHA256 Credential=<ACCESS_KEY>/20250130/us-east-1/ProductAdvertisingAPIv1/aws4_request, SignedHeaders=content-encoding;content-type;host;x-amz-date;x-amz-target, Signature=<SIG>

{
  "Marketplace": "www.amazon.com",
  "PartnerTag": "yourtag-20",
  "PartnerType": "Associates",
  "Keywords": "mechanical keyboard",
  "SearchIndex": "All",
  "ItemCount": 5,
  "Resources": [
    "Images.Primary.Medium",
    "ItemInfo.Title",
    "Offers.Listings.Price"
  ]
}
```

Headers and target values mirror Amazon’s own examples. ([Amazon Web Services][2])

## 9) Build steps to add in our Edge Function

1. Pick locale (start with US). Set `host`, `region`, `marketplace`. ([Amazon Web Services][1])
2. Build JSON body with your `PartnerTag` for that locale and only the needed `Resources`. ([Amazon Web Services][2])
3. Create `x-amz-date` at runtime in UTC. ([Amazon Web Services][2])
4. Build canonical request and SigV4 header using `service=ProductAdvertisingAPIv1`. ([Amazon Web Services][1])
5. Send POST with required headers, read response, and log the `RequestId` if present. ([Amazon Web Services][2])
6. On 429/5xx: retry with backoff; on 4xx: log and skip that item set. ([Stack Overflow][5])

## 10) Handy Amazon pages to keep linked in the PRD

* “Sending a Request” (headers, targets, sample) ([Amazon Web Services][2])
* “Common Request Parameters” (service string, host/region table, targets) ([Amazon Web Services][1])
* “API Reference” (operations and resources) ([Amazon Web Services][6])
* AWS SigV4 guide (the link you sent) ([docs.aws.amazon.com][4])

Want me to drop a tiny TypeScript signer helper into the PRD next?

[1]: https://webservices.amazon.com/paapi5/documentation/common-request-parameters.html "Common Request Parameters · Product Advertising API 5.0"
[2]: https://webservices.amazon.com/paapi5/documentation/sending-request.html "Sending a Request · Product Advertising API 5.0"
[3]: https://webservices.amazon.com/paapi5/documentation/get-items.html?utm_source=chatgpt.com "GetItems · Product Advertising API 5.0"
[4]: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html?utm_source=chatgpt.com "Create a signed AWS API request"
[5]: https://stackoverflow.com/questions/76083432/amazon-paapi-5-0-getting-429-error-always-com-amazon-paapi5toomanyrequestsex?utm_source=chatgpt.com "getting 429 error always. com.amazon.paapi5 ..."
[6]: https://webservices.amazon.com/paapi5/documentation/api-reference.html?utm_source=chatgpt.com "API Reference · Product Advertising API 5.0"
