-- Add sort_order field to projects table
ALTER TABLE public.projects 
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Add sort_order field to ai_tools table
ALTER TABLE public.ai_tools 
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Update existing records to have incremental sort_order based on created_at
UPDATE public.projects 
SET sort_order = row_number() OVER (ORDER BY created_at ASC);

UPDATE public.ai_tools 
SET sort_order = row_number() OVER (ORDER BY created_at ASC);

-- Add indexes for better performance
CREATE INDEX idx_projects_sort_order ON public.projects(sort_order);
CREATE INDEX idx_ai_tools_sort_order ON public.ai_tools(sort_order);