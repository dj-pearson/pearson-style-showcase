-- Create webhook settings table
CREATE TABLE IF NOT EXISTS public.webhook_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for webhook_settings
CREATE POLICY "Only admins can read webhook settings"
  ON public.webhook_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can create webhook settings"
  ON public.webhook_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update webhook settings"
  ON public.webhook_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add social media content fields to articles table
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS social_short_form text,
ADD COLUMN IF NOT EXISTS social_long_form text,
ADD COLUMN IF NOT EXISTS social_image_url text;

-- Add trigger for webhook_settings updated_at
CREATE TRIGGER update_webhook_settings_updated_at
  BEFORE UPDATE ON public.webhook_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();