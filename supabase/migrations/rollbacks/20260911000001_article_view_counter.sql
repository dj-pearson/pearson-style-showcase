-- Rollback for 20260911000001_article_view_counter.sql.
-- Drops the view counter. Existing view_count values are left as they are.
DROP FUNCTION IF EXISTS public.increment_article_view(TEXT);
