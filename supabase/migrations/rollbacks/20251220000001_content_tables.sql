-- Rollback for 20251220000001_content_tables.sql
--
-- The forward migration created the content tables case_studies, faqs,
-- achievements, work_experience, and certifications (each with RLS policies,
-- indexes, and updated_at triggers). Dropping the tables with CASCADE removes
-- those dependent policies/indexes/triggers as well.
--
-- WARNING: this permanently deletes all rows in these tables. Take a backup
-- (scripts/db-backup.sh) before running a rollback in any environment with data.

BEGIN;

DROP TABLE IF EXISTS public.certifications CASCADE;
DROP TABLE IF EXISTS public.work_experience CASCADE;
DROP TABLE IF EXISTS public.achievements CASCADE;
DROP TABLE IF EXISTS public.faqs CASCADE;
DROP TABLE IF EXISTS public.case_studies CASCADE;

COMMIT;
