-- Require an MFA-verified (aal2) session for direct PostgREST access to
-- admin-only tables.
--
-- Edge functions already refuse aal1 tokens (_shared/require-admin.ts), but the
-- admin dashboard also reads and writes these tables straight from PostgREST,
-- where the permissive policies only check the admin role or whitelist. A
-- stolen password therefore reached the same data as a full MFA login.
-- 20261101000003 closed this for secure_vault_items; this does the rest.
--
-- A RESTRICTIVE policy is ANDed with every permissive one, so admins keep
-- exactly the access they had, now only at aal2.
--
-- Scope notes:
--   * TO authenticated only. Anon flows (contact form, newsletter signup,
--     inbound email) write through edge functions with the service role, and
--     service_role bypasses RLS, so neither is affected.
--   * SECURITY DEFINER helpers (has_role, is_email_whitelisted,
--     get_user_permissions) run as the table owner and bypass RLS, so the
--     login flow can still resolve roles for an aal1 session.
--   * Deliberately left out: admin_activity_log and security_events (the
--     browser inserts audit rows before MFA completes), trusted_devices and
--     device_trust_events (used during the MFA step), and any table with a
--     public read policy.
--
-- Each table is skipped if it does not exist, so this is safe to re-run.

DO $migration$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    -- RBAC
    'user_roles', 'admin_whitelist',
    -- Accounting (list from 20260309000001 plus accounting_documents)
    'currencies', 'accounts', 'tax_rates', 'contacts',
    'invoices', 'invoice_items', 'payments', 'payment_allocations',
    'journal_entries', 'journal_entry_lines',
    'import_sources', 'import_logs',
    'platforms', 'expense_categories', 'recurring_transactions',
    'platform_transactions', 'budgets', 'accounting_documents',
    -- Inbound submissions
    'contact_submissions', 'newsletter_subscribers',
    -- Support desk and email
    'support_tickets', 'ticket_responses', 'ticket_activity_log',
    'canned_responses', 'email_mailboxes', 'email_threads',
    -- Admin settings
    'email_webhook_settings', 'webhook_settings', 'notification_settings',
    'alert_rules', 'maintenance_tasks', 'maintenance_results'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE NOTICE 'require_aal2: table public.% not found, skipping', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || ' requires aal2', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         AS RESTRICTIVE
         FOR ALL
         TO authenticated
         USING ((auth.jwt() ->> %L) = %L)
         WITH CHECK ((auth.jwt() ->> %L) = %L)',
      tbl || ' requires aal2', tbl, 'aal', 'aal2', 'aal', 'aal2'
    );
  END LOOP;
END $migration$;
