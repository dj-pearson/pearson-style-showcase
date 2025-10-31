-- Create settings table for pipeline configuration
CREATE TABLE IF NOT EXISTS public.amazon_pipeline_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niches JSONB NOT NULL DEFAULT '["home office", "travel gear", "fitness"]'::jsonb,
  daily_post_count INTEGER NOT NULL DEFAULT 1,
  min_rating NUMERIC NOT NULL DEFAULT 4.0,
  price_min NUMERIC,
  price_max NUMERIC,
  review_required BOOLEAN NOT NULL DEFAULT false,
  word_count_target INTEGER NOT NULL DEFAULT 1500,
  amazon_tag TEXT NOT NULL DEFAULT 'your-tag-20',
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create runs table for logging pipeline executions
CREATE TABLE IF NOT EXISTS public.amazon_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'fail', 'partial')),
  note TEXT,
  posts_created INTEGER DEFAULT 0,
  posts_published INTEGER DEFAULT 0,
  errors JSONB
);

-- Create products table for Amazon items
CREATE TABLE IF NOT EXISTS public.amazon_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asin TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  brand TEXT,
  rating NUMERIC,
  rating_count INTEGER,
  price NUMERIC,
  image_url TEXT,
  niche TEXT,
  bullet_points JSONB,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create post_products relationship table
CREATE TABLE IF NOT EXISTS public.article_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  asin TEXT REFERENCES public.amazon_products(asin) NOT NULL,
  summary TEXT,
  pros JSONB,
  cons JSONB,
  specs JSONB,
  best_for TEXT,
  affiliate_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create logs table for detailed pipeline logging
CREATE TABLE IF NOT EXISTS public.amazon_pipeline_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.amazon_pipeline_runs(id) ON DELETE CASCADE NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message TEXT NOT NULL,
  ctx JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.amazon_pipeline_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amazon_pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amazon_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amazon_pipeline_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settings
CREATE POLICY "Anyone can read pipeline settings"
  ON public.amazon_pipeline_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update pipeline settings"
  ON public.amazon_pipeline_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can create pipeline settings"
  ON public.amazon_pipeline_settings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for runs
CREATE POLICY "Only admins can read pipeline runs"
  ON public.amazon_pipeline_runs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can create runs"
  ON public.amazon_pipeline_runs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update runs"
  ON public.amazon_pipeline_runs
  FOR UPDATE
  USING (true);

-- RLS Policies for products
CREATE POLICY "Anyone can read products"
  ON public.amazon_products
  FOR SELECT
  USING (true);

CREATE POLICY "Service can manage products"
  ON public.amazon_products
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for article_products
CREATE POLICY "Anyone can read article products"
  ON public.article_products
  FOR SELECT
  USING (true);

CREATE POLICY "Service can manage article products"
  ON public.article_products
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for logs
CREATE POLICY "Only admins can read pipeline logs"
  ON public.amazon_pipeline_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can create logs"
  ON public.amazon_pipeline_logs
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_amazon_products_asin ON public.amazon_products(asin);
CREATE INDEX IF NOT EXISTS idx_amazon_products_niche ON public.amazon_products(niche);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON public.amazon_pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_run_id ON public.amazon_pipeline_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_article_products_article_id ON public.article_products(article_id);

-- Create trigger for updating updated_at
CREATE TRIGGER update_pipeline_settings_updated_at
  BEFORE UPDATE ON public.amazon_pipeline_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.amazon_pipeline_settings (amazon_tag)
VALUES ('your-tag-20')
ON CONFLICT DO NOTHING;