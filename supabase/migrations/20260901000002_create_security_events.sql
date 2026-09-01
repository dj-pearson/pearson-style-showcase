-- Create the security_events table.
--
-- Eleven call sites read from or write to this table and no migration ever
-- created it. The consequence is not just missing audit rows: checkRateLimit in
-- supabase/functions/admin-auth/index.ts:104 counts recent 'login_failure' rows
-- for an IP to throttle admin logins, and on a query error it deliberately fails
-- open ("Fail open if DB check fails"). With the table absent, every count query
-- errors, so the brute-force guard on the login endpoint has never engaged.
-- admin-auth is in PUBLIC_FUNCTIONS, so that endpoint is reachable without a
-- token by design.
--
-- The column set is the union of every writer:
--   admin-auth/index.ts:129, :307, :363
--   _shared/security-layers.ts:381
--   src/lib/error-alerting.ts:352
--   src/contexts/SecurityAuditContext.tsx:169
--
-- ip_address is text rather than inet because admin-auth records the literal
-- string 'unknown' when it cannot resolve a client address.

CREATE TABLE IF NOT EXISTS public.security_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,
  user_id       UUID,
  email         TEXT,
  ip_address    TEXT,
  user_agent    TEXT,
  action        TEXT,
  resource_type TEXT,
  resource_id   TEXT,
  layer         TEXT,
  result        TEXT,
  details       JSONB,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Serves the rate-limit and lockout counts, which filter on exactly these three
-- columns (admin-auth/index.ts:105-110 and :451-456).
CREATE INDEX IF NOT EXISTS idx_security_events_rate_limit
  ON public.security_events (event_type, ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_created_at
  ON public.security_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id
  ON public.security_events (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Reads are admin-only: the rows carry emails, IP addresses and user agents.
-- The security-critical writers (admin-auth, security-layers) hold the service
-- role and bypass RLS entirely, so they are unaffected by these policies.
DROP POLICY IF EXISTS "Only admins can read security events" ON public.security_events;
CREATE POLICY "Only admins can read security events"
  ON public.security_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- SecurityAuditContext and error-alerting write from the browser. Allowing the
-- authenticated role keeps those working while denying anonymous writes, so the
-- audit trail cannot be poisoned by an unauthenticated caller.
DROP POLICY IF EXISTS "Authenticated users can write security events" ON public.security_events;
CREATE POLICY "Authenticated users can write security events"
  ON public.security_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE public.security_events IS
  'Security audit trail. Also backs the login rate limit and account lockout checks in the admin-auth edge function.';
