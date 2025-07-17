-- Create table to store Google Analytics data
CREATE TABLE public.analytics_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  date DATE NOT NULL,
  dimensions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_analytics_data_date ON public.analytics_data(date DESC);
CREATE INDEX idx_analytics_data_metric ON public.analytics_data(metric_name, date DESC);

-- Enable RLS
ALTER TABLE public.analytics_data ENABLE ROW LEVEL SECURITY;

-- Create policies for analytics data
CREATE POLICY "Analytics data can be read" 
ON public.analytics_data 
FOR SELECT 
USING (true);

CREATE POLICY "Analytics data can be created" 
ON public.analytics_data 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Analytics data can be updated" 
ON public.analytics_data 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_analytics_data_updated_at
BEFORE UPDATE ON public.analytics_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();