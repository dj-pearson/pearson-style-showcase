-- Assert the intended RLS policy set on `public.projects`: public read,
-- admin-only write.
--
-- WHY THIS EXISTS
-- ---------------
-- 20251007232740 ("Fix projects RLS - only admins can modify") established this
-- policy set and the hub verifies it as fully present (39/39) in the live
-- schema, so on THIS database the file below is a no-op restatement.
--
-- It exists for two reasons:
--
-- 1. The original version of 20260721000001_reconcile_projects_rls.sql
--    recreated the four pre-hardening permissive policies from
--    20250716201805 ("Projects can be created" WITH CHECK (true), and the
--    UPDATE/DELETE equivalents USING (true)). RLS policies combine with OR, so
--    any environment that applied that version has anonymous INSERT, UPDATE and
--    DELETE on public.projects via the anon key, regardless of the admin-scoped
--    policies sitting alongside them. This drops those names unconditionally.
--
-- 2. It puts the intended end state in one place, so the next person reading
--    the 2025-07-16 files does not conclude from the hub's "4 objects absent"
--    that something is missing. Those four objects are retired policy names and
--    are absent on purpose.
--
-- Fully idempotent. Wrapped in a transaction so the SELECT policy is never
-- momentarily absent on a live database.

BEGIN;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 1. Retire the pre-hardening permissive policies -----------------------------
--    Already dropped by 20251007232740 on this database. Named again here
--    because an environment that ran the first version of 20260721000001 has
--    them back, and they defeat the admin checks below.
DROP POLICY IF EXISTS "Projects can be read by everyone" ON public.projects;
DROP POLICY IF EXISTS "Projects can be created" ON public.projects;
DROP POLICY IF EXISTS "Projects can be updated" ON public.projects;
DROP POLICY IF EXISTS "Projects can be deleted" ON public.projects;

-- 2. Restate the intended set -------------------------------------------------
--    Definitions copied verbatim from 20251007232740 lines 106-124. Keep them
--    in sync: if the policy intent changes, change it there and here together.
DROP POLICY IF EXISTS "Anyone can read projects" ON public.projects;
CREATE POLICY "Anyone can read projects"
ON public.projects
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Only admins can create projects" ON public.projects;
CREATE POLICY "Only admins can create projects"
ON public.projects
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can update projects" ON public.projects;
CREATE POLICY "Only admins can update projects"
ON public.projects
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can delete projects" ON public.projects;
CREATE POLICY "Only admins can delete projects"
ON public.projects
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

COMMIT;

-- VERIFY (run separately; expects exactly the four policies above):
--   SELECT policyname, cmd, qual, with_check
--   FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects'
--   ORDER BY policyname;
