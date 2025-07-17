-- Insert comprehensive AI tools data from New_AI.md
-- Content Creation Tools
INSERT INTO public.ai_tools (title, description, category, link, pricing, complexity, status, features, tags) VALUES
('OpenAI Sora', 'Revolutionary text-to-video generation with 60-second high-quality videos and 1080p output. Features storyboard mode and concurrent generations for professional creators.', 'Content', 'https://openai.com/sora', '$20-200/month', 'Advanced', 'Active', ARRAY['60-second videos', '1080p output', 'Storyboard mode', 'Concurrent generation'], ARRAY['video', 'ai-generation', 'professional']),

('ElevenLabs Music', 'Transform music creation with 3-minute tracks generated from single prompts and superior vocal synthesis leveraging voice technology leadership.', 'Content', 'https://elevenlabs.io', 'Preview', 'Intermediate', 'Active', ARRAY['3-minute tracks', 'Single prompt generation', 'Vocal synthesis', 'Voice technology'], ARRAY['music', 'audio', 'voice']),

('FLUX.1', 'Open-source image generator with 12 billion parameters and superior text rendering, offering multiple variants (Pro, Dev, Schnell) with competitive API pricing.', 'Image', 'https://blackforestlabs.ai', '$1 per 33 images', 'Intermediate', 'Active', ARRAY['12B parameters', 'Superior text rendering', 'Multiple variants', 'Open source'], ARRAY['image-generation', 'open-source', 'text-rendering']),

('DeepSeek V3 and R1', 'Breakthrough reasoning and coding capabilities, outperforming GPT-4o by 21% on coding tasks with ultra-low pricing and 1M token context windows.', 'Development', 'https://deepseek.com', '$0.27 per 1M tokens', 'Advanced', 'Active', ARRAY['21% better than GPT-4o', '1M token context', 'Real-time web search', 'Ultra-low pricing'], ARRAY['coding', 'reasoning', 'cost-effective']),

('Runway Gen-3 Alpha', 'Professional-grade video generation with motion control and physics simulation for creators and filmmakers.', 'Content', 'https://runway.ml', '$15-95/month', 'Advanced', 'Active', ARRAY['Motion control', 'Physics simulation', 'Professional grade', 'Video generation'], ARRAY['video', 'professional', 'motion']),

('Pika Labs', 'Viral video generation platform with Pikaffects featuring special effects like squish, melt, and inflate for social media creators.', 'Content', 'https://pika.art', 'Freemium', 'Beginner', 'Active', ARRAY['Pikaffects', 'Special effects', 'Social media focused', 'Viral capabilities'], ARRAY['video', 'social-media', 'effects']),

-- Development Tools
('Cursor IDE', 'Product Hunt''s 2024 Product of the Year - the gold standard for AI-assisted development with multi-file context awareness and Composer Mode.', 'Development', 'https://cursor.sh', '$20-200/month', 'Intermediate', 'Active', ARRAY['Multi-file context', 'Composer Mode', 'Custom model selection', 'Codebase refactoring'], ARRAY['ide', 'development', 'ai-coding']),

('Qodo (Codium)', 'Agentic AI for code integrity through testing, reviewing, and writing code end-to-end with parallel prompt chaining for meaningful tests.', 'Development', 'https://qodo.ai', '$19/user/month', 'Advanced', 'Active', ARRAY['End-to-end coding', 'Parallel prompt chaining', 'Code testing', 'Code reviewing'], ARRAY['testing', 'code-review', 'automation']),

('Windsurf IDE', 'Clean, distraction-free AI coding alternative with gentle learning curves and complete free access when using own API keys.', 'Development', 'https://codeium.com/windsurf', '$15-30/user/month', 'Beginner', 'Active', ARRAY['Clean interface', 'Gentle learning curve', 'Free with API keys', 'Distraction-free'], ARRAY['ide', 'beginner-friendly', 'clean-ui']),

('Lovable', 'Specialized rapid React prototyping with Supabase backend integration for fast web application development.', 'Development', 'https://lovable.dev', 'Custom', 'Intermediate', 'Active', ARRAY['React prototyping', 'Supabase integration', 'Rapid development', 'Full-stack'], ARRAY['react', 'supabase', 'prototyping']),

-- Business Automation
('Motion AI', 'Revolutionary task management that automatically schedules tasks to calendars based on priorities, deadlines, and availability.', 'Automation', 'https://motion.ai', '$12/month', 'Intermediate', 'Active', ARRAY['Auto scheduling', 'Priority management', 'Calendar integration', 'Task automation'], ARRAY['productivity', 'scheduling', 'automation']),

('Gumloop', 'Most underrated AI tool connecting multiple LLMs to business workflows through no-code automation - Zapier and ChatGPT combined.', 'Automation', 'https://gumloop.com', 'Custom', 'Intermediate', 'Active', ARRAY['Multiple LLMs', 'No-code automation', 'Business workflows', 'Premium LLM access'], ARRAY['workflow', 'no-code', 'integration']),

('Intercom Fin AI Agent', '65% end-to-end conversation resolution through patented Fin AI Engine with multi-language support for customer service.', 'Chatbot', 'https://intercom.com', 'Enterprise', 'Advanced', 'Active', ARRAY['65% resolution rate', 'Multi-language support', 'Patented AI engine', 'Customer service'], ARRAY['customer-service', 'multilingual', 'enterprise']),

('Clay', 'AI-powered lead generation through data enrichment from 100+ sources with mega-spreadsheet interfaces and CRM integration.', 'Automation', 'https://clay.com', '$149-800/month', 'Advanced', 'Active', ARRAY['100+ data sources', 'Lead scoring', 'CRM integration', 'Data enrichment'], ARRAY['lead-generation', 'crm', 'sales']),

('Asana AI', 'Comprehensive work management with Smart Status updates, Smart Chat assistant, and AI Studio for custom workflows.', 'Automation', 'https://asana.com', '$13.49/user/month', 'Intermediate', 'Active', ARRAY['Smart status updates', 'Smart chat assistant', 'AI Studio', 'Custom workflows'], ARRAY['project-management', 'collaboration', 'workflows']),

-- Research Tools
('Avidnote', 'Comprehensive AI research assistant prioritizing data privacy with end-to-end research workflow support and intelligent note-taking.', 'Content', 'https://avidnote.com', 'Custom', 'Intermediate', 'Active', ARRAY['Data privacy focused', 'Research workflows', 'Paper summarization', 'Note-taking'], ARRAY['research', 'privacy', 'academic']),

('Gatsbi', 'AI co-scientist generating innovative research ideas and publication-ready papers using TRIZ-inspired problem-solving algorithms.', 'Content', 'https://gatsbi.com', '$9.99/month', 'Advanced', 'Active', ARRAY['Research idea generation', 'Publication-ready papers', 'TRIZ algorithms', 'Local data storage'], ARRAY['research', 'academic', 'writing']),

('Delv.AI', 'Multi-document querying platform eliminating data silos, founded by 16-year-old Pranjali Awasthi with $12M valuation.', 'Content', 'https://delv.ai', '$10/month', 'Intermediate', 'Active', ARRAY['Multi-document querying', 'Data silo elimination', 'Young founder story', 'Free tier available'], ARRAY['research', 'document-analysis', 'startup']),

('Julius AI', 'Democratized data analysis through natural language querying with automated chart generation and statistical analysis.', 'Content', 'https://julius.ai', 'Freemium', 'Beginner', 'Active', ARRAY['Natural language queries', 'Automated charts', 'Statistical analysis', 'Non-technical friendly'], ARRAY['data-analysis', 'statistics', 'visualization']),

-- Creative Tools
('Recraft AI', 'Top Text-to-Image Leaderboard performer with V3 model (Red Panda) outperforming Midjourney, offering brand consistency features.', 'Image', 'https://recraft.ai', '$10-47/month', 'Intermediate', 'Active', ARRAY['Text-to-image leader', 'Brand consistency', 'V3 Red Panda model', 'Professional design'], ARRAY['design', 'branding', 'image-generation']),

('Meshy AI', '3D model generation leadership with Meshy-4''s superior geometry precision for game development and 3D printing workflows.', 'Image', 'https://meshy.ai', 'Custom', 'Advanced', 'Active', ARRAY['3D model generation', 'Superior geometry', 'Game development', '3D printing support'], ARRAY['3d-modeling', 'gaming', 'manufacturing']),

('Viggle AI', 'Motion transfer technology animating static images with realistic movement, serving 4+ million Discord users.', 'Image', 'https://viggle.ai', 'Freemium', 'Beginner', 'Active', ARRAY['Motion transfer', 'Static image animation', 'Greenscreen support', 'Motion templates'], ARRAY['animation', 'motion', 'viral']),

('Figma AI', 'Native AI assistance in the world''s most popular design tool with contextual support for copywriting, translation, and prototyping.', 'Image', 'https://figma.com', 'Included in plans', 'Intermediate', 'Active', ARRAY['Native integration', 'Contextual AI support', 'Copywriting assistance', 'Prototype creation'], ARRAY['design', 'prototyping', 'collaboration']);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_tools_category ON public.ai_tools(category);
CREATE INDEX IF NOT EXISTS idx_ai_tools_status ON public.ai_tools(status);
CREATE INDEX IF NOT EXISTS idx_ai_tools_created_at ON public.ai_tools(created_at);