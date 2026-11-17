-- Rollback for 20261117000302_drop_open_accounting_documents_policy.sql.
-- Recreates the open policy exactly as it was live on 2026-11-17. This
-- re-opens accounting_documents to every signed-in user; only run it if the
-- admin-only policy turns out to break something.

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can manage accounting documents" ON public.accounting_documents;
CREATE POLICY "Authenticated users can manage accounting documents"
  ON public.accounting_documents
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
