-- Rollback for 20260716000000_maintenance_scheduler.sql
--
-- The forward migration scheduled a pg_cron job ("maintenance-scheduler") that
-- calls public.trigger_maintenance_scheduler() every 5 minutes, and created that
-- function. This rollback unschedules the job and drops the function. It is
-- guarded so it succeeds even where pg_cron is not installed.

BEGIN;

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('maintenance-scheduler');
  EXCEPTION WHEN OTHERS THEN
    -- pg_cron not installed, or the job did not exist.
    NULL;
  END;
END;
$$;

DROP FUNCTION IF EXISTS public.trigger_maintenance_scheduler();

COMMIT;
