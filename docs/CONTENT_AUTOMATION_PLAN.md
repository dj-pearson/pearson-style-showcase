# Daily content automation: diagnosis, plan and runbook

**Both daily posts stopped because the functions were locked to admins and the scheduler lived outside this repo.** Make.com called `amazon-article-pipeline` and `generate-ai-article` over HTTP. On 2026-08-11 (20d82c1) the Amazon function started requiring an admin token, and on 2026-09-01 (e864e77) the AI article function did too. Both changes were right, but Make.com had no admin token, so every scheduled call has returned 401/403 since. Nothing inside the repo knew a day had been missed.

Fixing the auth alone would have brought back posts that were not worth publishing. That shaped the plan below.

## What was wrong beyond the outage

| Problem                                                                                                            | Effect                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database articles were never prerendered                                                                           | Every automated post was an empty `<div id="root">` to GPTBot, ClaudeBot and PerplexityBot, with no sitemap entry and no RSS item. The GEO strategy could not reach them.          |
| The AI "news" post picked a random link from one site's homepage                                                   | Often weeks old, sometimes a tag page. The model saw 500 characters and rewrote them. No citation, no date, no angle. This pattern is what Google's scaled-content policy targets. |
| Amazon: one placeholder for every product link                                                                     | Every "Check price" button in a five-product guide pointed at product one.                                                                                                         |
| Amazon: product search used Google Shopping links                                                                  | Google Shopping now links to google.com, so ASIN extraction found nothing and runs came back empty.                                                                                |
| Amazon: author "BuildDesk Team", URL `yourdomain.com`, `min_rating` ignored, failed runs left as `running` forever | Wrong byline on every guide, broken response URL, low-rated products included.                                                                                                     |
| Amazon: prompt told the model to write "What We Love"                                                              | Implied hands-on testing that never happened.                                                                                                                                      |
| Affiliate links had no `rel="sponsored"`                                                                           | Google's link-spam policy asks for it on paid links.                                                                                                                               |

## What is now in place

1. **In-house scheduler.** Three rows in `maintenance_tasks` run on the existing pg_cron job (every 5 minutes, `20260716000000_maintenance_scheduler.sql`):
   - `Daily AI News Brief`, 12:00 UTC
   - `Daily Amazon Product Guide`, 15:00 UTC
   - `IndexNow Submission`, every 30 minutes

   Both pipeline functions accept the service-role key (`allowServiceRole`) and are idempotent per day, so a retry or a leftover Make.com call can't double-post. Failures land in `maintenance_results`; each AI brief attempt is recorded in `content_automation_runs`.

2. **AI news brief, rebuilt** (`supabase/functions/generate-ai-article`).
   - Reads nine AI news feeds (editable in the task's `config.feeds`) and keeps items from the last 36 hours.
   - Drops any story already covered in the last 30 days.
   - An editor model picks the story that matters most to businesses adopting AI, plus up to three one-line mentions.
   - Reads the full source article; a paywalled or blocked page falls through to the next candidate.
   - The writer model gets a fixed structure built for citation: bold answer-first lede, Key takeaways, What happened, Why it matters for your business, What to do about it, Also worth knowing today, and FAQs in the house format that becomes FAQPage schema.
   - The pipeline owns every URL. The model can only link to the sources it was given and to existing articles on the site, and the Sources list is appended by code.
   - A quality gate (`_shared/content-quality.ts`) checks length, required sections, FAQ count, placeholder leaks and house-style banned terms. A failing article is saved as a **draft**, not published.

3. **Amazon guide, repaired** (`supabase/functions/amazon-article-pipeline`).
   - Uses SerpAPI's Amazon engine, which returns ASINs directly.
   - Applies `min_rating` and ranks by rating weighted by review count.
   - Each product gets its own affiliate link and image via `{{AMAZON:ASIN}}` / `{{IMAGE:ASIN}}` tokens. The model never writes a URL.
   - Honest framing: a disclosure at the top, a "How we chose" section, and no testing claims.
   - Held as a draft if the Associates tag is still the `your-tag-20` default.

4. **Crawlers can see the posts.**
   - `scripts/prerender.mjs` now pulls published database articles at build time. Each one gets static HTML with NewsArticle or Article schema, plus FAQPage and BreadcrumbList.
   - Those articles are added to `sitemap.xml` and `rss.xml`.
   - It also writes `news-sitemap.xml` for the last 48 hours of briefs and `llms.txt` for assistants.
   - Each publish calls a Cloudflare Pages deploy hook so the new post is prerendered within minutes.
   - IndexNow then pushes it to Bing, which is also where ChatGPT search and Copilot get their results.

## Setup: what Dj needs to do

1. **Merge the PR**, then redeploy the edge functions container on Coolify so the new function code is live.
2. **Apply the migration** `supabase/migrations/20260923000001_content_automation.sql` to the self-hosted database.
3. **Confirm the scheduler is configured.** In the SQL editor:
   ```sql
   select current_setting('app.settings.functions_url', true) as url,
          current_setting('app.settings.service_role_key', true) is not null as has_key;
   select jobname, schedule from cron.job;
   ```
   If `url` is null or `has_key` is false, set both values as described at the top of `20260716000000_maintenance_scheduler.sql`, reusing the service-role key already stored for the functions container. If `cron.job` has no `maintenance-scheduler` row, re-run that migration.
4. **Create the deploy hook.** Cloudflare dashboard > Pages > the danpearson.net project > Settings > Builds > Deploy hooks > add one on branch `main`. Put its URL in the functions container's environment as `CLOUDFLARE_PAGES_DEPLOY_HOOK_URL` and redeploy.
5. **Set the Associates tag.** Admin > Amazon Pipeline > Settings > Amazon tag. Until it is set, guides are saved as drafts.
6. **Check SerpAPI credit.** The Amazon engine uses one search per run.
7. **Turn off the two Make.com scenarios.** They now fail on auth and are no longer needed.

The first run happens on the next five-minute tick after step 2, because a task that has never run counts as due.

## How to check it is working

```sql
-- Last week of pipeline runs, newest first
select task_name, status, run_at, error_message, details->>'published' as published
from maintenance_results
where task_name in ('Daily AI News Brief', 'Daily Amazon Product Guide', 'IndexNow Submission')
order by run_at desc limit 20;

-- Why a brief was held as a draft
select run_date, status, topic, quality->'issues' from content_automation_runs order by started_at desc limit 7;
```

Then open `https://danpearson.net/news-sitemap.xml` after a publish: the day's brief should be listed. `https://danpearson.net/llms.txt` should list it too.

## Next, in order

1. **Two weeks of draft review.** Read every brief for the first 14 days, even the published ones. The gate catches structure, not judgement. If more than two drafts a week come from `banned_terms` or `too_short`, tighten the prompt rather than the gate.
2. **An AI News hub page** (`/topics/ai-news`). It would collect the briefs, link each to the CRM pillar it relates to, and get its own CollectionPage schema. Briefs are timely; the hub is what earns links over time.
3. **Weekly roll-up.** Every Friday, one "AI this week for operators" post built from that week's briefs. It is a stronger citation target than any single day.
4. **Search Console and Bing Webmaster Tools.** Submit `news-sitemap.xml` in both. Watch indexed count and impressions per brief for 30 days before judging the channel.
5. **Per-article OG images.** Every automated post currently shares the site icon as its image. A generated title card would lift social and Discover click-through.
6. **Retire briefs that earn nothing.** After 90 days, mark briefs with zero impressions `noindex` or fold them into the weekly roll-ups so thin pages don't dilute the site.
