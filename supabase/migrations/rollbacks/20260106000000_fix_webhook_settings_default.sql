-- Rollback for 20260106000000_fix_webhook_settings_default.sql
--
-- The forward migration replaced the three admin-only RLS policies on
-- public.webhook_settings with "Service role and admins can ..." variants (so
-- the service role could also read/write). This rollback drops those variants
-- and restores the original admin-only policies from migration
-- 20251106032437 (has_role(auth.uid(), 'admin')).
--
-- NOTE: rolling this back re-restricts webhook_settings to admins only; any
-- edge function relying on service-role access to this table will lose it.

BEGIN;

-- Remove the service-role-inclusive policies introduced by the forward migration.
DROP POLICY IF EXISTS "Service role and admins can read webhook settings" ON public.webhook_settings;
DROP POLICY IF EXISTS "Service role and admins can insert webhook settings" ON public.webhook_settings;
DROP POLICY IF EXISTS "Service role and admins can update webhook settings" ON public.webhook_settings;

-- Restore the original admin-only policies.
CREATE POLICY "Only admins can read webhook settings"
  ON public.webhook_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can create webhook settings"
  ON public.webhook_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update webhook settings"
  ON public.webhook_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

COMMIT;
