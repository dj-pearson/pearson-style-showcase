-- Close the last open policy on accounting_documents.
--
-- 20261028000001 replaced the open accounting_documents and media_folders
-- policies with admin-only ones, but it did not know about this one: it was
-- created in the Lovable era and is not in any file here. Live on 2026-11-17 it
-- read FOR ALL TO authenticated USING (true) WITH CHECK (true), so any
-- signed-in user who had passed MFA could read and change every accounting
-- document. "Allow admin full access to accounting_documents" (from
-- 20261028000001) stays and keeps the admin pages working.
--
-- Idempotent: dropping a policy that is already gone does nothing.
-- Rollback: rollbacks/20261117000302_drop_open_accounting_documents_policy.sql

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can manage accounting documents" ON public.accounting_documents;

COMMIT;
