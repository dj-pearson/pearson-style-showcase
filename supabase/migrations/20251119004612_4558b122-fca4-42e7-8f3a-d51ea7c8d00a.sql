-- Create email mailboxes table for managing multiple email accounts
CREATE TABLE IF NOT EXISTS public.email_mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email_address TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- SMTP Configuration for outgoing emails
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_username TEXT NOT NULL,
  smtp_password TEXT NOT NULL,
  smtp_use_tls BOOLEAN NOT NULL DEFAULT true,
  
  -- Mailbox settings
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  signature TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create email webhook settings table
CREATE TABLE IF NOT EXISTS public.email_webhook_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add mailbox_id to support_tickets
ALTER TABLE public.support_tickets
ADD COLUMN IF NOT EXISTS mailbox_id UUID REFERENCES public.email_mailboxes(id),
ADD COLUMN IF NOT EXISTS email_message_id TEXT,
ADD COLUMN IF NOT EXISTS email_thread_id TEXT,
ADD COLUMN IF NOT EXISTS email_in_reply_to TEXT;

-- Create email_threads table to track conversation threads
CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  mailbox_id UUID NOT NULL REFERENCES public.email_mailboxes(id),
  
  -- Email metadata
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  cc_emails TEXT[],
  subject TEXT NOT NULL,
  message_id TEXT,
  in_reply_to TEXT,
  email_references TEXT[],
  
  -- Content
  body_text TEXT,
  body_html TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Direction
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  
  -- Status
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_mailboxes_active ON public.email_mailboxes(is_active);
CREATE INDEX IF NOT EXISTS idx_support_tickets_mailbox ON public.support_tickets(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_ticket ON public.email_threads(ticket_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_mailbox ON public.email_threads(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_message_id ON public.email_threads(message_id);

-- Enable RLS
ALTER TABLE public.email_mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_webhook_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_mailboxes
CREATE POLICY "Admins can manage mailboxes"
  ON public.email_mailboxes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for email_webhook_settings
CREATE POLICY "Admins can manage webhook settings"
  ON public.email_webhook_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for email_threads
CREATE POLICY "Admins can manage email threads"
  ON public.email_threads
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can create email threads"
  ON public.email_threads
  FOR INSERT
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_email_mailboxes_updated_at
  BEFORE UPDATE ON public.email_mailboxes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_webhook_settings_updated_at
  BEFORE UPDATE ON public.email_webhook_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default webhook settings row
INSERT INTO public.email_webhook_settings (id, webhook_url, webhook_secret, is_active)
VALUES (gen_random_uuid(), '', '', false)
ON CONFLICT DO NOTHING;