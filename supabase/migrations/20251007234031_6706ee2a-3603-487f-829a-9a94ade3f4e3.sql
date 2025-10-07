-- Fix password_reset_tokens RLS policies
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Password reset tokens can be read" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Password reset tokens can be created" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Password reset tokens can be updated" ON public.password_reset_tokens;

-- Create secure policies
CREATE POLICY "Users can view their own reset tokens"
  ON public.password_reset_tokens
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can create reset tokens"
  ON public.password_reset_tokens
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own reset tokens"
  ON public.password_reset_tokens
  FOR UPDATE
  USING (user_id = auth.uid());

-- Remove all RLS policies from admin_users table (legacy table, should not be accessible)
DROP POLICY IF EXISTS "Admin users can read own data" ON public.admin_users;
DROP POLICY IF EXISTS "Admin users can update own data" ON public.admin_users;

-- Create a policy that denies all access (effectively making the table inaccessible from client)
CREATE POLICY "Deny all access to admin_users"
  ON public.admin_users
  FOR ALL
  USING (false);

-- Fix admin_sessions RLS policies
DROP POLICY IF EXISTS "Admin sessions can be read" ON public.admin_sessions;
DROP POLICY IF EXISTS "Admin sessions can be created" ON public.admin_sessions;
DROP POLICY IF EXISTS "Admin sessions can be deleted" ON public.admin_sessions;

-- Create secure policies for admin_sessions
CREATE POLICY "System can manage admin sessions"
  ON public.admin_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Fix email_logs RLS policies
DROP POLICY IF EXISTS "Email logs can be read" ON public.email_logs;
DROP POLICY IF EXISTS "Email logs can be created" ON public.email_logs;

CREATE POLICY "Only admins can read email logs"
  ON public.email_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can create email logs"
  ON public.email_logs
  FOR INSERT
  WITH CHECK (true);

-- Create analytics_settings table to store analytics config server-side
CREATE TABLE IF NOT EXISTS public.analytics_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_analytics_id text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on analytics_settings
ALTER TABLE public.analytics_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for analytics_settings
CREATE POLICY "Anyone can read analytics settings"
  ON public.analytics_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update analytics settings"
  ON public.analytics_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can create analytics settings"
  ON public.analytics_settings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert default analytics settings
INSERT INTO public.analytics_settings (enabled) VALUES (false)
ON CONFLICT DO NOTHING;