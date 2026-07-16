-- US-060: Real scheduler for maintenance automation.
--
-- Until now maintenance-runner was only a manual dispatcher and nothing invoked
-- it on a schedule, so link checks / cleanup / sitemap regeneration never fired
-- automatically. This migration wires a real scheduler using pg_cron + pg_net:
-- every 5 minutes Postgres calls the maintenance-runner edge function in
-- "run_due" mode, which reads maintenance_tasks.schedule_cron, runs the tasks
-- that are due, and records the outcome (including failures) in
-- maintenance_results.
--
-- Configuration (set once per environment, e.g. via Supabase/DB settings so the
-- secret is not stored in a migration):
--   ALTER DATABASE <db> SET app.settings.functions_url    = 'https://functions.danpearson.net';
--   ALTER DATABASE <db> SET app.settings.service_role_key = '<service-role-jwt>';
--
-- The whole thing is wrapped so that on a platform where pg_cron / pg_net are
-- unavailable the migration degrades to a no-op (logs a NOTICE) instead of
-- failing db push. In that case, point an external cron (or a Cloudflare Cron
-- Trigger) at:  POST https://functions.danpearson.net/maintenance-runner
-- with body {"action":"run_due"} and the service-role Authorization header.

-- Function that pings the maintenance-runner "run_due" endpoint.
-- Created unconditionally (it only references pg_net at call time); if pg_net is
-- absent the scheduled call simply raises and is skipped.
CREATE OR REPLACE FUNCTION public.trigger_maintenance_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_url  text := current_setting('app.settings.functions_url', true);
  v_key  text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'maintenance scheduler: app.settings.functions_url / service_role_key not configured; skipping';
    RETURN;
  END IF;

  -- Fire-and-forget async HTTP POST via pg_net.
  PERFORM net.http_post(
    url     := v_url || '/maintenance-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('action', 'run_due')
  );
END;
$$;

COMMENT ON FUNCTION public.trigger_maintenance_scheduler() IS
  'Invokes the maintenance-runner edge function in run_due mode (US-060). Scheduled every 5 minutes by pg_cron.';

-- Schedule it with pg_cron, guarded so unsupported platforms degrade gracefully.
DO $$
BEGIN
  -- Ensure the scheduling + HTTP extensions exist.
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  -- Remove any previous incarnation so this migration is re-runnable.
  BEGIN
    PERFORM cron.unschedule('maintenance-scheduler');
  EXCEPTION WHEN OTHERS THEN
    -- job did not exist yet
    NULL;
  END;

  -- Run the due-task check every 5 minutes.
  PERFORM cron.schedule(
    'maintenance-scheduler',
    '*/5 * * * *',
    'SELECT public.trigger_maintenance_scheduler();'
  );

  RAISE NOTICE 'maintenance scheduler: pg_cron job "maintenance-scheduler" scheduled (*/5 * * * *)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'maintenance scheduler: pg_cron/pg_net unavailable (%). Configure an external cron to POST {"action":"run_due"} to maintenance-runner instead.', SQLERRM;
END;
$$;
