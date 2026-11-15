-- Rollback for 20261116000107_newsletter_double_opt_in.sql
-- Drops the double opt-in columns and their index. Redeploy the previous
-- newsletter-signup first. Rows left inactive by an unconfirmed signup stay
-- inactive and get no mail.

DROP INDEX IF EXISTS public.idx_newsletter_confirmation_token_hash;

ALTER TABLE public.newsletter_subscribers
  DROP COLUMN IF EXISTS confirmation_token_hash,
  DROP COLUMN IF EXISTS confirmation_sent_at,
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS unsubscribed_at;
