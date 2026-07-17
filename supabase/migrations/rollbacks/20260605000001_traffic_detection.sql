-- Rollback for 20260605000001_traffic_detection.sql
--
-- The forward migration created the page_visits and traffic_rules tables with
-- RLS policies, indexes, and an updated_at trigger. Dropping the tables with
-- CASCADE removes those dependent objects.
--
-- WARNING: this permanently deletes all logged page visits and traffic rules.
-- Take a backup (scripts/db-backup.sh) before running in an environment with data.

BEGIN;

DROP TABLE IF EXISTS public.page_visits CASCADE;
DROP TABLE IF EXISTS public.traffic_rules CASCADE;

COMMIT;
