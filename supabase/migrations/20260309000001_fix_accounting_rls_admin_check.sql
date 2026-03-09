-- =====================================================
-- Fix Accounting RLS: Use admin_whitelist/user_roles
-- instead of legacy admin_users table
-- =====================================================
-- The admin_users table is legacy and may be empty.
-- Dashboard access uses admin_whitelist (email) and
-- user_roles (admin role). This migration updates
-- accounting RLS policies to match.
-- =====================================================

-- Ensure is_email_whitelisted exists (SECURITY DEFINER bypasses RLS on admin_whitelist)
CREATE OR REPLACE FUNCTION public.is_email_whitelisted(_email TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_whitelist
    WHERE email = _email
      AND is_active = true
  )
$$;

-- Helper: Drop and recreate each policy with correct admin check
DO $migration$
DECLARE
  tbl TEXT;
  policy_using TEXT := $p$
    auth.jwt() ->> 'role' = 'admin'
    OR public.is_email_whitelisted(auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  $p$;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'currencies', 'accounts', 'tax_rates', 'contacts',
    'invoices', 'invoice_items', 'payments', 'payment_allocations',
    'journal_entries', 'journal_entry_lines',
    'import_sources', 'import_logs',
    'platforms', 'expense_categories', 'recurring_transactions',
    'platform_transactions', 'budgets'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Allow admin full access to %s" ON public.%s',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "Allow admin full access to %s"
        ON public.%s FOR ALL
        USING (%s)',
      tbl, tbl, policy_using
    );
  END LOOP;
END $migration$;
