-- Restrict accounting_documents, the accounting-documents storage bucket and
-- media_folders to admins.
--
-- 20251121000002_accounting_documents.sql gave every authenticated user
-- SELECT/INSERT/UPDATE on accounting_documents with USING (true), and the same
-- for the accounting-documents bucket in storage.objects. Any signed-up user
-- could read OCR text and AI-parsed invoice/receipt data.
-- 20260309000001_fix_accounting_rls_admin_check.sql fixed the other accounting
-- tables but left this one out. media_folders (20251209000002_media_library.sql)
-- had FOR ALL USING (true) for authenticated.
--
-- The admin predicate is copied from 20260309000001 so all accounting tables
-- agree on who is an admin. service_role bypasses RLS, so the edge functions
-- process-accounting-document and create-invoice-from-document keep working.
--
-- Also pins search_path on the SECURITY DEFINER device-trust functions from
-- 20260716000001_trust_token_rotation.sql, which were created without one.

-- ---------------------------------------------------------------------------
-- public.accounting_documents
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view all accounting documents" ON public.accounting_documents;
DROP POLICY IF EXISTS "Users can insert accounting documents" ON public.accounting_documents;
DROP POLICY IF EXISTS "Users can update accounting documents" ON public.accounting_documents;
DROP POLICY IF EXISTS "Users can delete their own accounting documents" ON public.accounting_documents;
DROP POLICY IF EXISTS "Allow admin full access to accounting_documents" ON public.accounting_documents;

CREATE POLICY "Allow admin full access to accounting_documents"
  ON public.accounting_documents FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'admin'
    OR public.is_email_whitelisted(auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'admin'
    OR public.is_email_whitelisted(auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  );

-- ---------------------------------------------------------------------------
-- storage.objects, bucket 'accounting-documents'
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload accounting documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view accounting documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update accounting documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete accounting documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload accounting documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view accounting documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update accounting documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete accounting documents" ON storage.objects;

CREATE POLICY "Admins can upload accounting documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'accounting-documents'
    AND (
      auth.jwt() ->> 'role' = 'admin'
      OR public.is_email_whitelisted(auth.jwt() ->> 'email')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Admins can view accounting documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'accounting-documents'
    AND (
      auth.jwt() ->> 'role' = 'admin'
      OR public.is_email_whitelisted(auth.jwt() ->> 'email')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Admins can update accounting documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'accounting-documents'
    AND (
      auth.jwt() ->> 'role' = 'admin'
      OR public.is_email_whitelisted(auth.jwt() ->> 'email')
      OR public.has_role(auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    bucket_id = 'accounting-documents'
    AND (
      auth.jwt() ->> 'role' = 'admin'
      OR public.is_email_whitelisted(auth.jwt() ->> 'email')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Admins can delete accounting documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'accounting-documents'
    AND (
      auth.jwt() ->> 'role' = 'admin'
      OR public.is_email_whitelisted(auth.jwt() ->> 'email')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- public.media_folders
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view folders" ON public.media_folders;
DROP POLICY IF EXISTS "Authenticated users can manage folders" ON public.media_folders;
DROP POLICY IF EXISTS "Allow admin full access to media_folders" ON public.media_folders;

CREATE POLICY "Allow admin full access to media_folders"
  ON public.media_folders FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'admin'
    OR public.is_email_whitelisted(auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'admin'
    OR public.is_email_whitelisted(auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  );

-- ---------------------------------------------------------------------------
-- Device-trust SECURITY DEFINER functions: pin search_path
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.rotate_trust_token(TEXT, TEXT, UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.verify_trust_token(TEXT, UUID, TEXT) SET search_path = public;
