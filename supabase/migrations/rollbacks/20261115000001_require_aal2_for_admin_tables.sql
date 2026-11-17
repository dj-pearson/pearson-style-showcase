-- Rollback for 20261115000001_require_aal2_for_admin_tables.sql
-- Drops every "<table> requires aal2" restrictive policy it created.

DO $rollback$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = tablename || ' requires aal2'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $rollback$;
