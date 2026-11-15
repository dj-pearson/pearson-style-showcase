-- Rollback for 20261116000201_amazon_stats_unique_nulls_not_distinct.sql
-- Restores the original UNIQUE (article_id, asin, date), where NULL
-- article_id values are distinct. Duplicate rows deleted by the forward
-- migration are not restored. Redeploy the previous AmazonReportImporter
-- first: the new one upserts with ON CONFLICT (article_id, asin, date), which
-- still works against this constraint but will insert repeat NULL-article rows.

ALTER TABLE public.amazon_affiliate_stats
  DROP CONSTRAINT IF EXISTS amazon_affiliate_stats_article_asin_date_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.amazon_affiliate_stats'::regclass
      AND conname = 'amazon_affiliate_stats_article_id_asin_date_key'
  ) THEN
    ALTER TABLE public.amazon_affiliate_stats
      ADD CONSTRAINT amazon_affiliate_stats_article_id_asin_date_key
      UNIQUE (article_id, asin, date);
  END IF;
END $$;
