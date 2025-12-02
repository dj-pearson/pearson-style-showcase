-- Create secure vault types table
CREATE TABLE public.secure_vault_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text DEFAULT 'key',
  created_at timestamp with time zone DEFAULT now(),
  is_system boolean DEFAULT false
);

-- Create secure vault items table
CREATE TABLE public.secure_vault_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  encrypted_value text NOT NULL,
  type_id uuid REFERENCES public.secure_vault_types(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_accessed_at timestamp with time zone
);

-- Create vault access log for audit trail
CREATE TABLE public.secure_vault_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vault_item_id uuid REFERENCES public.secure_vault_items(id) ON DELETE CASCADE,
  action text NOT NULL,
  ip_address text,
  user_agent text,
  accessed_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.secure_vault_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secure_vault_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secure_vault_access_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vault types (readable by admins, system types are read-only)
CREATE POLICY "Admins can read vault types"
ON public.secure_vault_types FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create custom vault types"
ON public.secure_vault_types FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') AND is_system = false);

CREATE POLICY "Admins can update custom vault types"
ON public.secure_vault_types FOR UPDATE
USING (has_role(auth.uid(), 'admin') AND is_system = false);

CREATE POLICY "Admins can delete custom vault types"
ON public.secure_vault_types FOR DELETE
USING (has_role(auth.uid(), 'admin') AND is_system = false);

-- RLS Policies for vault items (only owner can access)
CREATE POLICY "Users can read own vault items"
ON public.secure_vault_items FOR SELECT
USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own vault items"
ON public.secure_vault_items FOR INSERT
WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own vault items"
ON public.secure_vault_items FOR UPDATE
USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own vault items"
ON public.secure_vault_items FOR DELETE
USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'));

-- RLS Policies for access log
CREATE POLICY "Users can read own access logs"
ON public.secure_vault_access_log FOR SELECT
USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can create access logs"
ON public.secure_vault_access_log FOR INSERT
WITH CHECK (true);

-- Insert default system types
INSERT INTO public.secure_vault_types (name, icon, is_system) VALUES
  ('Secret', 'lock', true),
  ('Text', 'file-text', true),
  ('URL', 'link', true),
  ('Command', 'terminal', true);

-- Create trigger for updated_at
CREATE TRIGGER update_secure_vault_items_updated_at
  BEFORE UPDATE ON public.secure_vault_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();