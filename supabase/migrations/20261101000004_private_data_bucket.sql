-- Private bucket for internal admin data files (amazon_ideas.csv).
-- admin-uploads stays public because article, project and AI tool images
-- are served from it by public URL.

INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-private', 'admin-private', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Admins can read admin-private" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload admin-private" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update admin-private" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete admin-private" ON storage.objects;

CREATE POLICY "Admins can read admin-private"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'admin-private' AND (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins can upload admin-private"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-private' AND (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins can update admin-private"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'admin-private' AND (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (bucket_id = 'admin-private' AND (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins can delete admin-private"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'admin-private' AND (auth.jwt() ->> 'role' = 'admin' OR public.is_email_whitelisted(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin')));
