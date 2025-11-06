-- Create table to track used Amazon search terms from CSV
CREATE TABLE IF NOT EXISTS public.amazon_search_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_term TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  product_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.amazon_search_terms ENABLE ROW LEVEL SECURITY;

-- Admin can manage search terms
CREATE POLICY "Admins can manage search terms"
ON public.amazon_search_terms
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create index for faster lookups
CREATE INDEX idx_amazon_search_terms_used ON public.amazon_search_terms(used_at) WHERE used_at IS NULL;
CREATE INDEX idx_amazon_search_terms_category ON public.amazon_search_terms(category);