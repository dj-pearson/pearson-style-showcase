-- Fix: Update webhook_settings RLS policies to allow service role access
-- The existing policies only check for admin role, blocking service role queries

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Only admins can read webhook settings" ON public.webhook_settings;
DROP POLICY IF EXISTS "Only admins can create webhook settings" ON public.webhook_settings;
DROP POLICY IF EXISTS "Only admins can update webhook settings" ON public.webhook_settings;

-- Create new policies that allow both service role and admin access
CREATE POLICY "Service role and admins can read webhook settings"
  ON public.webhook_settings
  FOR SELECT
  USING (
    -- Service role bypasses RLS but this makes it explicit
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR
    -- Regular admin users
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Service role and admins can insert webhook settings"
  ON public.webhook_settings
  FOR INSERT
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Service role and admins can update webhook settings"
  ON public.webhook_settings
  FOR UPDATE
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR
    has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR
    has_role(auth.uid(), 'admin'::app_role)
  );
