-- Corrective / reconciliation migration for the `public.projects` table.
--
-- WHY THIS EXISTS
-- ---------------
-- The migration 20250716201805-...c6e2... ("Create projects table") fails on
-- apply with: ERROR: relation "projects" already exists.
--
-- Root cause is NOT a bad migration and NOT a forward missing-dependency. The
-- live schema ALREADY contains `public.projects` (the migration tracker reports
-- 12/16 of that file's objects as present). The table was created by an earlier
-- migration whose file is no longer in the repo -- it shows up in the hub's
-- `orphanApplied` list (the 2025-07-16 cluster: 20250716025820 ... 20250716113424).
-- The tracker never recorded 20250716201805 (nor its near-duplicate
-- 20250716201924) as applied, so the applier treats them as pending and re-runs
-- their bare `CREATE TABLE public.projects`, which collides with the existing
-- table.
--
-- The correct resolution for those two files is to BASELINE them (mark applied
-- without executing) -- NOT to rewrite them and NOT to re-run them. See the
-- operator summary.
--
-- This migration only RECONCILES the parts of `public.projects` that the
-- original orphaned creation may have skipped: RLS enablement, the four named
-- RLS policies, and the updated_at trigger (the hub reports 4 of that table's
-- objects as absent from the live schema -- consistent with the four policies).
-- It is fully idempotent and inserts NO data (the sample rows already exist and
-- must not be duplicated). Running it when everything is already present is a
-- no-op.

-- Table: create only if the orphaned creation somehow left it absent. Present
-- in the live schema today, so normally a no-op.
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'Active',
  featured BOOLEAN DEFAULT false,
  github_link TEXT,
  live_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Function the trigger depends on. CREATE OR REPLACE is idempotent; guarantees
-- the dependency exists even though 20250716201805's own trigger references it
-- without defining it (it is defined one file later, in 20250716201924).
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RLS: enabling an already-enabled table is a harmless no-op.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Policies: DROP IF EXISTS + CREATE makes each definition deterministic and
-- idempotent regardless of whether the orphaned creation added them.
DROP POLICY IF EXISTS "Projects can be read by everyone" ON public.projects;
CREATE POLICY "Projects can be read by everyone"
ON public.projects
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Projects can be created" ON public.projects;
CREATE POLICY "Projects can be created"
ON public.projects
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Projects can be updated" ON public.projects;
CREATE POLICY "Projects can be updated"
ON public.projects
FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Projects can be deleted" ON public.projects;
CREATE POLICY "Projects can be deleted"
ON public.projects
FOR DELETE
USING (true);

-- Trigger: DROP IF EXISTS + CREATE is idempotent.
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
