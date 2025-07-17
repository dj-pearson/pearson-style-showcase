-- Add sort_order field to projects table
ALTER TABLE public.projects 
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Add sort_order field to ai_tools table
ALTER TABLE public.ai_tools 
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Update existing records to have incremental sort_order using a different approach
WITH ranked_projects AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) as rn
  FROM public.projects
)
UPDATE public.projects 
SET sort_order = ranked_projects.rn
FROM ranked_projects
WHERE projects.id = ranked_projects.id;

WITH ranked_ai_tools AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) as rn
  FROM public.ai_tools
)
UPDATE public.ai_tools 
SET sort_order = ranked_ai_tools.rn
FROM ranked_ai_tools
WHERE ai_tools.id = ranked_ai_tools.id;

-- Add indexes for better performance
CREATE INDEX idx_projects_sort_order ON public.projects(sort_order);
CREATE INDEX idx_ai_tools_sort_order ON public.ai_tools(sort_order);