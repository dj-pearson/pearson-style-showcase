-- Tighten two RLS policy sets that granted the public role more than intended.
--
-- 1. amazon_price_alerts
--
-- The table stores user_email and has no user_id column, so "own row" cannot be
-- expressed with auth.uid(). The four policies were nonetheless named "own
-- alerts" while their predicates were USING (true), and none carried a TO
-- clause, so they applied to the public role. Anyone holding the anon key -
-- which ships in the frontend bundle - could read every subscriber's email
-- address and update or delete any alert.
--
-- SELECT, UPDATE and DELETE move to admins, matching how newsletter_subscribers
-- was fixed in 20251007232740. INSERT stays open: creating your own alert is the
-- intended public action, the same shape as contact_submissions and
-- support_tickets. Reading back an alert now needs an edge function on the
-- service role, as newsletter-signup already does for its table.

DROP POLICY IF EXISTS "Users can view own alerts" ON public.amazon_price_alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON public.amazon_price_alerts;
DROP POLICY IF EXISTS "Users can delete own alerts" ON public.amazon_price_alerts;

CREATE POLICY "Only admins can read price alerts"
  ON public.amazon_price_alerts
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update price alerts"
  ON public.amazon_price_alerts
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete price alerts"
  ON public.amazon_price_alerts
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. password_reset_tokens
--
-- SELECT and UPDATE were already scoped to user_id = auth.uid(), but INSERT was
-- WITH CHECK (true) with no TO clause, so the public role could write reset-token
-- rows for any user_id. No application code reads or writes this table; tokens
-- are issued server-side, where the service role bypasses RLS regardless. Closing
-- the client-side insert costs nothing and removes the forgery path.

DROP POLICY IF EXISTS "System can create reset tokens" ON public.password_reset_tokens;

CREATE POLICY "Only admins can create reset tokens"
  ON public.password_reset_tokens
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
