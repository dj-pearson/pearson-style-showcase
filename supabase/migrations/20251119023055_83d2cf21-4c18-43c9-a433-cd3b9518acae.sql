-- Create support_tickets table (if not exists)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID,
  mailbox_id UUID REFERENCES public.email_mailboxes(id),
  email_message_id TEXT,
  email_thread_id UUID,
  email_in_reply_to TEXT,
  ai_sentiment_score NUMERIC,
  ai_suggested_responses JSONB DEFAULT '[]'::jsonb,
  user_agent TEXT,
  referrer_url TEXT,
  page_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- Create contact_submissions table (if not exists)
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new',
  user_agent TEXT,
  referrer_url TEXT
);

-- Create ai_tool_submissions table (if not exists)
CREATE TABLE IF NOT EXISTS public.ai_tool_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name TEXT NOT NULL,
  description TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  email TEXT NOT NULL,
  github_link TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_last_activity ON public.support_tickets(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_submitted ON public.contact_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tool_submissions_submitted ON public.ai_tool_submissions(submitted_at DESC);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tool_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets (only if they don't exist)
DO $$ BEGIN
  CREATE POLICY "Admins can manage support tickets"
    ON public.support_tickets
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service can create support tickets"
    ON public.support_tickets
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS Policies for contact_submissions
DO $$ BEGIN
  CREATE POLICY "Admins can read contact submissions"
    ON public.contact_submissions
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service can create contact submissions"
    ON public.contact_submissions
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS Policies for ai_tool_submissions
DO $$ BEGIN
  CREATE POLICY "Admins can manage ai tool submissions"
    ON public.ai_tool_submissions
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service can create ai tool submissions"
    ON public.ai_tool_submissions
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;