-- RBAC Enhancement Migration
-- Adds admin_whitelist, permissions, role_permissions tables
-- Enhances user_roles table
-- Creates has_permission() function

-- ============================================
-- 1. Create admin_whitelist table
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.admin_whitelist ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_whitelist
CREATE POLICY "Only admins can read whitelist"
  ON public.admin_whitelist
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage whitelist"
  ON public.admin_whitelist
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create index for email lookup
CREATE INDEX idx_admin_whitelist_email ON public.admin_whitelist(email);
CREATE INDEX idx_admin_whitelist_active ON public.admin_whitelist(is_active) WHERE is_active = true;

-- Seed initial admin emails (migrate from hardcoded list)
INSERT INTO public.admin_whitelist (email, is_active, notes) VALUES
  ('dan@danpearson.net', true, 'Primary admin - migrated from hardcoded list'),
  ('pearsonperformance@gmail.com', true, 'Secondary admin - migrated from hardcoded list')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 2. Enhance user_roles table
-- ============================================
-- Add expires_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_roles'
    AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add is_active column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_roles'
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Create index for active roles
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON public.user_roles(user_id, role) WHERE is_active = true;

-- ============================================
-- 3. Create permissions table
-- ============================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Everyone can read permissions (needed for frontend)
CREATE POLICY "Anyone can read permissions"
  ON public.permissions
  FOR SELECT
  USING (true);

-- Only admins can manage permissions
CREATE POLICY "Only admins can manage permissions"
  ON public.permissions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed permissions
INSERT INTO public.permissions (name, description, category) VALUES
  -- Content permissions
  ('articles.create', 'Create new articles', 'content'),
  ('articles.read', 'View all articles including drafts', 'content'),
  ('articles.update', 'Edit existing articles', 'content'),
  ('articles.delete', 'Delete articles', 'content'),
  ('articles.publish', 'Publish or unpublish articles', 'content'),
  ('projects.create', 'Create new projects', 'content'),
  ('projects.read', 'View all projects', 'content'),
  ('projects.update', 'Edit existing projects', 'content'),
  ('projects.delete', 'Delete projects', 'content'),
  ('ai_tools.create', 'Create new AI tools', 'content'),
  ('ai_tools.read', 'View all AI tools', 'content'),
  ('ai_tools.update', 'Edit existing AI tools', 'content'),
  ('ai_tools.delete', 'Delete AI tools', 'content'),
  ('categories.manage', 'Manage article categories', 'content'),
  -- User management permissions
  ('users.read', 'View user list', 'users'),
  ('users.create', 'Create new users', 'users'),
  ('users.update', 'Edit user details', 'users'),
  ('users.delete', 'Delete users', 'users'),
  ('roles.read', 'View role assignments', 'users'),
  ('roles.assign', 'Assign roles to users', 'users'),
  ('roles.revoke', 'Revoke roles from users', 'users'),
  ('whitelist.read', 'View admin whitelist', 'users'),
  ('whitelist.manage', 'Manage admin whitelist', 'users'),
  -- System permissions
  ('settings.read', 'View system settings', 'system'),
  ('settings.update', 'Modify system settings', 'system'),
  ('smtp.manage', 'Manage SMTP configuration', 'system'),
  ('newsletter.read', 'View newsletter subscribers', 'system'),
  ('newsletter.manage', 'Manage newsletter subscribers', 'system'),
  ('alerts.manage', 'Manage system alerts', 'system'),
  -- Analytics permissions
  ('analytics.view', 'View analytics dashboard', 'analytics'),
  ('analytics.export', 'Export analytics data', 'analytics'),
  ('activity_log.view', 'View admin activity logs', 'analytics')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 4. Create role_permissions table
-- ============================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, permission_id)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone can read role_permissions (needed for frontend)
CREATE POLICY "Anyone can read role permissions"
  ON public.role_permissions
  FOR SELECT
  USING (true);

-- Only admins can manage role permissions
CREATE POLICY "Only admins can manage role permissions"
  ON public.role_permissions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed role-permission mappings
-- Admin gets ALL permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, id FROM public.permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- Editor gets content creation and reading permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'editor'::public.app_role, id FROM public.permissions
WHERE name IN (
  'articles.create', 'articles.read', 'articles.update',
  'projects.create', 'projects.read', 'projects.update',
  'ai_tools.create', 'ai_tools.read', 'ai_tools.update',
  'categories.manage',
  'analytics.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Viewer gets read-only permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'viewer'::public.app_role, id FROM public.permissions
WHERE name LIKE '%.read' OR name = 'analytics.view' OR name = 'activity_log.view'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================
-- 5. Create has_permission() function
-- ============================================
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id
      AND ur.is_active = true
      AND p.name = _permission
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  )
$$;

-- ============================================
-- 6. Create function to check if email is whitelisted
-- ============================================
CREATE OR REPLACE FUNCTION public.is_email_whitelisted(_email TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_whitelist
    WHERE email = _email
      AND is_active = true
  )
$$;

-- ============================================
-- 7. Create function to get user permissions
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TABLE(permission_name TEXT, permission_category TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.name, p.category
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role = rp.role
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = _user_id
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ORDER BY p.category, p.name
$$;

-- ============================================
-- 8. Create function to get user roles
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS TABLE(role public.app_role, granted_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.role, ur.granted_at, ur.expires_at
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ORDER BY ur.granted_at
$$;

-- ============================================
-- 9. Enhance admin_activity_log table
-- ============================================
-- Add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'admin_activity_log'
    AND column_name = 'old_values'
  ) THEN
    ALTER TABLE public.admin_activity_log ADD COLUMN old_values JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'admin_activity_log'
    AND column_name = 'new_values'
  ) THEN
    ALTER TABLE public.admin_activity_log ADD COLUMN new_values JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'admin_activity_log'
    AND column_name = 'session_id'
  ) THEN
    ALTER TABLE public.admin_activity_log ADD COLUMN session_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'admin_activity_log'
    AND column_name = 'success'
  ) THEN
    ALTER TABLE public.admin_activity_log ADD COLUMN success BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Create indexes for activity log queries
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON public.admin_activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_admin ON public.admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.admin_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_resource ON public.admin_activity_log(resource_type, resource_id);

-- ============================================
-- 10. Create audit trigger function
-- ============================================
CREATE OR REPLACE FUNCTION public.log_admin_activity_trigger()
RETURNS TRIGGER AS $$
DECLARE
  _admin_email TEXT;
BEGIN
  -- Get the admin email
  SELECT email INTO _admin_email FROM auth.users WHERE id = auth.uid();

  -- Only log if user is an admin
  IF public.has_role(auth.uid(), 'admin') THEN
    INSERT INTO public.admin_activity_log (
      id,
      admin_id,
      admin_email,
      action,
      action_category,
      resource_type,
      resource_id,
      resource_title,
      old_values,
      new_values,
      timestamp
    ) VALUES (
      gen_random_uuid(),
      auth.uid(),
      COALESCE(_admin_email, 'system'),
      TG_OP,
      'content',
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      COALESCE(NEW.title, OLD.title, NEW.name, OLD.name),
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
      now()
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. Create audit triggers for content tables
-- ============================================
-- Articles audit trigger
DROP TRIGGER IF EXISTS articles_audit_trigger ON public.articles;
CREATE TRIGGER articles_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_activity_trigger();

-- Projects audit trigger
DROP TRIGGER IF EXISTS projects_audit_trigger ON public.projects;
CREATE TRIGGER projects_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_activity_trigger();

-- AI Tools audit trigger (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_tools') THEN
    DROP TRIGGER IF EXISTS ai_tools_audit_trigger ON public.ai_tools;
    CREATE TRIGGER ai_tools_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.ai_tools
      FOR EACH ROW EXECUTE FUNCTION public.log_admin_activity_trigger();
  END IF;
END $$;

-- User roles audit trigger
DROP TRIGGER IF EXISTS user_roles_audit_trigger ON public.user_roles;
CREATE TRIGGER user_roles_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_activity_trigger();

-- Admin whitelist audit trigger
DROP TRIGGER IF EXISTS admin_whitelist_audit_trigger ON public.admin_whitelist;
CREATE TRIGGER admin_whitelist_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_whitelist
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_activity_trigger();

-- ============================================
-- Summary of changes:
-- 1. Created admin_whitelist table with migrated emails
-- 2. Enhanced user_roles with expires_at and is_active
-- 3. Created permissions table with 32 permissions
-- 4. Created role_permissions table with role-permission mappings
-- 5. Created has_permission() function
-- 6. Created is_email_whitelisted() function
-- 7. Created get_user_permissions() function
-- 8. Created get_user_roles() function
-- 9. Enhanced admin_activity_log table
-- 10. Created audit trigger function
-- 11. Added audit triggers to content tables
-- ============================================
