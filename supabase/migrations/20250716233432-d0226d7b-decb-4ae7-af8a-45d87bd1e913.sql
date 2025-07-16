-- Create newsletter subscribers table
CREATE TABLE public.newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  welcome_email_sent BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Create policies for newsletter subscribers
CREATE POLICY "Newsletter subscribers can be created" 
ON public.newsletter_subscribers 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Newsletter subscribers can be read" 
ON public.newsletter_subscribers 
FOR SELECT 
USING (true);

CREATE POLICY "Newsletter subscribers can be updated" 
ON public.newsletter_subscribers 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_newsletter_subscribers_updated_at
BEFORE UPDATE ON public.newsletter_subscribers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();