-- Migration: Create content tables for dynamic data
-- Tables: case_studies, faqs, achievements, work_experience, certifications
-- Purpose: Move hardcoded frontend data to database for easier management

-- =====================================================
-- Case Studies Table
-- =====================================================
CREATE TABLE IF NOT EXISTS case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge TEXT,
  solution TEXT,
  results TEXT[] DEFAULT '{}',
  technologies TEXT[] DEFAULT '{}',
  icon_name TEXT DEFAULT 'Code', -- Lucide icon name
  gradient TEXT DEFAULT 'from-purple-500 to-violet-600',
  link TEXT,
  display_order INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE case_studies ENABLE ROW LEVEL SECURITY;

-- Public read access for published case studies
CREATE POLICY "Public can view published case studies"
  ON case_studies FOR SELECT
  USING (status = 'published');

-- Admin full access (via service role)
CREATE POLICY "Service role has full access to case studies"
  ON case_studies FOR ALL
  USING (auth.role() = 'service_role');

-- Insert seed data from hardcoded CaseStudies.tsx
INSERT INTO case_studies (id, title, category, description, challenge, solution, results, technologies, icon_name, gradient, display_order)
VALUES
  (
    gen_random_uuid(),
    'Generative NFT Collection',
    'Blockchain Development',
    'Developed a unique 10,000-piece generative NFT collection with mathematical precision and artistic flair.',
    'Create a scalable system for generating unique, mathematically-driven NFT artwork with rarity distribution.',
    'Built custom algorithms using Python and JavaScript to generate unique combinations with weighted rarity traits.',
    ARRAY['10,000 unique NFTs generated', '100% trait uniqueness guaranteed', 'Optimal rarity distribution achieved', 'Reduced generation time by 80%'],
    ARRAY['Python', 'JavaScript', 'Blockchain', 'IPFS', 'Smart Contracts'],
    'Code',
    'from-purple-500 to-violet-600',
    1
  ),
  (
    gen_random_uuid(),
    'AI-Powered Business Automation',
    'AI Integration',
    'Implemented AI solutions to automate key business processes, reducing manual work by 60%.',
    'Streamline repetitive business tasks while maintaining quality and accuracy standards.',
    'Integrated OpenAI APIs with custom workflows to automate data processing, content generation, and analysis.',
    ARRAY['60% reduction in manual tasks', '95% accuracy in automated processes', '$50k+ annual cost savings', '3x faster processing times'],
    ARRAY['OpenAI API', 'Python', 'React', 'Node.js', 'MongoDB'],
    'Zap',
    'from-cyan-500 to-blue-600',
    2
  ),
  (
    gen_random_uuid(),
    'Sales Team Performance Optimization',
    'Business Development',
    'Led strategic initiatives that resulted in 40% revenue growth through team optimization and process improvement.',
    'Improve sales team performance and increase revenue while maintaining customer satisfaction.',
    'Implemented data-driven sales strategies, CRM optimization, and comprehensive training programs.',
    ARRAY['40% revenue growth achieved', '25% increase in conversion rates', '90% team satisfaction score', 'Reduced sales cycle by 30%'],
    ARRAY['CRM Systems', 'Data Analytics', 'Sales Automation', 'Training Programs'],
    'TrendingUp',
    'from-green-500 to-emerald-600',
    3
  );

-- =====================================================
-- FAQs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  display_order INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- Public read access for published FAQs
CREATE POLICY "Public can view published faqs"
  ON faqs FOR SELECT
  USING (status = 'published');

-- Admin full access (via service role)
CREATE POLICY "Service role has full access to faqs"
  ON faqs FOR ALL
  USING (auth.role() = 'service_role');

-- Insert seed data from hardcoded FAQSection.tsx
INSERT INTO faqs (id, question, answer, category, display_order)
VALUES
  (
    gen_random_uuid(),
    'What makes AI automation different from traditional automation?',
    'AI automation uses artificial intelligence to handle complex tasks that require decision-making and pattern recognition, unlike traditional automation which follows rigid, pre-programmed rules. AI automation can adapt to new scenarios, learn from data patterns, and handle unstructured information like natural language or images. For example, an AI-powered customer service system can understand context and intent in customer messages, while traditional automation can only respond to specific keywords. Our clients typically see 40% higher efficiency with AI automation compared to rule-based systems, as AI can handle exceptions and edge cases that would require manual intervention with traditional automation.',
    'ai-automation',
    1
  ),
  (
    gen_random_uuid(),
    'How long does AI implementation typically take?',
    'The timeline for AI implementation varies based on complexity and scope. For small businesses implementing AI tools like chatbots or document processing, you can see results in 2-4 weeks. Mid-sized automation projects involving custom AI workflows typically take 6-12 weeks from planning to deployment. Enterprise-scale AI implementations with multiple integrations can take 3-6 months. We follow a phased approach: Week 1-2 for process audit and planning, Week 3-4 for tool selection and setup, Week 5-8 for implementation and testing, and ongoing optimization. Most clients start seeing ROI within the first 60 days of deployment.',
    'ai-automation',
    2
  ),
  (
    gen_random_uuid(),
    'What''s the ROI timeline for AI solutions?',
    'Based on data from our 50+ client implementations, most businesses see positive ROI within 3-6 months. Initial investments typically range from $3,000-$15,000 for SMBs, covering software licenses, implementation, and training. Common ROI indicators include: 35-50% reduction in operational costs within 90 days, 6.5 hours saved per employee per week on average, and 40% improvement in task accuracy. For example, one client invested $8,000 in AI-powered invoice processing and saved $2,400 monthly in labor costs—achieving full ROI in 3.3 months. The key is starting with high-impact, repetitive processes where AI can deliver immediate value.',
    'roi',
    3
  ),
  (
    gen_random_uuid(),
    'Do I need technical expertise to implement AI?',
    'No, you don''t need to be technical to benefit from AI automation. Modern AI tools are designed for business users, with visual interfaces and no-code solutions. However, strategic guidance is valuable for choosing the right tools and designing effective workflows. That''s where consulting helps—we handle the technical complexity while you focus on your business goals. Our typical client is a business owner or operations manager who understands their processes but needs expert guidance on AI implementation. We provide training, documentation, and ongoing support to ensure your team can manage and optimize AI systems independently after implementation.',
    'getting-started',
    4
  ),
  (
    gen_random_uuid(),
    'How do you measure AI project success?',
    'We measure AI project success using concrete, business-focused metrics. Primary KPIs include: Time saved (hours per week/month), cost reduction (percentage decrease in operational expenses), accuracy improvement (error rate reduction), and speed increase (tasks completed per hour). We also track adoption metrics like user engagement and system utilization. For each project, we establish baseline measurements before implementation and track progress weekly during the first month, then monthly. For example, a recent client had baseline metrics of 120 manual invoice processing hours/month with 8% error rate. After AI implementation, this dropped to 40 hours/month with 0.5% error rate—a 67% time savings and 94% accuracy improvement. We provide monthly reports with these metrics to ensure transparency and continuous optimization.',
    'measurement',
    5
  );

-- =====================================================
-- Achievements Table (for About page)
-- =====================================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  company TEXT,
  icon_name TEXT DEFAULT 'TrendingUp', -- Lucide icon name
  display_order INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can view published achievements"
  ON achievements FOR SELECT
  USING (status = 'published');

-- Admin full access
CREATE POLICY "Service role has full access to achievements"
  ON achievements FOR ALL
  USING (auth.role() = 'service_role');

-- Insert seed data
INSERT INTO achievements (label, company, icon_name, display_order)
VALUES
  ('Increased client retention by 30%', 'Pearson Media', 'TrendingUp', 1),
  ('Boosted revenue by 25%', 'Pearson Media & Fitness World', 'TrendingUp', 2),
  ('Secured 15% growth in annual sales', 'Multiple Organizations', 'TrendingUp', 3),
  ('Exceeded sales quotas by 20% in 6 months', 'USA TODAY', 'TrendingUp', 4),
  ('90% customer retention rate', 'USA TODAY', 'Users', 5),
  ('Drove over $600K in monthly sales across 29 locations', 'XSport Fitness', 'TrendingUp', 6),
  ('Doubled membership base', 'Fitness World', 'Users', 7),
  ('Expanded team from 5 to 15 personal trainers', 'Bally Total Fitness', 'Users', 8);

-- =====================================================
-- Work Experience Table
-- =====================================================
CREATE TABLE IF NOT EXISTS work_experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  duration TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  highlights TEXT[] DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE work_experience ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can view published work_experience"
  ON work_experience FOR SELECT
  USING (status = 'published');

-- Admin full access
CREATE POLICY "Service role has full access to work_experience"
  ON work_experience FOR ALL
  USING (auth.role() = 'service_role');

-- Insert seed data
INSERT INTO work_experience (company, role, duration, is_current, highlights, display_order)
VALUES
  (
    'Pearson Media LLC',
    'Founder & Developer',
    'March 2018 - Present (7 years)',
    true,
    ARRAY[
      'Building 7 AI-powered SaaS platforms',
      'Developed 10,000+ unique NFTs with 100% trait uniqueness',
      'Created AI automation reducing manual tasks by 60%',
      'Full-stack development: React, TypeScript, Supabase, AI integration'
    ],
    1
  ),
  (
    'Infomax Office Systems',
    'Solutions and Production Consultant',
    'January 2024 - Present',
    true,
    ARRAY[
      'Leading technical solutions and production optimization',
      'Managing team of 10 direct reports',
      'Driving digital transformation initiatives'
    ],
    2
  ),
  (
    'USA TODAY NETWORK',
    'Sales Solutions Consultant',
    'April 2022 - June 2024 (2 years)',
    false,
    ARRAY[
      'Exceeded sales quotas by 20% within six months',
      'Maintained 90% customer retention rate',
      'Consulted on digital marketing solutions'
    ],
    3
  ),
  (
    'XSport Fitness',
    'Regional Director',
    '5 years 8 months',
    false,
    ARRAY[
      'Managed 29 locations as Regional Director',
      'Drove over $600K in monthly sales',
      'Built and led high-performing teams'
    ],
    4
  );

-- =====================================================
-- Certifications Table
-- =====================================================
CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  issuing_organization TEXT,
  issue_date DATE,
  expiry_date DATE,
  credential_id TEXT,
  credential_url TEXT,
  display_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can view published certifications"
  ON certifications FOR SELECT
  USING (status = 'published');

-- Admin full access
CREATE POLICY "Service role has full access to certifications"
  ON certifications FOR ALL
  USING (auth.role() = 'service_role');

-- Insert seed data
INSERT INTO certifications (name, display_order)
VALUES
  ('PaperCut Certified', 1),
  ('Canon UniFlow Certified', 2),
  ('PrinterLogic Certified', 3),
  ('Notary Public', 4);

-- =====================================================
-- Create updated_at triggers
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all new tables
DO $$
DECLARE
  tables TEXT[] := ARRAY['case_studies', 'faqs', 'achievements', 'work_experience', 'certifications'];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
      CREATE TRIGGER update_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END $$;

-- =====================================================
-- Grant permissions for authenticated users (admin)
-- =====================================================
GRANT SELECT ON case_studies TO anon;
GRANT SELECT ON faqs TO anon;
GRANT SELECT ON achievements TO anon;
GRANT SELECT ON work_experience TO anon;
GRANT SELECT ON certifications TO anon;

GRANT ALL ON case_studies TO authenticated;
GRANT ALL ON faqs TO authenticated;
GRANT ALL ON achievements TO authenticated;
GRANT ALL ON work_experience TO authenticated;
GRANT ALL ON certifications TO authenticated;
