-- Make ai_model_configs able to hold the values the edge functions ask for,
-- and stop the anon key from writing to it.
--
-- WHY THIS EXISTS
-- ---------------
-- Both problems were found while consolidating the two edge-function trees into
-- supabase/functions as the single source of truth.
--
-- 1. use_case CHECK was too narrow.
--    20251119162204 constrained use_case to ('general', 'ticket_response',
--    'content_generation'). The consolidated _shared/ai-helper.ts is called with
--    six values:
--
--      ai-content-generator          content_generation      (allowed)
--      amazon-article-pipeline       article_generation      (REJECTED)
--      generate-ai-article           article_generation      (REJECTED)
--      extract-from-url              url_extraction          (REJECTED)
--      generate-social-content       social_content          (REJECTED)
--      process-accounting-document   document_processing     (REJECTED)
--
--    Four of the six could never be stored, so those functions silently fell
--    through getAIConfigs' 'general' fallback and every task ran on whatever
--    the default model was. Nothing errored, which is why it went unnoticed.
--
--    getAIConfigs matches with String.includes() and looks for a literal 'all'
--    token, so use_case is a comma-separated list, not a single value. The new
--    constraint validates each token against the vocabulary instead of the
--    whole string, which the old IN-list could not express.
--
-- 2. RLS was open to anon.
--    The same migration created both policies as USING (true) under a comment
--    claiming "admin only access". SELECT and ALL were therefore granted to
--    every caller, including the anon key. That exposes api_key_secret_name
--    (the name of each provider key) and, worse, allows an unauthenticated
--    write to repoint model_name or api_key_secret_name. Edge functions use the
--    service-role key and bypass RLS, so they are unaffected. The only frontend
--    reader is src/components/admin/AIModelConfigManager.tsx, which runs behind
--    the admin dashboard, so the tightened predicate does not break it.
--
--    The predicate matches the one 20260309000001 applied to the accounting
--    tables.
--
-- Idempotent. Safe to re-run.

BEGIN;

-- 1. use_case vocabulary -----------------------------------------------------

ALTER TABLE public.ai_model_configs
  DROP CONSTRAINT IF EXISTS ai_model_configs_use_case_check;

-- Tokens are compared after stripping spaces, so 'general, all' and
-- 'general,all' are both accepted. string_to_array and replace are IMMUTABLE,
-- which is what lets this run inside a CHECK.
ALTER TABLE public.ai_model_configs
  ADD CONSTRAINT ai_model_configs_use_case_check CHECK (
    use_case IS NULL
    OR string_to_array(replace(use_case, ' ', ''), ',') <@ ARRAY[
      'general',
      'all',
      'article_generation',
      'content_generation',
      'document_processing',
      'social_content',
      'ticket_response',
      'url_extraction'
    ]
  );

COMMENT ON COLUMN public.ai_model_configs.use_case IS
'Comma-separated list of tasks this config serves. getAIConfigs prefers a specific match, then a config tagged all, then general. Adding a new task means adding its token to ai_model_configs_use_case_check.';

-- 2. Admin-only access -------------------------------------------------------

DROP POLICY IF EXISTS "Admin users can view AI model configs" ON public.ai_model_configs;
DROP POLICY IF EXISTS "Admin users can manage AI model configs" ON public.ai_model_configs;

CREATE POLICY "Admin users can view AI model configs"
  ON public.ai_model_configs FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'admin'
    OR public.is_email_whitelisted(auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin users can manage AI model configs"
  ON public.ai_model_configs FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'admin'
    OR public.is_email_whitelisted(auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'admin'
    OR public.is_email_whitelisted(auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  );

COMMIT;
