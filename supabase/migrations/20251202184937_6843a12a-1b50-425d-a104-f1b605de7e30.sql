-- Add project_id column to secure_vault_items
ALTER TABLE public.secure_vault_items 
ADD COLUMN project_id uuid REFERENCES public.task_projects(id) ON DELETE SET NULL;

-- Create index for faster project filtering
CREATE INDEX idx_secure_vault_items_project ON public.secure_vault_items(project_id);