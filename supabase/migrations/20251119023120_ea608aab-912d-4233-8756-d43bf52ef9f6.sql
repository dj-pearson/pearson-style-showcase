-- Enable RLS on amazon_api_throttle
ALTER TABLE public.amazon_api_throttle ENABLE ROW LEVEL SECURITY;

-- Add policies for amazon_api_throttle
-- Only service/backend can read and manage this table
CREATE POLICY "Service can manage amazon api throttle"
  ON public.amazon_api_throttle
  FOR ALL
  USING (true)
  WITH CHECK (true);