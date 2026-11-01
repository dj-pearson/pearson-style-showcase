-- Stop forged affiliate clicks and forged audit rows.
--
-- 1. amazon_affiliate_clicks: "Service can create affiliate clicks"
--    (20251106045206) was FOR INSERT WITH CHECK (true) with no TO clause, so
--    anyone with the anon key could insert clicks directly and skip the rate
--    limit and validation in track-affiliate-click. That function now uses the
--    service role, which bypasses RLS, so the policy is dropped. Nothing in
--    src/ writes this table.
--
-- 2. admin_activity_log: 20260901000003 narrowed the open INSERT to the
--    authenticated role, but kept WITH CHECK (true), so any signed-in user
--    (not just admins) could write rows under any admin_id. The only browser
--    writer is logSecurityEvent (src/lib/security-layers.ts:800), which runs
--    for a verified admin and sets admin_id to that admin's own id. admin-auth
--    and the SECURITY DEFINER log functions bypass RLS and are unaffected.
--    Separately, that browser insert sends a "details" column the table does
--    not have and omits the NOT NULL admin_email, so it fails before RLS is
--    consulted; fixing it is a src/ change and is not part of this migration.
--
-- 3. security_events: same shape in 20260901000002. The pre-auth writers
--    (login failures, lockouts, rate-limit rows in admin-auth, and
--    _shared/security-layers.ts) all use the service role. The one browser
--    writer, src/lib/error-alerting.ts:352, does not send user_id, so user_id
--    now defaults to auth.uid(); that keeps the insert passing for an admin
--    session and stores who raised the alert. Service-role inserts that omit
--    user_id still get NULL, since the service role JWT has no sub.
--
-- The admin predicate matches 20261028000002_drop_permissive_service_write_policies.sql.

-- 1. amazon_affiliate_clicks
DROP POLICY IF EXISTS "Service can create affiliate clicks" ON public.amazon_affiliate_clicks;

-- 2. admin_activity_log
DROP POLICY IF EXISTS "Authenticated users can create activity logs" ON public.admin_activity_log;
DROP POLICY IF EXISTS "Admins can create their own activity logs" ON public.admin_activity_log;

CREATE POLICY "Admins can create their own activity logs"
  ON public.admin_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND (
      auth.jwt() ->> 'role' = 'admin'
      OR public.is_email_whitelisted(auth.jwt() ->> 'email')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- 3. security_events
ALTER TABLE public.security_events ALTER COLUMN user_id SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "Authenticated users can write security events" ON public.security_events;
DROP POLICY IF EXISTS "Admins can write their own security events" ON public.security_events;

CREATE POLICY "Admins can write their own security events"
  ON public.security_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      auth.jwt() ->> 'role' = 'admin'
      OR public.is_email_whitelisted(auth.jwt() ->> 'email')
      OR public.has_role(auth.uid(), 'admin')
    )
  );
