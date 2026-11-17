-- Newsletter double opt-in (US-107).
--
-- A signup now creates an inactive, unconfirmed row and mails a confirmation
-- link. Only the SHA-256 hash of that link's token is stored, so a leaked
-- table dump can't be used to confirm anyone. The welcome email and every
-- later send go out only after confirmed_at is set.
--
-- Unsubscribe links need no column: they carry an HMAC of the subscriber id
-- keyed with the NEWSLETTER_TOKEN_SECRET edge function secret.
--
-- Columns:
--   confirmation_token_hash  hex SHA-256 of the newest confirmation token
--   confirmation_sent_at     when that token was mailed; drives the 7-day
--                            expiry and the 10-minute resend cooldown
--   confirmed_at             when the address was confirmed
--   unsubscribed_at          when the subscriber last opted out
--
-- Safe to re-run: columns and indexes use IF NOT EXISTS, and each backfill
-- only touches rows it has not already filled.

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirmation_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- Everyone already active signed up under the old single opt-in and has been
-- getting mail; treat them as confirmed as of their signup.
UPDATE public.newsletter_subscribers
SET confirmed_at = COALESCE(subscribed_at, created_at, now())
WHERE active = true
  AND confirmed_at IS NULL;

-- Rows that were already inactive before this migration were opted out by
-- hand. Record that so they read as unsubscribed rather than pending. A row
-- the new flow created always has confirmation_sent_at or confirmed_at set,
-- so a re-run leaves those alone.
UPDATE public.newsletter_subscribers
SET unsubscribed_at = COALESCE(updated_at, now())
WHERE active = false
  AND unsubscribed_at IS NULL
  AND confirmed_at IS NULL
  AND confirmation_sent_at IS NULL;

-- newsletter-confirm looks rows up by token hash.
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_confirmation_token_hash
  ON public.newsletter_subscribers (confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;
