-- Drop write policies that were meant for "the service" but granted the public role.
--
-- Every policy below had no TO clause and a predicate of true, so it applied to
-- anon and authenticated alike. The edge functions that do these writes all build
-- their client with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS, so the
-- policies never helped them; they only let anyone holding the anon key (shipped
-- in the frontend bundle) insert or update rows.
--
-- Writers, as checked against src/ and supabase/functions/ on 2026-10-28:
--   amazon_pipeline_runs  amazon-article-pipeline (service role). Admin UI only selects.
--   amazon_pipeline_logs  amazon-article-pipeline (service role).
--   email_threads         receive-email, email-webhook-receiver, send-ticket-email
--                         (service role). Admin UI only selects; admins keep their
--                         FOR ALL policy.
--   support_tickets       receive-email, email-webhook-receiver (service role). No
--                         public page inserts tickets; the contact form posts to
--                         send-contact-email, which does not touch this table.
--                         Admins keep "Admins can manage support tickets" (FOR ALL).
--   ticket_activity_log   send-ticket-email (service role) and the SECURITY DEFINER
--                         function log_ticket_activity.
--   maintenance_results   SECURITY DEFINER function record_maintenance_run.
--   performance_history   maintenance-runner (service role).
--   db_optimization_log   maintenance-runner (service role).
--   amazon_price_alerts   No writer anywhere in the repo. 20260901000001 kept this
--                         INSERT open as an intended public action, but nothing
--                         implements it, and an open insert of arbitrary emails is a
--                         spam vector once alert mail goes out. A future signup
--                         form should go through an edge function on the service
--                         role, as newsletter-signup does.
--   ticket_responses      Service-role functions (receive-email, send-ticket-email)
--                         AND the admin ticket view, which inserts notes/replies with
--                         the admin's own session (TicketDetailView.tsx). There was
--                         no admin INSERT policy, so this one is replaced with an
--                         admin-only insert rather than dropped.
--
-- The admin predicate matches 20260309000001_fix_accounting_rls_admin_check.sql.

-- amazon_pipeline_runs
DROP POLICY IF EXISTS "Service can create runs" ON public.amazon_pipeline_runs;
DROP POLICY IF EXISTS "Service can update runs" ON public.amazon_pipeline_runs;

-- amazon_pipeline_logs
DROP POLICY IF EXISTS "Service can create logs" ON public.amazon_pipeline_logs;

-- email_threads
DROP POLICY IF EXISTS "Service can create email threads" ON public.email_threads;

-- support_tickets (both open INSERT policies; either one alone keeps the hole)
DROP POLICY IF EXISTS "Service can create support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Anyone can create support tickets" ON public.support_tickets;

-- ticket_activity_log
DROP POLICY IF EXISTS "Service can create ticket activity logs" ON public.ticket_activity_log;

-- maintenance_results
DROP POLICY IF EXISTS "Service can create maintenance results" ON public.maintenance_results;

-- performance_history
DROP POLICY IF EXISTS "Service can create performance history" ON public.performance_history;

-- db_optimization_log
DROP POLICY IF EXISTS "Service can create db optimization logs" ON public.db_optimization_log;

-- amazon_price_alerts
DROP POLICY IF EXISTS "Users can create alerts" ON public.amazon_price_alerts;

-- ticket_responses: replace open insert with admin-only insert
DROP POLICY IF EXISTS "Service can create ticket responses" ON public.ticket_responses;
DROP POLICY IF EXISTS "Admins can create ticket responses" ON public.ticket_responses;

CREATE POLICY "Admins can create ticket responses"
  ON public.ticket_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'role' = 'admin'
    OR public.is_email_whitelisted(auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  );
