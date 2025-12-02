-- Create vault_platforms table for managing platforms/websites
CREATE TABLE public.vault_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vault_platforms ENABLE ROW LEVEL SECURITY;

-- RLS policies for vault_platforms (admin only via has_role)
CREATE POLICY "Admin users can manage vault platforms"
  ON public.vault_platforms
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Add platform_id to secure_vault_items
ALTER TABLE public.secure_vault_items
ADD COLUMN platform_id UUID REFERENCES public.vault_platforms(id) ON DELETE SET NULL;

-- Create index for platform filtering
CREATE INDEX idx_secure_vault_items_platform ON public.secure_vault_items(platform_id);

-- Seed some common platforms
INSERT INTO public.vault_platforms (name, icon, url) VALUES
  ('Amazon', 'shopping-cart', 'https://amazon.com'),
  ('Google', 'search', 'https://google.com'),
  ('Apple', 'apple', 'https://apple.com'),
  ('OpenAI', 'bot', 'https://openai.com'),
  ('Claude/Anthropic', 'brain', 'https://anthropic.com'),
  ('GitHub', 'github', 'https://github.com'),
  ('Microsoft', 'monitor', 'https://microsoft.com'),
  ('Stripe', 'credit-card', 'https://stripe.com'),
  ('AWS', 'cloud', 'https://aws.amazon.com'),
  ('Supabase', 'database', 'https://supabase.com');