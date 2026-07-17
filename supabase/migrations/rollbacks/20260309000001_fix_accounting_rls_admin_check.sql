-- Rollback for 20260309000001_fix_accounting_rls_admin_check.sql
--
-- ⚠️  READ BEFORE RUNNING. The forward migration is a CORRECTIVE SECURITY FIX:
-- it added the SECURITY DEFINER helper public.is_email_whitelisted() and
-- rebuilt the "Allow admin full access to <table>" RLS policies on the
-- accounting tables so the admin check works correctly. Rolling it back
-- REINTRODUCES the prior, broken admin check and may lock admins out of (or
-- wrongly expose) accounting data. Do NOT roll this back unless you are
-- deliberately restoring the pre-fix state and understand the consequences.
--
-- A faithful reversal requires the pre-fix policy definitions. Because those
-- accounting policies existed before this fix, the safest reversal is to
-- re-apply the ORIGINAL migration that created them (restore from backup or
-- re-run the pre-2026-03-09 accounting-policy migration), then drop the helper
-- function below. This script only removes the helper function; it intentionally
-- does NOT drop the corrected policies, so RLS is not left fully open.

BEGIN;

-- Only drop the helper if no policy still depends on it; CASCADE is avoided on
-- purpose so a rollback cannot silently strip RLS from the accounting tables.
DROP FUNCTION IF EXISTS public.is_email_whitelisted(TEXT);

COMMIT;

-- To fully restore the pre-fix behavior, additionally re-apply the original
-- accounting RLS policy definitions from the migration that first created them.
