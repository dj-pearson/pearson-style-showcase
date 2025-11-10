-- Create testimonials table for client reviews and social proof
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_title TEXT,
  client_company TEXT,
  client_photo_url TEXT,
  testimonial_text TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  project_type TEXT,
  project_url TEXT,
  featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create profile_settings table for site owner profile data
CREATE TABLE IF NOT EXISTS public.profile_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_photo_url TEXT,
  hero_tagline TEXT,
  availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'limited', 'unavailable')),
  availability_text TEXT,
  calendly_url TEXT,
  resume_url TEXT,
  linkedin_url TEXT DEFAULT 'https://www.linkedin.com/in/danpearson',
  github_url TEXT DEFAULT 'https://github.com/danpearson',
  email TEXT DEFAULT 'dan@danpearson.net',
  phone TEXT,
  location TEXT DEFAULT 'Des Moines Metropolitan Area',
  years_experience INTEGER DEFAULT 15,
  bio_headline TEXT,
  bio_subheadline TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create ventures/platforms table for current projects
CREATE TABLE IF NOT EXISTS public.ventures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  screenshot_url TEXT,
  tech_stack TEXT[], -- Array of technologies used
  status TEXT DEFAULT 'in-development' CHECK (status IN ('planning', 'in-development', 'beta', 'live', 'maintenance', 'archived')),
  live_url TEXT,
  github_url TEXT,
  metrics JSONB, -- Store various metrics like user_count, revenue, etc.
  featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  launch_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON public.testimonials(featured) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON public.testimonials(status);
CREATE INDEX IF NOT EXISTS idx_ventures_featured ON public.ventures(featured);
CREATE INDEX IF NOT EXISTS idx_ventures_status ON public.ventures(status);

-- Enable Row Level Security
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventures ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to published testimonials"
  ON public.testimonials
  FOR SELECT
  USING (status = 'published');

CREATE POLICY "Allow public read access to profile settings"
  ON public.profile_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to ventures"
  ON public.ventures
  FOR SELECT
  USING (true);

-- Create policies for admin write access (you'll need to configure admin role)
CREATE POLICY "Allow admin full access to testimonials"
  ON public.testimonials
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

CREATE POLICY "Allow admin full access to profile settings"
  ON public.profile_settings
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

CREATE POLICY "Allow admin full access to ventures"
  ON public.ventures
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Insert default profile settings
INSERT INTO public.profile_settings (
  profile_photo_url,
  hero_tagline,
  availability_status,
  availability_text,
  location,
  years_experience,
  bio_headline,
  bio_subheadline
) VALUES (
  '/placeholder.svg',
  'Sales Leader • NFT Developer • AI Enthusiast',
  'available',
  'Currently available for consulting and collaboration',
  'Des Moines Metropolitan Area',
  15,
  'Bridging the gap between sales and technology',
  'With 15+ years closing deals and a passion for AI-powered automation, I build products that actually sell.'
);

-- Insert sample testimonials (to be replaced with real ones)
INSERT INTO public.testimonials (
  client_name,
  client_title,
  client_company,
  testimonial_text,
  rating,
  project_type,
  featured,
  display_order,
  status
) VALUES
(
  'Sample Client 1',
  'CEO',
  'Tech Company Inc.',
  'Dan transformed our sales process with his unique combination of technical expertise and sales leadership. Our conversion rates increased by 40% within the first quarter.',
  5,
  'AI Automation',
  true,
  1,
  'draft'
),
(
  'Sample Client 2',
  'Founder',
  'NFT Studio',
  'Working with Dan on our NFT collection was incredible. He delivered 10,000 unique pieces with perfect rarity distribution, ahead of schedule.',
  5,
  'NFT Development',
  true,
  2,
  'draft'
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profile_settings_updated_at
  BEFORE UPDATE ON public.profile_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ventures_updated_at
  BEFORE UPDATE ON public.ventures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment documentation
COMMENT ON TABLE public.testimonials IS 'Client testimonials and reviews for social proof';
COMMENT ON TABLE public.profile_settings IS 'Site owner profile information and settings';
COMMENT ON TABLE public.ventures IS 'Current ventures and platforms being built';
