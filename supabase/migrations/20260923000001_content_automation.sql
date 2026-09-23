-- Daily content automation: schedule both article pipelines from inside the
-- database and keep a record of what each run did.
--
-- WHY THIS EXISTS
-- ---------------
-- The daily Amazon post and the daily AI-news post were triggered by Make.com
-- scenarios calling the edge functions over HTTP. 20d82c1 (2026-08-11) and
-- e864e77 (2026-09-01) put an admin check in front of both functions, which is
-- correct, and every external call has failed with 401/403 since. Nothing
-- noticed, because the scheduler lived outside this repo and nothing here
-- recorded a missed day.
--
-- The pg_cron job from 20260716000000_maintenance_scheduler.sql already calls
-- maintenance-runner every five minutes with the service-role key. This adds
-- the two pipelines as maintenance tasks, so they run on that same scheduler,
-- show up on the maintenance dashboard, and land in maintenance_results when
-- they fail.
--
-- It also adds:
--   content_automation_runs  one row per pipeline attempt: what it picked, what
--                            it published, and why a run was held as a draft.
--                            Also the idempotency record that stops a retry or
--                            a second scheduler from publishing twice a day.
--   indexnow_submissions     which article URLs were already pushed to IndexNow.
--
-- Idempotent. Safe to re-run.

BEGIN;

-- 1. Run history -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.content_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,
  run_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'published', 'draft', 'skipped', 'failed')),
  article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
  topic text,
  source_urls text[] NOT NULL DEFAULT '{}',
  quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_content_automation_runs_pipeline_date
  ON public.content_automation_runs (pipeline, run_date DESC);

COMMENT ON TABLE public.content_automation_runs IS
'One row per content pipeline attempt (ai_news, amazon). Written by edge functions with the service role. status=draft means the article was saved unpublished because it failed the quality gate; quality.issues says why.';

ALTER TABLE public.content_automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read content automation runs" ON public.content_automation_runs;
CREATE POLICY "Admins can read content automation runs"
  ON public.content_automation_runs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. IndexNow ledger ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.indexnow_submissions (
  url text PRIMARY KEY,
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status_code integer
);

ALTER TABLE public.indexnow_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read indexnow submissions" ON public.indexnow_submissions;
CREATE POLICY "Admins can read indexnow submissions"
  ON public.indexnow_submissions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Scheduled tasks ---------------------------------------------------------
--
-- Times are UTC. 12:00 UTC is 7am Central in summer and 6am in winter, early
-- enough that the day's brief is live before US readers start work. The Amazon
-- guide runs later so the two never compete for the same five-minute tick.
--
-- config is read by maintenance-runner and passed through to the function, so
-- the feed list, author and auto-publish switch can change without a deploy.

INSERT INTO public.maintenance_tasks (task_name, task_type, description, schedule_cron, enabled, config)
VALUES
  (
    'Daily AI News Brief',
    'content_generation',
    'Pick the most useful AI story of the last 36 hours from the configured feeds, write an analysis with cited sources, and publish it if it passes the quality gate.',
    '0 12 * * *',
    true,
    '{
      "function": "generate-ai-article",
      "author": "Dan Pearson",
      "auto_publish": true,
      "feeds": [
        "https://techcrunch.com/category/artificial-intelligence/feed/",
        "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        "https://venturebeat.com/category/ai/feed/",
        "https://arstechnica.com/ai/feed/",
        "https://www.technologyreview.com/topic/artificial-intelligence/feed",
        "https://www.artificialintelligence-news.com/feed/",
        "https://openai.com/news/rss.xml",
        "https://blog.google/technology/ai/rss/",
        "https://huggingface.co/blog/feed.xml"
      ]
    }'::jsonb
  ),
  (
    'Daily Amazon Product Guide',
    'content_generation',
    'Run the Amazon affiliate pipeline once a day: research one unused search term, write a buying guide with per-product affiliate links, publish unless review is required.',
    '0 15 * * *',
    true,
    '{"function": "amazon-article-pipeline"}'::jsonb
  ),
  (
    'IndexNow Submission',
    'indexing',
    'Push article URLs published in the last 48 hours to IndexNow (Bing, Yandex, Seznam, Naver) once the site rebuild has had time to finish.',
    '*/30 * * * *',
    true,
    '{"min_age_minutes": 20}'::jsonb
  )
ON CONFLICT (task_name) DO NOTHING;

COMMIT;
