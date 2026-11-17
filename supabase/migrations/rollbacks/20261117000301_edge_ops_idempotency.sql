-- Rollback for 20261117000301_edge_ops_idempotency.sql
-- Redeploy the previous receive-email, email-webhook-receiver,
-- send-ticket-email and maintenance-runner first: the new send-ticket-email
-- writes idempotency_key and send_status and fails without them.

DROP INDEX IF EXISTS public.uq_support_tickets_email_message_id;
DROP INDEX IF EXISTS public.uq_email_threads_inbound_message_id;
DROP INDEX IF EXISTS public.uq_email_threads_idempotency_key;

ALTER TABLE public.email_threads
  DROP CONSTRAINT IF EXISTS email_threads_send_status_check,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS send_status;

UPDATE public.maintenance_tasks
SET enabled = true
WHERE task_name IN (
  'Weekly Performance Audit',
  'Monthly Database Optimization',
  'Daily Sitemap Generation'
);
