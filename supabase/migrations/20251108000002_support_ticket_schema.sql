-- Support Ticket System Schema: AI-powered ticketing with context and knowledge base

-- Enhanced support tickets (replaces basic contact_submissions)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,

  -- User information
  user_email text,
  user_name text,

  -- Ticket management
  category text, -- 'bug', 'feature_request', 'question', 'billing', 'spam', 'other'
  priority integer DEFAULT 2, -- 1=low, 2=normal, 3=high, 4=urgent
  status text DEFAULT 'open', -- 'open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Context information
  user_agent text,
  referrer_url text,
  page_url text,
  session_id text,
  browser_info jsonb,
  error_context jsonb,
  user_history jsonb, -- Recent page views, clicks, etc.

  -- AI-powered features
  ai_suggested_responses jsonb, -- Array of suggested response templates
  ai_category_confidence numeric, -- 0-1 confidence score
  ai_sentiment_score numeric, -- -1 to 1 (negative to positive)
  ai_similar_tickets uuid[], -- IDs of similar previous tickets
  ai_suggested_kb_articles uuid[], -- Relevant knowledge base articles

  -- Timing
  created_at timestamptz NOT NULL DEFAULT now(),
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_activity_at timestamptz DEFAULT now(),

  -- Satisfaction
  satisfaction_rating integer, -- 1-5 stars
  satisfaction_comment text,
  satisfaction_submitted_at timestamptz,

  -- Metadata
  tags text[] DEFAULT ARRAY[]::text[],
  internal_notes text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Ticket responses/comments (conversation thread)
CREATE TABLE IF NOT EXISTS public.ticket_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text NOT NULL,
  author_name text NOT NULL,
  author_type text NOT NULL, -- 'admin', 'user', 'system'
  message text NOT NULL,
  is_internal boolean DEFAULT false, -- Internal notes not visible to user
  is_ai_generated boolean DEFAULT false,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Knowledge base articles (self-service FAQ)
CREATE TABLE IF NOT EXISTS public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  content text NOT NULL,
  excerpt text,
  category text,
  keywords text[] DEFAULT ARRAY[]::text[],

  -- SEO
  meta_title text,
  meta_description text,

  -- Analytics
  view_count integer DEFAULT 0,
  helpful_count integer DEFAULT 0,
  not_helpful_count integer DEFAULT 0,
  search_rank numeric DEFAULT 0, -- Calculated relevance score

  -- Status
  published boolean DEFAULT false,
  featured boolean DEFAULT false,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,

  -- Author
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Related
  related_articles uuid[] DEFAULT ARRAY[]::uuid[]
);

-- Canned responses (quick reply templates)
CREATE TABLE IF NOT EXISTS public.canned_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  shortcut text UNIQUE, -- Optional keyboard shortcut (e.g., "/welcome")
  content text NOT NULL,
  category text,

  -- Usage tracking
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,

  -- Conditions
  applies_to_categories text[] DEFAULT ARRAY[]::text[], -- Only show for certain ticket categories

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Ticket activity log (audit trail)
CREATE TABLE IF NOT EXISTS public.ticket_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL, -- 'created', 'assigned', 'status_changed', 'category_changed', 'responded', 'closed'
  old_value text,
  new_value text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Support tickets

-- Public can create tickets (for contact form)
CREATE POLICY "Anyone can create support tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (true);

-- Admins can view all tickets
CREATE POLICY "Admins can read all support tickets"
ON public.support_tickets
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update tickets
CREATE POLICY "Admins can update support tickets"
ON public.support_tickets
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete tickets (spam removal)
CREATE POLICY "Admins can delete support tickets"
ON public.support_tickets
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: Ticket responses

-- Service can create responses (from contact form, AI)
CREATE POLICY "Service can create ticket responses"
ON public.ticket_responses
FOR INSERT
WITH CHECK (true);

-- Admins can read all responses
CREATE POLICY "Admins can read ticket responses"
ON public.ticket_responses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update their own responses
CREATE POLICY "Admins can update ticket responses"
ON public.ticket_responses
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete responses
CREATE POLICY "Admins can delete ticket responses"
ON public.ticket_responses
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: Knowledge base articles

-- Public can read published KB articles
CREATE POLICY "Anyone can read published KB articles"
ON public.kb_articles
FOR SELECT
USING (published = true);

-- Admins can read all KB articles
CREATE POLICY "Admins can read all KB articles"
ON public.kb_articles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage KB articles
CREATE POLICY "Admins can manage KB articles"
ON public.kb_articles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: Canned responses (admin only)
CREATE POLICY "Admins can manage canned responses"
ON public.canned_responses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: Ticket activity log (admin read, service write)
CREATE POLICY "Service can create ticket activity logs"
ON public.ticket_activity_log
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read ticket activity logs"
ON public.ticket_activity_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON public.support_tickets(priority DESC);
CREATE INDEX idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX idx_support_tickets_assigned_to ON public.support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX idx_support_tickets_last_activity ON public.support_tickets(last_activity_at DESC);
CREATE INDEX idx_support_tickets_user_email ON public.support_tickets(user_email);
CREATE INDEX idx_support_tickets_ticket_number ON public.support_tickets(ticket_number);

CREATE INDEX idx_ticket_responses_ticket_id ON public.ticket_responses(ticket_id);
CREATE INDEX idx_ticket_responses_created_at ON public.ticket_responses(created_at);

CREATE INDEX idx_kb_articles_published ON public.kb_articles(published) WHERE published = true;
CREATE INDEX idx_kb_articles_slug ON public.kb_articles(slug);
CREATE INDEX idx_kb_articles_category ON public.kb_articles(category);
CREATE INDEX idx_kb_articles_keywords ON public.kb_articles USING gin(keywords);
CREATE INDEX idx_kb_articles_view_count ON public.kb_articles(view_count DESC);

CREATE INDEX idx_canned_responses_category ON public.canned_responses(category);
CREATE INDEX idx_canned_responses_shortcut ON public.canned_responses(shortcut);

CREATE INDEX idx_ticket_activity_ticket_id ON public.ticket_activity_log(ticket_id);
CREATE INDEX idx_ticket_activity_created_at ON public.ticket_activity_log(created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_ticket_responses_updated_at
BEFORE UPDATE ON public.ticket_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kb_articles_updated_at
BEFORE UPDATE ON public.kb_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_canned_responses_updated_at
BEFORE UPDATE ON public.canned_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update last_activity_at on ticket when response added
CREATE OR REPLACE FUNCTION update_ticket_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.support_tickets
  SET last_activity_at = NEW.created_at
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ticket_activity_on_response
AFTER INSERT ON public.ticket_responses
FOR EACH ROW
EXECUTE FUNCTION update_ticket_last_activity();

-- Function to generate ticket number (e.g., TICKET-001234)
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text AS $$
DECLARE
  ticket_num text;
  ticket_count integer;
BEGIN
  -- Get count of existing tickets
  SELECT COUNT(*) INTO ticket_count FROM public.support_tickets;

  -- Generate ticket number with zero padding
  ticket_num := 'TICKET-' || LPAD((ticket_count + 1)::text, 6, '0');

  RETURN ticket_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket number on insert
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_ticket_number_on_insert
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION set_ticket_number();

-- Function to log ticket activity
CREATE OR REPLACE FUNCTION log_ticket_activity(
  p_ticket_id uuid,
  p_actor_email text,
  p_action text,
  p_old_value text DEFAULT NULL,
  p_new_value text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.ticket_activity_log (
    ticket_id,
    actor_id,
    actor_email,
    action,
    old_value,
    new_value,
    metadata
  ) VALUES (
    p_ticket_id,
    auth.uid(),
    p_actor_email,
    p_action,
    p_old_value,
    p_new_value,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment KB article helpful count
CREATE OR REPLACE FUNCTION increment_kb_helpful(article_id uuid, helpful boolean)
RETURNS void AS $$
BEGIN
  IF helpful THEN
    UPDATE public.kb_articles
    SET helpful_count = helpful_count + 1
    WHERE id = article_id;
  ELSE
    UPDATE public.kb_articles
    SET not_helpful_count = not_helpful_count + 1
    WHERE id = article_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to increment canned response usage
CREATE OR REPLACE FUNCTION increment_canned_response_usage(response_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.canned_responses
  SET
    usage_count = usage_count + 1,
    last_used_at = now()
  WHERE id = response_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default canned responses
INSERT INTO public.canned_responses (title, shortcut, content, category) VALUES
('Welcome Message', '/welcome', 'Thank you for contacting us! We''ve received your message and will respond within 24 hours. In the meantime, you might find our Help Center useful: [link]', 'general'),
('Bug Report Received', '/bug', 'Thank you for reporting this issue. We''ve created a bug report and our development team will investigate. We''ll keep you updated on our progress.', 'bug'),
('Feature Request Acknowledged', '/feature', 'Thanks for your feature suggestion! We''ve added it to our product roadmap for consideration. We''ll notify you if this feature is planned for development.', 'feature_request'),
('Resolved', '/resolved', 'I''m glad we could help resolve your issue! If you have any other questions, please don''t hesitate to reach out. Your feedback is valuable to us.', 'general'),
('Need More Info', '/info', 'To help you better, could you please provide the following information:\n- What browser are you using?\n- What were you trying to do?\n- What happened instead?\n- Any error messages you saw?', 'question');

-- Insert default knowledge base articles
INSERT INTO public.kb_articles (title, slug, content, excerpt, category, keywords, published) VALUES
('Getting Started Guide', 'getting-started', '# Getting Started\n\nWelcome! Here''s how to get started...\n\n## Step 1: Create an Account\n\n## Step 2: Explore Features\n\n## Step 3: Customize Settings', 'Quick guide to getting started with the platform', 'getting_started', ARRAY['getting started', 'setup', 'onboarding'], true),
('Frequently Asked Questions', 'faq', '# Frequently Asked Questions\n\n## How do I reset my password?\n\n## How do I contact support?\n\n## What browsers are supported?', 'Common questions and answers', 'general', ARRAY['faq', 'questions', 'help'], true),
('Troubleshooting Common Issues', 'troubleshooting', '# Troubleshooting\n\n## Issue: Page not loading\n\n## Issue: Error messages\n\n## Issue: Slow performance', 'Solutions to common problems', 'troubleshooting', ARRAY['troubleshooting', 'problems', 'errors'], true);

-- Comments on tables
COMMENT ON TABLE public.support_tickets IS 'AI-powered support ticket system with context tracking';
COMMENT ON TABLE public.ticket_responses IS 'Conversation thread for support tickets';
COMMENT ON TABLE public.kb_articles IS 'Self-service knowledge base articles';
COMMENT ON TABLE public.canned_responses IS 'Quick reply templates for common responses';
COMMENT ON TABLE public.ticket_activity_log IS 'Audit trail of all ticket actions';
