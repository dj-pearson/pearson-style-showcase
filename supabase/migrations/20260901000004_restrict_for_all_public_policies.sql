-- Remove the five remaining "FOR ALL ... USING (true)" policies held by the
-- public role.
--
-- Each granted anonymous callers INSERT, UPDATE and DELETE, not just SELECT.
-- The anon key ships in the frontend bundle, so anyone could rewrite the Amazon
-- product catalogue, delete the article-to-product mappings that back the
-- affiliate pages, or clear the link-health and dashboard caches.
--
-- Reads are preserved: every one of these tables except amazon_api_throttle
-- already has its own SELECT policy, which is why dropping the ALL policy is
-- enough rather than replacing it.
--
--   amazon_products        "Anyone can read products"          (public SELECT)
--   article_products       "Anyone can read article products"  (public SELECT)
--   link_health            "Admins can read link health"       (admin SELECT)
--   dashboard_stats_cache  "Admins can read dashboard stats"   (admin SELECT)
--
-- Writers, traced before dropping anything:
--
--   amazon_products        functions/amazon-article-pipeline, service role
--   article_products       functions/amazon-article-pipeline, service role.
--                          AmazonReportImporter.tsx:128 only reads.
--   link_health            public.update_link_health, SECURITY DEFINER
--   dashboard_stats_cache  nothing writes it from a client, but
--                          QuickActionsPanel.tsx:243 deletes expired rows from
--                          the browser, so that one keeps a policy.
--   amazon_api_throttle    public.claim_amazon_throttle only. See below.

DROP POLICY IF EXISTS "Service can manage products" ON public.amazon_products;
DROP POLICY IF EXISTS "Service can manage article products" ON public.article_products;
DROP POLICY IF EXISTS "Service can manage link health" ON public.link_health;
DROP POLICY IF EXISTS "Service can manage dashboard stats" ON public.dashboard_stats_cache;
DROP POLICY IF EXISTS "Service can manage amazon api throttle" ON public.amazon_api_throttle;

-- The "Refresh Stats" action in the command centre clears expired cache rows
-- from the browser, so this needs a policy rather than none. Scoped to admins,
-- matching the SELECT policy already on the table.
CREATE POLICY "Admins can clear dashboard stats"
  ON public.dashboard_stats_cache
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- claim_amazon_throttle is SECURITY INVOKER, so it runs with the caller's
-- privileges and RLS applies to it. With the blanket policy gone it would work
-- only for the service role. A throttle counter has to work whoever calls it,
-- and the table holds a single row of call counters, so this matches how
-- record_metric and update_link_health are already defined. ALTER FUNCTION
-- changes only the security attribute and leaves the body untouched; the
-- function already sets search_path, which is the safeguard that belongs with
-- SECURITY DEFINER.
ALTER FUNCTION public.claim_amazon_throttle(integer) SECURITY DEFINER;
