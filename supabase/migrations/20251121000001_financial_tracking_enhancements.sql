-- =====================================================
-- Financial Tracking Enhancements
-- Platform tracking, recurring expenses, and tax categorization
-- =====================================================

-- =====================================================
-- PLATFORMS TABLE
-- Track multiple revenue and expense platforms
-- =====================================================
CREATE TABLE IF NOT EXISTS public.platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- 'Amazon Affiliate', 'Stripe', 'Medium', 'YouTube', etc.
  platform_type TEXT NOT NULL CHECK (platform_type IN ('revenue', 'expense', 'both')),
  category TEXT, -- 'affiliate', 'payment_processor', 'ai_service', 'hosting', 'domain', 'email', etc.
  description TEXT,
  logo_url TEXT,
  website_url TEXT,

  -- Account mappings
  default_income_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  default_expense_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,

  -- Integration details
  api_enabled BOOLEAN DEFAULT false,
  api_config JSONB, -- API configuration if applicable

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  monthly_budget DECIMAL(15, 2), -- For expense platforms
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- EXPENSE CATEGORIES TABLE
-- Tax-ready expense categorization
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- 'AI Services', 'Domain & Hosting', 'Email Services', 'Software', etc.
  category_code TEXT, -- IRS Schedule C category code
  description TEXT,
  tax_deductible BOOLEAN DEFAULT true,

  -- Account mapping
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,

  -- Parent category for hierarchy
  parent_category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- RECURRING TRANSACTIONS TABLE
-- Automate monthly/yearly recurring expenses and revenue
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),

  -- Basic details
  name TEXT NOT NULL, -- 'OpenAI Subscription', 'Domain Renewal', etc.
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  currency_id UUID REFERENCES public.currencies(id) ON DELETE SET NULL,

  -- Platform and category
  platform_id UUID REFERENCES public.platforms(id) ON DELETE SET NULL,
  expense_category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- Account mapping
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,

  -- Recurrence pattern
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  interval_count INTEGER DEFAULT 1, -- Every X months/days/etc.
  start_date DATE NOT NULL,
  end_date DATE, -- NULL = indefinite

  -- Auto-creation settings
  auto_create BOOLEAN DEFAULT true,
  auto_post BOOLEAN DEFAULT false, -- Auto-post journal entries
  days_in_advance INTEGER DEFAULT 0, -- Create X days before due

  -- Last created
  last_created_date DATE,
  next_due_date DATE,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- PLATFORM TRANSACTIONS TABLE
-- Link transactions to platforms for detailed tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS public.platform_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Amount
  amount DECIMAL(15, 2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('revenue', 'expense')),

  -- Links to accounting records
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,

  -- Category
  expense_category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,

  -- Details
  description TEXT NOT NULL,
  reference_number TEXT,
  external_id TEXT, -- ID from platform

  -- Metadata
  metadata JSONB, -- Platform-specific data

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- BUDGET TABLE
-- Track budgets by category and platform
-- =====================================================
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_type TEXT NOT NULL CHECK (budget_type IN ('category', 'platform', 'account')),

  -- Reference
  expense_category_id UUID REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  platform_id UUID REFERENCES public.platforms(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,

  -- Time period
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Budget amount
  budget_amount DECIMAL(15, 2) NOT NULL,
  actual_amount DECIMAL(15, 2) DEFAULT 0,

  -- Alerts
  alert_threshold DECIMAL(5, 2) DEFAULT 80.00, -- Alert at X% of budget
  alert_enabled BOOLEAN DEFAULT true,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure only one reference is set
  CHECK (
    (expense_category_id IS NOT NULL AND platform_id IS NULL AND account_id IS NULL) OR
    (expense_category_id IS NULL AND platform_id IS NOT NULL AND account_id IS NULL) OR
    (expense_category_id IS NULL AND platform_id IS NULL AND account_id IS NOT NULL)
  )
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_platforms_type ON public.platforms(platform_type);
CREATE INDEX IF NOT EXISTS idx_platforms_category ON public.platforms(category);
CREATE INDEX IF NOT EXISTS idx_platforms_active ON public.platforms(is_active);

CREATE INDEX IF NOT EXISTS idx_expense_categories_parent ON public.expense_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON public.expense_categories(is_active);

CREATE INDEX IF NOT EXISTS idx_recurring_transactions_type ON public.recurring_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_frequency ON public.recurring_transactions(frequency);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_active ON public.recurring_transactions(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_next_due ON public.recurring_transactions(next_due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_platform ON public.recurring_transactions(platform_id);

CREATE INDEX IF NOT EXISTS idx_platform_transactions_platform ON public.platform_transactions(platform_id);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_date ON public.platform_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_type ON public.platform_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_category ON public.platform_transactions(expense_category_id);

CREATE INDEX IF NOT EXISTS idx_budgets_type ON public.budgets(budget_type);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON public.budgets(period_type);
CREATE INDEX IF NOT EXISTS idx_budgets_dates ON public.budgets(start_date, end_date);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin only access
CREATE POLICY "Allow admin full access to platforms"
  ON public.platforms FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

CREATE POLICY "Allow admin full access to expense_categories"
  ON public.expense_categories FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

CREATE POLICY "Allow admin full access to recurring_transactions"
  ON public.recurring_transactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

CREATE POLICY "Allow admin full access to platform_transactions"
  ON public.platform_transactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

CREATE POLICY "Allow admin full access to budgets"
  ON public.budgets FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================
CREATE TRIGGER update_platforms_updated_at
  BEFORE UPDATE ON public.platforms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_transactions_updated_at
  BEFORE UPDATE ON public.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_transactions_updated_at
  BEFORE UPDATE ON public.platform_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to calculate next due date for recurring transactions
CREATE OR REPLACE FUNCTION calculate_next_due_date(
  p_last_date DATE,
  p_frequency TEXT,
  p_interval_count INTEGER
)
RETURNS DATE AS $$
BEGIN
  RETURN CASE p_frequency
    WHEN 'daily' THEN p_last_date + (p_interval_count || ' days')::INTERVAL
    WHEN 'weekly' THEN p_last_date + (p_interval_count || ' weeks')::INTERVAL
    WHEN 'monthly' THEN p_last_date + (p_interval_count || ' months')::INTERVAL
    WHEN 'quarterly' THEN p_last_date + (p_interval_count * 3 || ' months')::INTERVAL
    WHEN 'yearly' THEN p_last_date + (p_interval_count || ' years')::INTERVAL
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update next_due_date when recurring transaction is created/updated
CREATE OR REPLACE FUNCTION update_next_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_created_date IS NULL THEN
    NEW.next_due_date := NEW.start_date;
  ELSE
    NEW.next_due_date := calculate_next_due_date(
      NEW.last_created_date,
      NEW.frequency,
      NEW.interval_count
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_next_due_date
  BEFORE INSERT OR UPDATE ON public.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION update_next_due_date();

-- =====================================================
-- SEED DATA
-- =====================================================

-- Get account IDs for defaults
DO $$
DECLARE
  v_service_revenue_id UUID;
  v_api_services_id UUID;
  v_software_id UUID;
  v_other_income_id UUID;
BEGIN
  -- Get account IDs
  SELECT id INTO v_service_revenue_id FROM accounts WHERE account_number = '4200';
  SELECT id INTO v_api_services_id FROM accounts WHERE account_number = '5120';
  SELECT id INTO v_software_id FROM accounts WHERE account_number = '5110';
  SELECT id INTO v_other_income_id FROM accounts WHERE account_number = '4300';

  -- Insert expense categories
  INSERT INTO public.expense_categories (name, category_code, description, tax_deductible, account_id) VALUES
  ('AI Services', '27a', 'AI API services (OpenAI, Anthropic, etc.)', true, v_api_services_id),
  ('Domain & Hosting', '21', 'Domain registrations and web hosting', true, v_software_id),
  ('Email Services', '27a', 'Email hosting and services', true, v_software_id),
  ('Software Subscriptions', '18', 'Software and SaaS subscriptions', true, v_software_id),
  ('Development Tools', '18', 'Development platforms and tools', true, v_software_id),
  ('Cloud Services', '27a', 'Cloud computing and storage', true, v_api_services_id),
  ('Marketing & Advertising', '8', 'Marketing and advertising expenses', true, NULL),
  ('Professional Services', '17', 'Professional and consulting services', true, NULL);

  -- Insert common platforms
  INSERT INTO public.platforms (name, platform_type, category, description, default_income_account_id, default_expense_account_id, is_active) VALUES
  -- Revenue platforms
  ('Amazon Affiliate', 'revenue', 'affiliate', 'Amazon Associates affiliate program', v_other_income_id, NULL, true),
  ('Stripe', 'both', 'payment_processor', 'Payment processing platform', v_service_revenue_id, NULL, true),
  ('Medium', 'revenue', 'content', 'Medium Partner Program', v_other_income_id, NULL, true),
  ('YouTube', 'revenue', 'content', 'YouTube ad revenue', v_other_income_id, NULL, true),

  -- AI Services (expense)
  ('OpenAI', 'expense', 'ai_service', 'OpenAI API services', NULL, v_api_services_id, true),
  ('Anthropic', 'expense', 'ai_service', 'Anthropic Claude API', NULL, v_api_services_id, true),

  -- Development platforms (expense)
  ('Lovable', 'expense', 'development', 'Lovable development platform', NULL, v_software_id, true),
  ('Replit', 'expense', 'development', 'Replit development platform', NULL, v_software_id, true),
  ('Vercel', 'expense', 'hosting', 'Vercel hosting platform', NULL, v_software_id, true),
  ('Cloudflare', 'expense', 'hosting', 'Cloudflare CDN and hosting', NULL, v_software_id, true),

  -- Infrastructure (expense)
  ('Supabase', 'expense', 'database', 'Supabase backend platform', NULL, v_api_services_id, true),
  ('Google Workspace', 'expense', 'email', 'Email and productivity suite', NULL, v_software_id, true),
  ('Namecheap', 'expense', 'domain', 'Domain registrar', NULL, v_software_id, true),
  ('GoDaddy', 'expense', 'domain', 'Domain and hosting services', NULL, v_software_id, true);

END $$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.platforms IS 'Track multiple revenue and expense platforms';
COMMENT ON TABLE public.expense_categories IS 'Tax-ready expense categorization';
COMMENT ON TABLE public.recurring_transactions IS 'Recurring income and expenses with auto-creation';
COMMENT ON TABLE public.platform_transactions IS 'Link transactions to specific platforms for detailed tracking';
COMMENT ON TABLE public.budgets IS 'Budget tracking by category, platform, or account';
