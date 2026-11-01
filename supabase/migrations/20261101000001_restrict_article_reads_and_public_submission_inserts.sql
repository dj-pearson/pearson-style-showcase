-- Close two RLS gaps found in the 2026-11-01 review.
--
-- 1. articles: "Anyone can read published articles" (20251007232740) was
--    USING (true) with no TO clause, so the anon key could read every draft,
--    including unpublished content and SEO fields. No later migration replaced
--    it (checked every file through 20261028000002). Public reads are now
--    limited to published = true, and admins get their own SELECT policy so the
--    dashboard still lists drafts. Insert/update/delete policies are unchanged.
--
-- 2. contact_submissions / ai_tool_submissions: "Service can create ..."
--    (20251119023055) were FOR INSERT WITH CHECK (true) with no TO clause, which
--    let anyone holding the anon key insert rows. Nothing in src/ inserts into
--    either table (LiveActivityFeed.tsx only selects, maintenance-runner runs on
--    the service role, which bypasses RLS), so both policies are dropped
--    outright rather than narrowed. A future public form should post to an edge
--    function on the service role, as newsletter-signup does.
--
-- The admin predicate matches 20261028000002_drop_permissive_service_write_policies.sql.

-- articles
DROP POLICY IF EXISTS "Anyone can read published articles" ON public.articles;
DROP POLICY IF EXISTS "Public can read published articles" ON public.articles;
DROP POLICY IF EXISTS "Admins can read all articles" ON public.articles;

CREATE POLICY "Public can read published articles"
  ON public.articles
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "Admins can read all articles"
  ON public.articles
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'admin'
    OR public.is_email_whitelisted(auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  );

-- contact_submissions
DROP POLICY IF EXISTS "Service can create contact submissions" ON public.contact_submissions;

-- ai_tool_submissions
DROP POLICY IF EXISTS "Service can create ai tool submissions" ON public.ai_tool_submissions;
