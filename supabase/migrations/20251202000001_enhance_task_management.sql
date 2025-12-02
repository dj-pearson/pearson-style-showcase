-- Enhance task management schema to support CSV imports from multiple platforms
-- Adds fields for category, effort, dependencies, and source tracking

-- Add new columns to task_projects to track source/platform
ALTER TABLE task_projects 
ADD COLUMN IF NOT EXISTS platform TEXT, -- e.g., 'Enterprise Readiness', 'Platform A', etc.
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb; -- Additional platform-specific data

-- Add new columns to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS category TEXT, -- Category from CSV (e.g., 'Core Auth', 'Security')
ADD COLUMN IF NOT EXISTS effort TEXT, -- Effort estimate (e.g., '2 hours', '4 hours')
ADD COLUMN IF NOT EXISTS dependencies TEXT, -- Dependencies as text
ADD COLUMN IF NOT EXISTS source TEXT, -- Source file or platform name
ADD COLUMN IF NOT EXISTS original_priority TEXT, -- Original priority from CSV (e.g., 'P0-Critical')
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb, -- Additional CSV-specific fields
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'; -- Searchable tags

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_effort ON tasks(effort);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source);
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_tasks_search ON tasks USING GIN(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(category, '')));

-- Create a view for easy querying with all relevant fields
CREATE OR REPLACE VIEW tasks_full_view AS
SELECT 
  t.*,
  tp.name as project_name,
  tp.domain as project_domain,
  tp.platform as project_platform,
  tp.color as project_color,
  (SELECT COUNT(*) FROM subtasks WHERE parent_task_id = t.id) as subtask_count,
  (SELECT COUNT(*) FROM subtasks WHERE parent_task_id = t.id AND status = 'completed') as completed_subtasks
FROM tasks t
LEFT JOIN task_projects tp ON t.project_id = tp.id;

-- Create a function to map CSV priority to standard priority
CREATE OR REPLACE FUNCTION map_priority(original_priority TEXT)
RETURNS TEXT AS $$
BEGIN
  IF original_priority ILIKE 'P0%' OR original_priority ILIKE '%critical%' THEN
    RETURN 'urgent';
  ELSIF original_priority ILIKE 'P1%' OR original_priority ILIKE '%high%' THEN
    RETURN 'high';
  ELSIF original_priority ILIKE 'P2%' OR original_priority ILIKE '%medium%' THEN
    RETURN 'medium';
  ELSIF original_priority ILIKE 'P3%' OR original_priority ILIKE '%low%' THEN
    RETURN 'low';
  ELSE
    RETURN 'medium';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to map CSV status to standard status
CREATE OR REPLACE FUNCTION map_status(original_status TEXT)
RETURNS TEXT AS $$
BEGIN
  IF original_status ILIKE '%complete%' OR original_status ILIKE '%done%' THEN
    RETURN 'completed';
  ELSIF original_status ILIKE '%progress%' OR original_status ILIKE '%partial%' THEN
    RETURN 'in_progress';
  ELSIF original_status ILIKE '%not%start%' OR original_status ILIKE '%todo%' OR original_status ILIKE '%pending%' THEN
    RETURN 'to_do';
  ELSE
    RETURN 'to_do';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment for documentation
COMMENT ON COLUMN tasks.category IS 'Category from CSV import (e.g., Core Auth, Security, Billing)';
COMMENT ON COLUMN tasks.effort IS 'Estimated effort from CSV (e.g., 2 hours, 4 hours, 8 hours)';
COMMENT ON COLUMN tasks.dependencies IS 'Task dependencies as text';
COMMENT ON COLUMN tasks.source IS 'Source platform or CSV file name';
COMMENT ON COLUMN tasks.original_priority IS 'Original priority value from CSV (e.g., P0-Critical, P1-High)';

