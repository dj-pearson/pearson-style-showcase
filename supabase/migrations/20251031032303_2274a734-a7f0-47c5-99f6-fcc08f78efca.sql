-- Add cache-only mode setting
ALTER TABLE public.amazon_pipeline_settings
ADD COLUMN IF NOT EXISTS cache_only_mode BOOLEAN NOT NULL DEFAULT false;