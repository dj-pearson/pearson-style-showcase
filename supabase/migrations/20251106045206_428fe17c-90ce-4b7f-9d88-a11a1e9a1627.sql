-- Amazon Associates tracking tables
CREATE TABLE IF NOT EXISTS public.amazon_affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  asin text NOT NULL,
  clicked_at timestamp with time zone NOT NULL DEFAULT now(),
  user_agent text,
  referrer text,
  ip_address text,
  session_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.amazon_affiliate_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  asin text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  clicks integer NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0,
  revenue numeric(10,2) NOT NULL DEFAULT 0,
  commission numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(article_id, asin, date)
);

-- Enable RLS
ALTER TABLE public.amazon_affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amazon_affiliate_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clicks (service can insert, admins can read)
CREATE POLICY "Service can create affiliate clicks"
ON public.amazon_affiliate_clicks
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read affiliate clicks"
ON public.amazon_affiliate_clicks
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for stats (admins can manage)
CREATE POLICY "Admins can read affiliate stats"
ON public.amazon_affiliate_stats
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create affiliate stats"
ON public.amazon_affiliate_stats
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update affiliate stats"
ON public.amazon_affiliate_stats
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX idx_affiliate_clicks_article_id ON public.amazon_affiliate_clicks(article_id);
CREATE INDEX idx_affiliate_clicks_asin ON public.amazon_affiliate_clicks(asin);
CREATE INDEX idx_affiliate_clicks_clicked_at ON public.amazon_affiliate_clicks(clicked_at);
CREATE INDEX idx_affiliate_stats_article_id ON public.amazon_affiliate_stats(article_id);
CREATE INDEX idx_affiliate_stats_date ON public.amazon_affiliate_stats(date);

-- Trigger for updated_at
CREATE TRIGGER update_amazon_affiliate_stats_updated_at
BEFORE UPDATE ON public.amazon_affiliate_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();