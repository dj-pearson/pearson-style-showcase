-- Reconciliation migration for the `public.projects` table.
--
-- WHY THIS EXISTS
-- ---------------
-- The migration 20250716201805-...c6e2... ("Create projects table") fails on
-- apply with: ERROR: relation "projects" already exists.
--
-- Root cause is NOT a bad migration and NOT a forward missing-dependency. The
-- live schema ALREADY contains `public.projects`. The table was created by an
-- earlier migration whose file is no longer in the repo -- it shows up in the
-- hub's `orphanApplied` list (the 2025-07-16 cluster: 20250716025820 ...
-- 20250716113424). The tracker never recorded 20250716201805 (nor its
-- near-duplicate 20250716201924) as applied, so the applier treats them as
-- pending and re-runs their bare `CREATE TABLE public.projects`, which collides
-- with the existing table.
--
-- The correct resolution for those two files is to BASELINE them (mark applied
-- without executing) -- NOT to rewrite them and NOT to re-run them.
--
-- CORRECTION, 2026-08-11
-- ----------------------
-- The first version of this file also recreated the four ORIGINAL projects RLS
-- policies ("Projects can be read by everyone" / created / updated / deleted),
-- on the reasoning that the hub reports 4 of 20250716201805's objects as absent
-- from the live schema. That reasoning was wrong and the statements were
-- dangerous.
--
-- Those four policies are absent BY DESIGN. Migration 20251007232740 ("Fix
-- projects RLS - only admins can modify") drops all four by name and replaces
-- them with an admin-scoped set, and the hub verifies that file as fully
-- present (39/39) against the live schema. So the live schema is CORRECT and
-- the 4 "absent" objects are simply the retired legacy policy names.
--
-- Recreating them would have been a live security regression: RLS policies
-- combine with OR, so adding `FOR INSERT WITH CHECK (true)` alongside "Only
-- admins can create projects" grants anonymous INSERT/UPDATE/DELETE on the
-- public projects table to anyone holding the anon key. This file has never
-- been applied (hub verdict: partial, pending), so the statements are removed
-- here rather than reverted by a follow-up.
--
-- All policy management for `public.projects` now lives in
-- 20260811000001_reconcile_projects_rls_admin_only.sql, which states the
-- intended end state idempotently.
--
-- What remains below is only the structural reconciliation: table existence,
-- the trigger function, RLS enablement and the updated_at trigger. It inserts
-- NO data (the sample rows already exist and must not be duplicated) and is a
-- no-op when everything is already present.

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

-- RLS: enabling an already-enabled table is a harmless no-op. Policies are
-- deliberately NOT touched here -- see 20260811000001.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Trigger: DROP IF EXISTS + CREATE is idempotent.
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
