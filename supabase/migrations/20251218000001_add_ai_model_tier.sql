-- =====================================================
-- Add model_tier column to ai_model_configs
-- Allows distinguishing between lightweight (fast/cheap) and normal (quality) models
-- =====================================================

-- Add model_tier column with constraint
ALTER TABLE public.ai_model_configs 
ADD COLUMN IF NOT EXISTS model_tier TEXT DEFAULT 'normal' 
CHECK (model_tier IN ('lightweight', 'normal'));

-- Create index for faster tier-based lookups
CREATE INDEX IF NOT EXISTS idx_ai_configs_tier ON public.ai_model_configs(model_tier, is_active, priority DESC) WHERE is_active = true;

-- Update existing configs with appropriate tiers based on model names
-- Lightweight models: flash variants, mini models, faster/cheaper options
UPDATE public.ai_model_configs 
SET model_tier = 'lightweight' 
WHERE model_name ILIKE '%flash%' 
   OR model_name ILIKE '%mini%'
   OR model_name ILIKE '%haiku%'
   OR model_name ILIKE '%instant%';

-- Normal models: pro, sonnet, opus, full models
UPDATE public.ai_model_configs 
SET model_tier = 'normal' 
WHERE model_tier IS NULL 
   OR (model_name ILIKE '%pro%' 
       OR model_name ILIKE '%sonnet%' 
       OR model_name ILIKE '%opus%'
       OR model_name ILIKE '%4o%'
       OR model_name ILIKE '%gpt-4%');

-- Comment on the new column
COMMENT ON COLUMN public.ai_model_configs.model_tier IS 
'Model tier: lightweight for fast/cheap tasks (extraction, social posts), normal for quality tasks (articles, reports)';

