-- Voice engine: Dan Pearson's personal social posting (VOICE-001, plus the
-- columns VOICE-008, VOICE-013 and VOICE-014 need).
--
-- Design: docs/voice-engine/DESIGN.md. The service in services/voice-engine
-- reads and writes these tables with the service-role key (which bypasses RLS).
-- The admin pages under Admin > Voice use the same admin predicate as
-- 20261101000004_private_data_bucket.sql. Anonymous callers get nothing.
--
-- One migration rather than four: nothing here is applied anywhere yet, so the
-- later stories' columns (voice_topics.is_feature, voice_webhook_targets.reels,
-- voice_posts.dry_run and its partial unique index) are created with the tables.
--
-- Idempotent. Safe to re-run. Rollback: rollbacks/20261116000001_voice_engine.sql

BEGIN;

-- 1. Tracks: the three daily posts ---------------------------------------------

CREATE TABLE IF NOT EXISTS public.voice_tracks (
  key text PRIMARY KEY CHECK (key IN ('gradethread', 'eatpal', 'platform')),
  enabled boolean NOT NULL DEFAULT true,
  post_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  products text[] NOT NULL DEFAULT '{}',
  rotation_index integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.voice_tracks (key, post_time, products) VALUES
  ('gradethread', '08:30', '{gradethread}'),
  ('eatpal', '12:15', '{eatpal}'),
  ('platform', '16:30', '{brikly,printyx,agentbio}')
ON CONFLICT (key) DO NOTHING;

-- 2. Story Bank: the only source of personal facts ------------------------------

CREATE TABLE IF NOT EXISTS public.voice_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  tracks text[] NOT NULL DEFAULT '{}',
  products text[] NOT NULL DEFAULT '{}',
  confirmed boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'vault-import')),
  source_ref text,
  times_used integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A vault note is imported once; re-running the import matches on source_ref.
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_stories_source_ref
  ON public.voice_stories (source_ref) WHERE source_ref IS NOT NULL;

-- 3. Cached product pages: the only source of product facts ---------------------

CREATE TABLE IF NOT EXISTS public.voice_source_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL,
  url text NOT NULL,
  title text,
  body_text text NOT NULL DEFAULT '',
  content_hash text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product, url)
);

-- 4. Uploaded media -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voice_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('headshot', 'photo', 'screenshot', 'music')),
  product text,
  storage_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A screenshot with no product could end up on another product's carousel.
  CONSTRAINT voice_assets_screenshot_has_product CHECK (kind <> 'screenshot' OR product IS NOT NULL)
);

-- 5. Topic history --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voice_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track text NOT NULL REFERENCES public.voice_tracks(key),
  product text NOT NULL,
  topic text NOT NULL,
  angle text NOT NULL,
  is_feature boolean NOT NULL DEFAULT false,
  source_item_ids uuid[] NOT NULL DEFAULT '{}',
  story_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_topics_track_created
  ON public.voice_topics (track, created_at DESC);

-- 6. Posts ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voice_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track text NOT NULL REFERENCES public.voice_tracks(key),
  product text NOT NULL,
  run_date date NOT NULL,
  topic_id uuid REFERENCES public.voice_topics(id) ON DELETE SET NULL,
  format text CHECK (format IN ('text_carousel', 'single_image', 'product_carousel')),
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'writing', 'rendering', 'dispatching', 'posted', 'partial', 'skipped', 'failed')),
  copy jsonb,
  slides jsonb,
  image_urls text[] NOT NULL DEFAULT '{}',
  video_url text,
  skip_reason text,
  skip_stage text,
  attempts integer NOT NULL DEFAULT 0,
  dry_run boolean NOT NULL DEFAULT false,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The claim. Inserting the row is how a run takes ownership of a track's day; a
-- second insert for the same real (track, run_date) fails, so a track can never
-- post twice in a day. Dry runs are excluded so a sample never blocks the real post.
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_posts_track_run_date
  ON public.voice_posts (track, run_date) WHERE NOT dry_run;

CREATE INDEX IF NOT EXISTS idx_voice_posts_created ON public.voice_posts (created_at DESC);

-- 7. Webhook targets: one Make scenario per platform -----------------------------

CREATE TABLE IF NOT EXISTS public.voice_webhook_targets (
  platform text PRIMARY KEY
    CHECK (platform IN ('x', 'linkedin', 'instagram', 'facebook', 'threads', 'youtube')),
  url text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  reels boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.voice_webhook_targets (platform) VALUES
  ('x'), ('linkedin'), ('instagram'), ('facebook'), ('threads'), ('youtube')
ON CONFLICT (platform) DO NOTHING;

-- 8. Webhook delivery log --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voice_webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.voice_posts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  -- 'post' for the platform's main payload, 'reel' for Instagram's second
  -- (video) payload. Part of the idempotency key.
  variant text NOT NULL DEFAULT 'post' CHECK (variant IN ('post', 'reel')),
  attempt integer NOT NULL DEFAULT 1,
  http_status integer,
  ok boolean NOT NULL DEFAULT false,
  response_excerpt text CHECK (response_excerpt IS NULL OR length(response_excerpt) <= 500),
  -- Dry runs record what would have been sent (http_status NULL, ok false).
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Never double-post: a platform can record one successful send per post (and one
-- per reel). The dispatcher also checks before sending; this is the backstop.
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_webhook_log_one_success
  ON public.voice_webhook_log (post_id, platform, variant) WHERE ok;

CREATE INDEX IF NOT EXISTS idx_voice_webhook_log_post ON public.voice_webhook_log (post_id, created_at);

-- 9. updated_at triggers ---------------------------------------------------------

DROP TRIGGER IF EXISTS trg_voice_tracks_updated_at ON public.voice_tracks;
CREATE TRIGGER trg_voice_tracks_updated_at BEFORE UPDATE ON public.voice_tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_voice_posts_updated_at ON public.voice_posts;
CREATE TRIGGER trg_voice_posts_updated_at BEFORE UPDATE ON public.voice_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_voice_webhook_targets_updated_at ON public.voice_webhook_targets;
CREATE TRIGGER trg_voice_webhook_targets_updated_at BEFORE UPDATE ON public.voice_webhook_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. RLS: admins only; anon has no policy; service role bypasses ---------------

ALTER TABLE public.voice_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage voice_tracks" ON public.voice_tracks;
CREATE POLICY "Admins manage voice_tracks"
  ON public.voice_tracks FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.voice_tracks FROM anon;

ALTER TABLE public.voice_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage voice_stories" ON public.voice_stories;
CREATE POLICY "Admins manage voice_stories"
  ON public.voice_stories FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.voice_stories FROM anon;

ALTER TABLE public.voice_source_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage voice_source_items" ON public.voice_source_items;
CREATE POLICY "Admins manage voice_source_items"
  ON public.voice_source_items FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.voice_source_items FROM anon;

ALTER TABLE public.voice_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage voice_assets" ON public.voice_assets;
CREATE POLICY "Admins manage voice_assets"
  ON public.voice_assets FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.voice_assets FROM anon;

ALTER TABLE public.voice_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage voice_topics" ON public.voice_topics;
CREATE POLICY "Admins manage voice_topics"
  ON public.voice_topics FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.voice_topics FROM anon;

ALTER TABLE public.voice_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage voice_posts" ON public.voice_posts;
CREATE POLICY "Admins manage voice_posts"
  ON public.voice_posts FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.voice_posts FROM anon;

ALTER TABLE public.voice_webhook_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage voice_webhook_targets" ON public.voice_webhook_targets;
CREATE POLICY "Admins manage voice_webhook_targets"
  ON public.voice_webhook_targets FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.voice_webhook_targets FROM anon;

ALTER TABLE public.voice_webhook_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage voice_webhook_log" ON public.voice_webhook_log;
CREATE POLICY "Admins manage voice_webhook_log"
  ON public.voice_webhook_log FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.voice_webhook_log FROM anon;

-- 11. Storage: public-read bucket for slide images, videos and uploads ----------
-- Public read comes from the bucket being public (Make and the social platforms
-- fetch media by URL). Writes are admin only; the service role bypasses RLS.

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-media', 'voice-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Admins can upload voice-media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update voice-media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete voice-media" ON storage.objects;

CREATE POLICY "Admins can upload voice-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-media' AND (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins can update voice-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'voice-media' AND (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (bucket_id = 'voice-media' AND (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins can delete voice-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'voice-media' AND (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin')));

COMMIT;
