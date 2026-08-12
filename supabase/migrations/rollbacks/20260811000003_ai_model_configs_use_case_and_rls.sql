-- Rollback for 20260811000003_ai_model_configs_use_case_and_rls.sql
--
-- Restores the use_case CHECK and the two RLS policies as 20251119162204
-- created them.
--
-- WARNING: the original policies were USING (true), which grants the anon key
-- read and write on ai_model_configs. Running this reopens that hole. It exists
-- for completeness, not because reverting is advisable.
--
-- The narrow CHECK will fail if any row now holds a use_case outside
-- ('general', 'ticket_response', 'content_generation'). Clear those rows first:
--   UPDATE public.ai_model_configs SET use_case = 'general'
--   WHERE use_case NOT IN ('general', 'ticket_response', 'content_generation');

BEGIN;

ALTER TABLE public.ai_model_configs
  DROP CONSTRAINT IF EXISTS ai_model_configs_use_case_check;

ALTER TABLE public.ai_model_configs
  ADD CONSTRAINT ai_model_configs_use_case_check CHECK (
    use_case IN ('general', 'ticket_response', 'content_generation')
  );

COMMENT ON COLUMN public.ai_model_configs.use_case IS NULL;

DROP POLICY IF EXISTS "Admin users can view AI model configs" ON public.ai_model_configs;
DROP POLICY IF EXISTS "Admin users can manage AI model configs" ON public.ai_model_configs;

CREATE POLICY "Admin users can view AI model configs"
  ON public.ai_model_configs FOR SELECT
  USING (true);

CREATE POLICY "Admin users can manage AI model configs"
  ON public.ai_model_configs FOR ALL
  USING (true);

COMMIT;
