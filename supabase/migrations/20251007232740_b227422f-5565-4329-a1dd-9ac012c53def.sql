-- Create role-based access control system
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Fix newsletter_subscribers RLS - only admins can read
DROP POLICY IF EXISTS "Newsletter subscribers can be read" ON public.newsletter_subscribers;

CREATE POLICY "Only admins can read newsletter subscribers" 
ON public.newsletter_subscribers 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Newsletter subscribers can be updated" ON public.newsletter_subscribers;

CREATE POLICY "Only admins can update newsletter subscribers" 
ON public.newsletter_subscribers 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Newsletter subscribers can be created" ON public.newsletter_subscribers;

CREATE POLICY "Only admins can create newsletter subscribers" 
ON public.newsletter_subscribers 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix smtp_settings RLS - only admins can access
DROP POLICY IF EXISTS "SMTP settings can be read" ON public.smtp_settings;

CREATE POLICY "Only admins can read SMTP settings" 
ON public.smtp_settings 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "SMTP settings can be updated" ON public.smtp_settings;

CREATE POLICY "Only admins can update SMTP settings" 
ON public.smtp_settings 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "SMTP settings can be created" ON public.smtp_settings;

CREATE POLICY "Only admins can create SMTP settings" 
ON public.smtp_settings 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix articles RLS - only admins can modify
DROP POLICY IF EXISTS "Articles can be created" ON public.articles;
DROP POLICY IF EXISTS "Articles can be updated" ON public.articles;
DROP POLICY IF EXISTS "Articles can be deleted" ON public.articles;
DROP POLICY IF EXISTS "Articles can be read" ON public.articles;

CREATE POLICY "Anyone can read published articles" 
ON public.articles 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can create articles" 
ON public.articles 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update articles" 
ON public.articles 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete articles" 
ON public.articles 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- Fix projects RLS - only admins can modify
DROP POLICY IF EXISTS "Projects can be created" ON public.projects;
DROP POLICY IF EXISTS "Projects can be updated" ON public.projects;
DROP POLICY IF EXISTS "Projects can be deleted" ON public.projects;
DROP POLICY IF EXISTS "Projects can be read by everyone" ON public.projects;

CREATE POLICY "Anyone can read projects" 
ON public.projects 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can create projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update projects" 
ON public.projects 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete projects" 
ON public.projects 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- Fix ai_tools RLS - only admins can modify
DROP POLICY IF EXISTS "AI tools can be created" ON public.ai_tools;
DROP POLICY IF EXISTS "AI tools can be updated" ON public.ai_tools;
DROP POLICY IF EXISTS "AI tools can be deleted" ON public.ai_tools;
DROP POLICY IF EXISTS "AI tools can be read" ON public.ai_tools;

CREATE POLICY "Anyone can read AI tools" 
ON public.ai_tools 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can create AI tools" 
ON public.ai_tools 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update AI tools" 
ON public.ai_tools 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete AI tools" 
ON public.ai_tools 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- Fix article_categories RLS - only admins can modify
DROP POLICY IF EXISTS "Article categories can be created" ON public.article_categories;
DROP POLICY IF EXISTS "Article categories can be updated" ON public.article_categories;
DROP POLICY IF EXISTS "Article categories can be deleted" ON public.article_categories;
DROP POLICY IF EXISTS "Article categories can be read" ON public.article_categories;

CREATE POLICY "Anyone can read article categories" 
ON public.article_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can create article categories" 
ON public.article_categories 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update article categories" 
ON public.article_categories 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete article categories" 
ON public.article_categories 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- Fix admin_uploads storage bucket RLS
DROP POLICY IF EXISTS "Admins can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view admin uploaded files" ON storage.objects;

CREATE POLICY "Anyone can view admin uploaded files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'admin-uploads');

CREATE POLICY "Only admins can upload files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'admin-uploads' AND
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Only admins can update files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'admin-uploads' AND
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Only admins can delete files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'admin-uploads' AND
  public.has_role(auth.uid(), 'admin')
);

-- Fix analytics_data RLS - only admins can access
DROP POLICY IF EXISTS "Analytics data can be created" ON public.analytics_data;
DROP POLICY IF EXISTS "Analytics data can be updated" ON public.analytics_data;
DROP POLICY IF EXISTS "Analytics data can be read" ON public.analytics_data;

CREATE POLICY "Only admins can read analytics data" 
ON public.analytics_data 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can create analytics data" 
ON public.analytics_data 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update analytics data" 
ON public.analytics_data 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for user_roles table itself
CREATE POLICY "Only admins can read user roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage user roles" 
ON public.user_roles 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));