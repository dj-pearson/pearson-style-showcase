-- amazon_affiliate_stats: one row per (article_id, asin, date), NULL article
-- included.
--
-- The table's grain is per article: track-affiliate-click counts clicks per
-- (article_id, asin, date), and one ASIN can sit in several articles. The
-- original UNIQUE (article_id, asin, date) treats NULL article_id values as
-- distinct, so report imports for ASINs that match no article piled up a new
-- row per run. NULLS NOT DISTINCT (Postgres 15+) closes that gap and lets the
-- importer upsert with ON CONFLICT (article_id, asin, date).
--
-- Existing duplicates can only be rows with NULL article_id and the same
-- (asin, date). Each one came from re-importing the same report row, so they
-- carry the same totals rather than parts of one; summing them would double
-- count. This migration keeps the most recently updated row of each group,
-- deletes the rest, and reports the count with a NOTICE.
--
-- Safe to re-run: the dedupe finds nothing the second time and the
-- constraint swap checks what exists.

DO $$
DECLARE
  removed integer;
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION 'amazon_affiliate_stats NULLS NOT DISTINCT needs Postgres 15+, found %',
      current_setting('server_version');
  END IF;

  WITH ranked AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY asin, date
             ORDER BY updated_at DESC, created_at DESC, id DESC
           ) AS rn
    FROM public.amazon_affiliate_stats
    WHERE article_id IS NULL
  )
  DELETE FROM public.amazon_affiliate_stats s
  USING ranked r
  WHERE s.id = r.id AND r.rn > 1;

  GET DIAGNOSTICS removed = ROW_COUNT;
  RAISE NOTICE 'amazon_affiliate_stats: removed % duplicate NULL-article rows (kept latest per asin, date)', removed;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.amazon_affiliate_stats'::regclass
      AND conname = 'amazon_affiliate_stats_article_asin_date_key'
  ) THEN
    ALTER TABLE public.amazon_affiliate_stats
      DROP CONSTRAINT IF EXISTS amazon_affiliate_stats_article_id_asin_date_key;
    ALTER TABLE public.amazon_affiliate_stats
      ADD CONSTRAINT amazon_affiliate_stats_article_asin_date_key
      UNIQUE NULLS NOT DISTINCT (article_id, asin, date);
  END IF;
END $$;
