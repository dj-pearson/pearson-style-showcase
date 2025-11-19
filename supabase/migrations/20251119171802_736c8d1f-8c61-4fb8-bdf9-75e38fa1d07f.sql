-- Create notification settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_emails text[] NOT NULL DEFAULT ARRAY['pearsonperformance@gmail.com'],
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage notification settings
CREATE POLICY "Admins can manage notification settings"
  ON public.notification_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.notification_settings (notification_emails, enabled)
VALUES (ARRAY['pearsonperformance@gmail.com'], true)
ON CONFLICT DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();