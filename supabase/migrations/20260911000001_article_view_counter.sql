-- Count article views.
--
-- public.articles.view_count is read in eight places - the article header
-- ("N views"), every article card, the admin article list, and the "popular"
-- ordering on the topic hubs - and nothing has ever written to it. Every count
-- on the site is whatever the row was seeded with, and ordering by popularity
-- orders by that seed.
--
-- Anonymous readers cannot UPDATE articles, and should not be able to, so the
-- increment is a SECURITY DEFINER function narrow enough to be safe to expose:
-- it takes a slug, touches exactly one column on one published row, and returns
-- nothing. It reports no information back to the caller.
--
-- It is still a vanity counter: anyone can call it in a loop and inflate one
-- article. The client counts a slug once per browser session and only after the
-- reader has stayed five seconds, which is enough for the number to mean
-- something in normal traffic. If it ever needs to be trustworthy, that belongs
-- in an edge function that can see the caller's address.

CREATE OR REPLACE FUNCTION public.increment_article_view(article_slug TEXT)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $function$
BEGIN
  UPDATE public.articles
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE slug = article_slug
    AND published = true;
END;
$function$;

COMMENT ON FUNCTION public.increment_article_view(TEXT) IS
  'Adds one view to a published article. Callable by anonymous readers; writes nothing else and returns nothing.';

-- Only the two roles a browser can hold. PUBLIC would include any future role.
REVOKE ALL ON FUNCTION public.increment_article_view(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_article_view(TEXT) TO anon, authenticated;

-- The function filters on slug; the table has a unique index on it from the
-- original schema, so no new index is needed.
