-- Create AI model configurations table
CREATE TABLE IF NOT EXISTS public.ai_model_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('gemini-free', 'gemini-paid', 'claude', 'openai', 'lovable')),
  model_name TEXT NOT NULL,
  api_key_secret_name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  configuration JSONB DEFAULT '{}'::jsonb,
  use_case TEXT DEFAULT 'general' CHECK (use_case IN ('general', 'ticket_response', 'content_generation')),
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_ai_configs_active_priority ON public.ai_model_configs(is_active, priority DESC) WHERE is_active = true;
CREATE INDEX idx_ai_configs_use_case ON public.ai_model_configs(use_case, is_active) WHERE is_active = true;

-- Add trigger for updated_at
CREATE TRIGGER update_ai_model_configs_updated_at
  BEFORE UPDATE ON public.ai_model_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configurations
INSERT INTO public.ai_model_configs (provider, model_name, api_key_secret_name, priority, is_default, use_case, configuration) VALUES
  ('gemini-paid', 'gemini-3-pro-preview', 'GEMINI_API_KEY', 1, true, 'general', '{"thinking": "high"}'::jsonb),
  ('gemini-free', 'gemini-2.5-flash', 'GEMINI_API_KEY_FREE', 2, false, 'general', '{}'::jsonb),
  ('claude', 'claude-sonnet-4-5-20250929', 'CLAUDE_API_KEY', 3, false, 'general', '{"header_type": "x-api-key"}'::jsonb),
  ('lovable', 'google/gemini-2.5-flash', 'LOVABLE_API_KEY', 4, false, 'general', '{}'::jsonb);

-- Enable RLS
ALTER TABLE public.ai_model_configs ENABLE ROW LEVEL SECURITY;

-- Create policies (admin only access)
CREATE POLICY "Admin users can view AI model configs"
  ON public.ai_model_configs FOR SELECT
  USING (true);

CREATE POLICY "Admin users can manage AI model configs"
  ON public.ai_model_configs FOR ALL
  USING (true);