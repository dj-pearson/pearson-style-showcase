-- Edge function idempotency and maintenance cleanup.
--
-- 1. Inbound email dedupe. receive-email and email-webhook-receiver now look a
--    message up by Message-ID before inserting, and treat a unique violation
--    (23505) as "already processed". These partial unique indexes are what make
--    that race-proof when Make.com retries a webhook while the first attempt is
--    still running.
--
--    The indexes are created only when the existing data has no duplicates.
--    If duplicates are already there (they can be: nothing stopped them
--    before), the index is skipped with a NOTICE naming the count, and the
--    lookup-first code still prevents new ones in the common case. Nothing is
--    deleted automatically, because a duplicate ticket may already carry agent
--    replies. To finish the job by hand, list the duplicates with the query in
--    the NOTICE, merge or delete them, and re-run this file (it is idempotent).
--
-- 2. send-ticket-email idempotency. Outbound email_threads rows gain an
--    idempotency_key (client-supplied, unique when set) and a send_status
--    ('pending' -> 'sent'). The function inserts the pending row before
--    talking to SMTP, so a retried request with the same key returns the
--    first result instead of mailing the customer twice.
--
-- 3. Placeholder maintenance tasks. Weekly Performance Audit, Monthly Database
--    Optimization and Daily Sitemap Generation had no real implementation and
--    recorded success while doing nothing. maintenance-runner now records them
--    as 'skipped'; they are disabled here so the scheduler stops running them.

-- ---------------------------------------------------------------------------
-- 1. Inbound Message-ID uniqueness
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_dupes integer;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT email_message_id
    FROM public.support_tickets
    WHERE email_message_id IS NOT NULL AND email_message_id <> ''
    GROUP BY email_message_id
    HAVING count(*) > 1
  ) d;

  IF v_dupes = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_support_tickets_email_message_id
      ON public.support_tickets (email_message_id)
      WHERE email_message_id IS NOT NULL AND email_message_id <> '';
  ELSE
    RAISE NOTICE 'uq_support_tickets_email_message_id skipped: % Message-IDs appear on more than one ticket. Find them with: SELECT email_message_id, array_agg(id ORDER BY created_at) FROM public.support_tickets WHERE email_message_id IS NOT NULL AND email_message_id <> '''' GROUP BY 1 HAVING count(*) > 1;', v_dupes;
  END IF;

  SELECT count(*) INTO v_dupes FROM (
    SELECT message_id
    FROM public.email_threads
    WHERE direction = 'inbound' AND message_id IS NOT NULL AND message_id <> ''
    GROUP BY message_id
    HAVING count(*) > 1
  ) d;

  IF v_dupes = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_email_threads_inbound_message_id
      ON public.email_threads (message_id)
      WHERE direction = 'inbound' AND message_id IS NOT NULL AND message_id <> '';
  ELSE
    RAISE NOTICE 'uq_email_threads_inbound_message_id skipped: % inbound Message-IDs appear on more than one thread row. Find them with: SELECT message_id, array_agg(id ORDER BY created_at) FROM public.email_threads WHERE direction = ''inbound'' AND message_id IS NOT NULL AND message_id <> '''' GROUP BY 1 HAVING count(*) > 1;', v_dupes;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Outbound send idempotency
-- ---------------------------------------------------------------------------

ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS send_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_threads_send_status_check'
      AND conrelid = 'public.email_threads'::regclass
  ) THEN
    ALTER TABLE public.email_threads
      ADD CONSTRAINT email_threads_send_status_check
      CHECK (send_status IS NULL OR send_status IN ('pending', 'sent'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_threads_idempotency_key
  ON public.email_threads (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.email_threads.idempotency_key IS
  'Client-supplied key for send-ticket-email; a repeat request with the same key returns the first result instead of sending again.';
COMMENT ON COLUMN public.email_threads.send_status IS
  'Outbound only: pending while SMTP is in flight (or if the outcome is unknown), sent once SMTP accepted it. NULL for inbound and for rows written before this column existed.';

-- ---------------------------------------------------------------------------
-- 3. Disable placeholder maintenance tasks
-- ---------------------------------------------------------------------------

UPDATE public.maintenance_tasks
SET enabled = false
WHERE task_name IN (
  'Weekly Performance Audit',
  'Monthly Database Optimization',
  'Daily Sitemap Generation'
);
