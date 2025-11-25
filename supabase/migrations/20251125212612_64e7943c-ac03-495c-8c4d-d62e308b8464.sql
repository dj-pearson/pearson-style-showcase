-- Create admin_whitelist table for admin RBAC and whitelist-based access
CREATE TABLE IF NOT EXISTS public.admin_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_by UUID,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE public.admin_whitelist ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they do not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_whitelist'
      AND policyname = 'Only admins can read whitelist'
  ) THEN
    EXECUTE 'CREATE POLICY "Only admins can read whitelist" '
         || 'ON public.admin_whitelist '
         || 'FOR SELECT '
         || 'USING (public.has_role(auth.uid(), ''admin''));';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_whitelist'
      AND policyname = 'Only admins can manage whitelist'
  ) THEN
    EXECUTE 'CREATE POLICY "Only admins can manage whitelist" '
         || 'ON public.admin_whitelist '
         || 'FOR ALL '
         || 'USING (public.has_role(auth.uid(), ''admin''));';
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_admin_whitelist_email
  ON public.admin_whitelist(email);

CREATE INDEX IF NOT EXISTS idx_admin_whitelist_active
  ON public.admin_whitelist(is_active)
  WHERE is_active = true;

-- Seed initial admin emails (idempotent)
INSERT INTO public.admin_whitelist (email, is_active, notes)
VALUES
  ('dan@danpearson.net', true, 'Primary admin - seeded from migration'),
  ('pearsonperformance@gmail.com', true, 'Secondary admin - seeded from migration')
ON CONFLICT (email) DO NOTHING;