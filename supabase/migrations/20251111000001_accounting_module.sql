-- =====================================================
-- Accounting Module Schema
-- Inspired by Frappe Books with integrated import capabilities
-- =====================================================

-- =====================================================
-- CURRENCIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- USD, EUR, GBP, etc.
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  exchange_rate DECIMAL(15, 6) DEFAULT 1.0, -- Rate relative to base currency
  is_base BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- CHART OF ACCOUNTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT UNIQUE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN (
    'Asset', 'Liability', 'Equity', 'Income', 'Expense'
  )),
  account_subtype TEXT, -- Current Asset, Fixed Asset, Current Liability, etc.
  parent_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  currency_id UUID REFERENCES public.currencies(id) ON DELETE SET NULL,
  description TEXT,
  is_group BOOLEAN DEFAULT false, -- Group accounts for hierarchy
  is_active BOOLEAN DEFAULT true,
  opening_balance DECIMAL(15, 2) DEFAULT 0,
  current_balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TAX RATES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., "Sales Tax", "VAT", "GST"
  rate DECIMAL(5, 2) NOT NULL, -- Percentage rate
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL, -- Tax liability account
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- CONTACTS (Customers & Vendors)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('customer', 'vendor', 'both')),
  company_name TEXT,
  contact_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  tax_id TEXT, -- Tax ID / VAT number
  currency_id UUID REFERENCES public.currencies(id) ON DELETE SET NULL,
  payment_terms TEXT, -- e.g., "Net 30", "Due on Receipt"
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INVOICES (Sales Invoices & Purchase Bills)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('sales', 'purchase')),
  invoice_number TEXT UNIQUE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  currency_id UUID REFERENCES public.currencies(id) ON DELETE SET NULL,
  exchange_rate DECIMAL(15, 6) DEFAULT 1.0,

  -- Amounts
  subtotal DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  amount_due DECIMAL(15, 2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'void')),

  -- Import tracking
  import_source TEXT, -- 'stripe', 'openai', 'anthropic', 'lovable', 'replit', 'manual', etc.
  external_id TEXT, -- ID from the external system
  external_url TEXT, -- Link to view in external system
  imported_at TIMESTAMPTZ,

  -- Additional fields
  reference_number TEXT,
  notes TEXT,
  terms TEXT,
  attachments JSONB, -- Array of attachment URLs
  metadata JSONB, -- Additional data from import sources

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INVOICE ITEMS (Line Items)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,

  -- Item details
  description TEXT NOT NULL,
  quantity DECIMAL(15, 4) DEFAULT 1,
  unit_price DECIMAL(15, 2) NOT NULL,

  -- Tax
  tax_rate_id UUID REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  tax_amount DECIMAL(15, 2) DEFAULT 0,

  -- Discount
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(15, 2) DEFAULT 0,

  -- Total
  line_total DECIMAL(15, 2) NOT NULL,

  -- Account mapping
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,

  metadata JSONB, -- Additional data like product_id, sku, etc.

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(invoice_id, line_number)
);

-- =====================================================
-- PAYMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('received', 'made')),
  payment_number TEXT UNIQUE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Amount
  amount DECIMAL(15, 2) NOT NULL,
  currency_id UUID REFERENCES public.currencies(id) ON DELETE SET NULL,

  -- Payment method
  payment_method TEXT, -- 'bank_transfer', 'credit_card', 'cash', 'check', etc.
  reference_number TEXT, -- Check number, transaction ID, etc.

  -- Account mapping
  from_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,

  -- Import tracking
  import_source TEXT,
  external_id TEXT,
  external_url TEXT,
  imported_at TIMESTAMPTZ,

  notes TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- PAYMENT ALLOCATIONS (Link payments to invoices)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_allocated DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- JOURNAL ENTRIES (Manual double-entry bookkeeping)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT UNIQUE NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT,
  notes TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- JOURNAL ENTRY LINES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(journal_entry_id, line_number),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

-- =====================================================
-- IMPORT SOURCES (Configuration for integrations)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.import_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT UNIQUE NOT NULL, -- 'stripe', 'openai', 'anthropic', etc.
  source_type TEXT NOT NULL, -- 'api', 'manual', 'csv', etc.
  is_active BOOLEAN DEFAULT true,

  -- API Configuration (encrypted in production)
  api_key TEXT, -- Should be encrypted
  api_secret TEXT, -- Should be encrypted
  configuration JSONB, -- Additional config like webhook URLs, endpoints, etc.

  -- Default mappings
  default_income_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  default_expense_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  default_bank_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,

  last_import_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- IMPORT LOGS (Track all imports)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_source_id UUID REFERENCES public.import_sources(id) ON DELETE SET NULL,
  import_type TEXT NOT NULL, -- 'invoice', 'payment', 'expense', etc.
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),

  -- Statistics
  records_total INTEGER DEFAULT 0,
  records_imported INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,

  -- Details
  error_message TEXT,
  import_data JSONB, -- Store the raw import data
  result_data JSONB, -- Store created record IDs, etc.

  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_accounts_type ON public.accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON public.accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON public.accounts(parent_account_id);

CREATE INDEX IF NOT EXISTS idx_contacts_type ON public.contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_active ON public.contacts(is_active);

CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON public.invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_import_source ON public.invoices(import_source);
CREATE INDEX IF NOT EXISTS idx_invoices_external_id ON public.invoices(external_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_account ON public.invoice_items(account_id);

CREATE INDEX IF NOT EXISTS idx_payments_type ON public.payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_contact ON public.payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON public.payment_allocations(invoice_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON public.journal_entries(status);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON public.journal_entry_lines(account_id);

CREATE INDEX IF NOT EXISTS idx_import_logs_source ON public.import_logs(import_source_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_status ON public.import_logs(status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - Admin only access
-- =====================================================
-- Currencies
CREATE POLICY "Allow admin full access to currencies"
  ON public.currencies FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Accounts
CREATE POLICY "Allow admin full access to accounts"
  ON public.accounts FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Tax Rates
CREATE POLICY "Allow admin full access to tax_rates"
  ON public.tax_rates FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Contacts
CREATE POLICY "Allow admin full access to contacts"
  ON public.contacts FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Invoices
CREATE POLICY "Allow admin full access to invoices"
  ON public.invoices FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Invoice Items
CREATE POLICY "Allow admin full access to invoice_items"
  ON public.invoice_items FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Payments
CREATE POLICY "Allow admin full access to payments"
  ON public.payments FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Payment Allocations
CREATE POLICY "Allow admin full access to payment_allocations"
  ON public.payment_allocations FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Journal Entries
CREATE POLICY "Allow admin full access to journal_entries"
  ON public.journal_entries FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Journal Entry Lines
CREATE POLICY "Allow admin full access to journal_entry_lines"
  ON public.journal_entry_lines FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Import Sources
CREATE POLICY "Allow admin full access to import_sources"
  ON public.import_sources FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Import Logs
CREATE POLICY "Allow admin full access to import_logs"
  ON public.import_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================
CREATE TRIGGER update_currencies_updated_at
  BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_rates_updated_at
  BEFORE UPDATE ON public.tax_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at
  BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_import_sources_updated_at
  BEFORE UPDATE ON public.import_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update invoice totals from line items
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(15, 2);
  v_tax_amount DECIMAL(15, 2);
  v_discount_amount DECIMAL(15, 2);
  v_total DECIMAL(15, 2);
BEGIN
  -- Calculate totals from invoice items
  SELECT
    COALESCE(SUM(line_total - tax_amount - discount_amount), 0),
    COALESCE(SUM(tax_amount), 0),
    COALESCE(SUM(discount_amount), 0),
    COALESCE(SUM(line_total), 0)
  INTO v_subtotal, v_tax_amount, v_discount_amount, v_total
  FROM invoice_items
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Update the invoice
  UPDATE invoices
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    discount_amount = v_discount_amount,
    total_amount = v_total,
    amount_due = v_total - amount_paid
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice totals when items change
CREATE TRIGGER update_invoice_totals_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_invoice_totals();

-- Function to update invoice amount_paid from payment allocations
CREATE OR REPLACE FUNCTION update_invoice_amount_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_amount_paid DECIMAL(15, 2);
  v_total_amount DECIMAL(15, 2);
  v_invoice_id UUID;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Calculate total allocated
  SELECT COALESCE(SUM(amount_allocated), 0)
  INTO v_amount_paid
  FROM payment_allocations
  WHERE invoice_id = v_invoice_id;

  -- Get total amount
  SELECT total_amount
  INTO v_total_amount
  FROM invoices
  WHERE id = v_invoice_id;

  -- Update invoice
  UPDATE invoices
  SET
    amount_paid = v_amount_paid,
    amount_due = v_total_amount - v_amount_paid,
    status = CASE
      WHEN v_amount_paid >= v_total_amount THEN 'paid'
      WHEN v_amount_paid > 0 THEN 'partially_paid'
      ELSE status
    END
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice payment status
CREATE TRIGGER update_invoice_amount_paid_on_allocation
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION update_invoice_amount_paid();

-- Function to update account balances from journal entries
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_balance DECIMAL(15, 2);
  v_account_id UUID;
BEGIN
  v_account_id := COALESCE(NEW.account_id, OLD.account_id);

  -- Calculate balance (debits increase assets/expenses, credits increase liabilities/income/equity)
  SELECT
    a.opening_balance + COALESCE(SUM(jel.debit - jel.credit), 0)
  INTO v_balance
  FROM accounts a
  LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE a.id = v_account_id
    AND (je.status = 'posted' OR je.id IS NULL)
  GROUP BY a.id, a.opening_balance;

  -- Update account balance
  UPDATE accounts
  SET current_balance = v_balance
  WHERE id = v_account_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update account balances
CREATE TRIGGER update_account_balance_on_journal_line
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- =====================================================
-- SEED DATA - Default Chart of Accounts
-- =====================================================

-- Insert base currency
INSERT INTO public.currencies (code, name, symbol, is_base) VALUES
('USD', 'US Dollar', '$', true);

-- Get USD currency ID for use in accounts
DO $$
DECLARE
  v_usd_id UUID;
BEGIN
  SELECT id INTO v_usd_id FROM currencies WHERE code = 'USD';

  -- ASSETS
  INSERT INTO public.accounts (account_number, account_name, account_type, account_subtype, is_group, currency_id) VALUES
  ('1000', 'Assets', 'Asset', 'Group', true, v_usd_id),
  ('1100', 'Current Assets', 'Asset', 'Current Asset', true, v_usd_id),
  ('1110', 'Cash', 'Asset', 'Current Asset', false, v_usd_id),
  ('1120', 'Bank Accounts', 'Asset', 'Current Asset', false, v_usd_id),
  ('1130', 'Accounts Receivable', 'Asset', 'Current Asset', false, v_usd_id),
  ('1200', 'Fixed Assets', 'Asset', 'Fixed Asset', true, v_usd_id),
  ('1210', 'Equipment', 'Asset', 'Fixed Asset', false, v_usd_id),
  ('1220', 'Accumulated Depreciation', 'Asset', 'Fixed Asset', false, v_usd_id);

  -- LIABILITIES
  INSERT INTO public.accounts (account_number, account_name, account_type, account_subtype, is_group, currency_id) VALUES
  ('2000', 'Liabilities', 'Liability', 'Group', true, v_usd_id),
  ('2100', 'Current Liabilities', 'Liability', 'Current Liability', true, v_usd_id),
  ('2110', 'Accounts Payable', 'Liability', 'Current Liability', false, v_usd_id),
  ('2120', 'Sales Tax Payable', 'Liability', 'Current Liability', false, v_usd_id),
  ('2130', 'Credit Card Payable', 'Liability', 'Current Liability', false, v_usd_id);

  -- EQUITY
  INSERT INTO public.accounts (account_number, account_name, account_type, account_subtype, is_group, currency_id) VALUES
  ('3000', 'Equity', 'Equity', 'Owner Equity', true, v_usd_id),
  ('3100', 'Owner Equity', 'Equity', 'Owner Equity', false, v_usd_id),
  ('3200', 'Retained Earnings', 'Equity', 'Retained Earnings', false, v_usd_id);

  -- INCOME
  INSERT INTO public.accounts (account_number, account_name, account_type, account_subtype, is_group, currency_id) VALUES
  ('4000', 'Income', 'Income', 'Group', true, v_usd_id),
  ('4100', 'Sales Revenue', 'Income', 'Revenue', false, v_usd_id),
  ('4200', 'Service Revenue', 'Income', 'Revenue', false, v_usd_id),
  ('4300', 'Other Income', 'Income', 'Other Income', false, v_usd_id);

  -- EXPENSES
  INSERT INTO public.accounts (account_number, account_name, account_type, account_subtype, is_group, currency_id) VALUES
  ('5000', 'Expenses', 'Expense', 'Group', true, v_usd_id),
  ('5100', 'Operating Expenses', 'Expense', 'Operating Expense', true, v_usd_id),
  ('5110', 'Software Subscriptions', 'Expense', 'Operating Expense', false, v_usd_id),
  ('5120', 'API & Cloud Services', 'Expense', 'Operating Expense', false, v_usd_id),
  ('5130', 'Office Supplies', 'Expense', 'Operating Expense', false, v_usd_id),
  ('5140', 'Marketing & Advertising', 'Expense', 'Operating Expense', false, v_usd_id),
  ('5200', 'Professional Fees', 'Expense', 'Professional Services', false, v_usd_id),
  ('5300', 'Bank Fees', 'Expense', 'Bank Charges', false, v_usd_id);

  -- Insert default tax rate
  INSERT INTO public.tax_rates (name, rate, description) VALUES
  ('Sales Tax', 7.00, 'Default sales tax rate');

  -- Insert default import sources (without API keys - to be configured)
  INSERT INTO public.import_sources (source_name, source_type, is_active, configuration) VALUES
  ('stripe', 'api', true, '{"endpoint": "https://api.stripe.com/v1", "description": "Import invoices and payments from Stripe"}'),
  ('openai', 'api', true, '{"endpoint": "https://api.openai.com/v1", "description": "Import API usage invoices from OpenAI"}'),
  ('anthropic', 'api', true, '{"endpoint": "https://api.anthropic.com/v1", "description": "Import API usage invoices from Anthropic Claude"}'),
  ('lovable', 'manual', true, '{"description": "Import invoices from Lovable"}'),
  ('replit', 'manual', true, '{"description": "Import invoices from Replit"}'),
  ('manual', 'manual', true, '{"description": "Manual invoice entry"}');

END $$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.currencies IS 'Supported currencies for multi-currency accounting';
COMMENT ON TABLE public.accounts IS 'Chart of accounts for double-entry bookkeeping';
COMMENT ON TABLE public.tax_rates IS 'Tax rates for automatic tax calculation';
COMMENT ON TABLE public.contacts IS 'Customers and vendors for invoicing';
COMMENT ON TABLE public.invoices IS 'Sales invoices and purchase bills';
COMMENT ON TABLE public.invoice_items IS 'Line items for invoices';
COMMENT ON TABLE public.payments IS 'Payment records (received and made)';
COMMENT ON TABLE public.payment_allocations IS 'Link payments to specific invoices';
COMMENT ON TABLE public.journal_entries IS 'Manual journal entries for double-entry bookkeeping';
COMMENT ON TABLE public.journal_entry_lines IS 'Individual debit/credit lines in journal entries';
COMMENT ON TABLE public.import_sources IS 'Configuration for external invoice import sources';
COMMENT ON TABLE public.import_logs IS 'Track all imports from external sources';
