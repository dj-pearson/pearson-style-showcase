-- Close anonymous INSERT on five audit and monitoring tables.
--
-- Each carried an INSERT policy with WITH CHECK (true) and no TO clause, so it
-- applied to the public role. The anon key ships in the frontend bundle, which
-- means anyone could write rows into the audit trail and the monitoring feed:
-- forged admin activity, invented security-alert entries, or fabricated metrics
-- that skew the command centre's health reading.
--
-- Every real writer either holds the service role, which bypasses RLS, or is a
-- SECURITY DEFINER function, which runs as its owner and likewise bypasses RLS.
-- Verified writer by writer before dropping anything:
--
--   system_metrics           public.record_metric (SECURITY DEFINER,
--                            20251113201636) and the command-centre schema
--                            function in 20251108000001. No client or edge writes.
--   automated_alerts         SECURITY DEFINER functions in the same two
--                            migrations. src only reads and subscribes
--                            (SmartAlerts.tsx).
--   secure_vault_access_log  supabase/functions/secure-vault only, on the
--                            service role. No client references at all.
--   email_logs               supabase/functions/send-notification-email only,
--                            on the service role.
--   admin_activity_log       admin-auth on the service role, AND the browser via
--                            logSecurityEvent in src/lib/security-layers.ts:800.
--                            This one keeps an INSERT policy, narrowed to the
--                            authenticated role.

DROP POLICY IF EXISTS "Service can create system metrics" ON public.system_metrics;
DROP POLICY IF EXISTS "Service can create automated alerts" ON public.automated_alerts;
DROP POLICY IF EXISTS "Service can create access logs" ON public.secure_vault_access_log;
DROP POLICY IF EXISTS "System can create email logs" ON public.email_logs;

-- admin_activity_log is written from the browser by logSecurityEvent, so it needs
-- a policy. Narrowing it to authenticated keeps that path working while removing
-- the anonymous one. Authentication here is admin-whitelisted, so this is not a
-- broad grant.
DROP POLICY IF EXISTS "Service can create activity logs" ON public.admin_activity_log;

CREATE POLICY "Authenticated users can create activity logs"
  ON public.admin_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
