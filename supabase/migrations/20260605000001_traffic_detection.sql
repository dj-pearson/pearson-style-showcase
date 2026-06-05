-- Odd Traffic Detection
-- Adds lightweight, privacy-aware visitor logging plus a configurable rules row
-- so unusual traffic (e.g. a flood of visits from an unexpected country) can be
-- detected, reviewed in the admin dashboard, and "soft handled" on the client
-- (kept out of Google Analytics and served without heavy 3D assets).

-- ---------------------------------------------------------------------------
-- page_visits: one row per visitor session (NOT per pageview) to keep writes low.
-- No raw IP is stored: only a truncated SHA-256 hash, so it stays GDPR-friendly
-- while still allowing per-source volume-spike detection.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.page_visits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  path         text,
  country_code text,            -- ISO 3166-1 alpha-2, e.g. 'US', 'SG'
  ip_hash      text,            -- truncated SHA-256 of IP (no raw IP retained)
  session_id   text,
  user_agent   text,
  referrer     text,
  is_flagged   boolean NOT NULL DEFAULT false,
  flag_reason  text
);

-- ---------------------------------------------------------------------------
-- traffic_rules: a single configuration row, editable from the admin dashboard.
-- Readable by anonymous clients so the public site can decide how to handle a
-- visit before it loads analytics / heavy assets.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.traffic_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled               boolean NOT NULL DEFAULT true,
  -- 'monitor'     -> log + flag only, change nothing for the visitor
  -- 'soft_handle' -> additionally skip GA tracking and heavy 3D assets
  mode                  text NOT NULL DEFAULT 'soft_handle',
  allowed_countries     text[] NOT NULL DEFAULT ARRAY['US', 'CA'],
  spike_threshold       integer NOT NULL DEFAULT 100,
  spike_window_minutes  integer NOT NULL DEFAULT 60,
  updated_at            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT traffic_rules_mode_check CHECK (mode IN ('monitor', 'soft_handle'))
);

-- Enable Row Level Security
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_rules ENABLE ROW LEVEL SECURITY;

-- page_visits: anyone (anonymous visitors) may log a visit; only admins may read.
CREATE POLICY "Anyone can log a page visit"
ON public.page_visits
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read page visits"
ON public.page_visits
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- traffic_rules: world-readable config; only admins may change it.
CREATE POLICY "Anyone can read traffic rules"
ON public.traffic_rules
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert traffic rules"
ON public.traffic_rules
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update traffic rules"
ON public.traffic_rules
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Explicit grants so the browser-facing anon role can write visits / read rules
-- regardless of self-hosted default privileges (RLS still governs row access).
GRANT INSERT ON public.page_visits TO anon, authenticated;
GRANT SELECT ON public.page_visits TO authenticated;
GRANT SELECT ON public.traffic_rules TO anon, authenticated;
GRANT INSERT, UPDATE ON public.traffic_rules TO authenticated;

-- Indexes for the dashboard's time-window / country / spike queries.
CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON public.page_visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_visits_country ON public.page_visits(country_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_visits_ip_hash ON public.page_visits(ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_visits_flagged ON public.page_visits(is_flagged) WHERE is_flagged = true;

-- Keep updated_at fresh on the rules row.
CREATE TRIGGER update_traffic_rules_updated_at
BEFORE UPDATE ON public.traffic_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the single configuration row (defaults: US/CA expected, soft handling on).
INSERT INTO public.traffic_rules (enabled, mode, allowed_countries, spike_threshold, spike_window_minutes)
SELECT true, 'soft_handle', ARRAY['US', 'CA'], 100, 60
WHERE NOT EXISTS (SELECT 1 FROM public.traffic_rules);
