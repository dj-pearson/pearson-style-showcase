-- Migration: Add Command Builder feature to Secure Vault
-- Adds placeholder_key to vault items and creates command templates table

-- Add placeholder_key column to secure_vault_items
-- This allows secrets to be referenced in command templates using [PLACEHOLDER_KEY]
ALTER TABLE public.secure_vault_items
ADD COLUMN IF NOT EXISTS placeholder_key TEXT UNIQUE;

-- Create index for faster lookups by placeholder_key
CREATE INDEX IF NOT EXISTS idx_vault_items_placeholder_key
ON public.secure_vault_items(placeholder_key)
WHERE placeholder_key IS NOT NULL;

-- Create command templates table
CREATE TABLE IF NOT EXISTS public.vault_command_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    template TEXT NOT NULL,
    placeholders TEXT[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add RLS policies
ALTER TABLE public.vault_command_templates ENABLE ROW LEVEL SECURITY;

-- Users can read all templates (system + their own)
CREATE POLICY "Users can view all templates"
ON public.vault_command_templates
FOR SELECT
USING (is_system = true OR auth.uid() = user_id);

-- Users can create their own templates
CREATE POLICY "Users can create their own templates"
ON public.vault_command_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_system = false);

-- Users can update their own templates
CREATE POLICY "Users can update their own templates"
ON public.vault_command_templates
FOR UPDATE
USING (auth.uid() = user_id AND is_system = false);

-- Users can delete their own templates
CREATE POLICY "Users can delete their own templates"
ON public.vault_command_templates
FOR DELETE
USING (auth.uid() = user_id AND is_system = false);

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_command_templates_category
ON public.vault_command_templates(category);

-- Insert system command templates with common DevOps commands
INSERT INTO public.vault_command_templates (name, description, category, template, placeholders, is_system) VALUES
-- Supabase CLI Commands
('Supabase Link Project', 'Link local directory to Supabase project', 'supabase',
 'supabase link --project-ref [SUPABASE_PROJECT_REF]',
 ARRAY['SUPABASE_PROJECT_REF'], true),

('Supabase DB Push', 'Push local migrations to remote database', 'supabase',
 'supabase db push --project-ref [SUPABASE_PROJECT_REF]',
 ARRAY['SUPABASE_PROJECT_REF'], true),

('Supabase DB Pull', 'Pull remote schema to local migrations', 'supabase',
 'supabase db pull --project-ref [SUPABASE_PROJECT_REF]',
 ARRAY['SUPABASE_PROJECT_REF'], true),

('Supabase Generate Types', 'Generate TypeScript types from database schema', 'supabase',
 'supabase gen types typescript --project-id [SUPABASE_PROJECT_REF] > src/integrations/supabase/types.ts',
 ARRAY['SUPABASE_PROJECT_REF'], true),

('Supabase Functions Deploy', 'Deploy Edge Functions to Supabase', 'supabase',
 'supabase functions deploy --project-ref [SUPABASE_PROJECT_REF]',
 ARRAY['SUPABASE_PROJECT_REF'], true),

('Supabase Functions Deploy Single', 'Deploy a specific Edge Function', 'supabase',
 'supabase functions deploy [FUNCTION_NAME] --project-ref [SUPABASE_PROJECT_REF]',
 ARRAY['FUNCTION_NAME', 'SUPABASE_PROJECT_REF'], true),

('Supabase Secrets Set', 'Set a secret for Edge Functions', 'supabase',
 'supabase secrets set [SECRET_NAME]=[SECRET_VALUE] --project-ref [SUPABASE_PROJECT_REF]',
 ARRAY['SECRET_NAME', 'SECRET_VALUE', 'SUPABASE_PROJECT_REF'], true),

-- PostgreSQL Connection Commands
('PSQL Connect Supabase', 'Connect to Supabase PostgreSQL database', 'database',
 'psql -h db.[SUPABASE_PROJECT_REF].supabase.co -p 5432 -d postgres -U postgres',
 ARRAY['SUPABASE_PROJECT_REF'], true),

('PSQL Connect Supabase (Pooler)', 'Connect to Supabase via connection pooler', 'database',
 'psql "postgresql://postgres.[SUPABASE_PROJECT_REF]:[DB_PASSWORD]@aws-0-[SUPABASE_REGION].pooler.supabase.com:6543/postgres"',
 ARRAY['SUPABASE_PROJECT_REF', 'DB_PASSWORD', 'SUPABASE_REGION'], true),

('PSQL Connection String', 'Standard PostgreSQL connection string', 'database',
 'psql "postgresql://[DB_USER]:[DB_PASSWORD]@[DB_HOST]:[DB_PORT]/[DB_NAME]"',
 ARRAY['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_NAME'], true),

('PSQL Backup Database', 'Backup PostgreSQL database to file', 'database',
 'pg_dump -h [DB_HOST] -p [DB_PORT] -U [DB_USER] -d [DB_NAME] -F c -f backup.dump',
 ARRAY['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'], true),

('PSQL Restore Database', 'Restore PostgreSQL database from backup', 'database',
 'pg_restore -h [DB_HOST] -p [DB_PORT] -U [DB_USER] -d [DB_NAME] -c backup.dump',
 ARRAY['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'], true),

-- SSH Commands
('SSH Connect', 'Connect to remote server via SSH', 'ssh',
 'ssh [SSH_USER]@[SSH_HOST] -p [SSH_PORT]',
 ARRAY['SSH_USER', 'SSH_HOST', 'SSH_PORT'], true),

('SSH Connect with Key', 'Connect to remote server using SSH key', 'ssh',
 'ssh -i [SSH_KEY_PATH] [SSH_USER]@[SSH_HOST] -p [SSH_PORT]',
 ARRAY['SSH_KEY_PATH', 'SSH_USER', 'SSH_HOST', 'SSH_PORT'], true),

('SSH Tunnel (Port Forward)', 'Create SSH tunnel for port forwarding', 'ssh',
 'ssh -L [LOCAL_PORT]:[REMOTE_HOST]:[REMOTE_PORT] [SSH_USER]@[SSH_HOST]',
 ARRAY['LOCAL_PORT', 'REMOTE_HOST', 'REMOTE_PORT', 'SSH_USER', 'SSH_HOST'], true),

('SCP Upload File', 'Upload file to remote server', 'ssh',
 'scp [LOCAL_FILE] [SSH_USER]@[SSH_HOST]:[REMOTE_PATH]',
 ARRAY['LOCAL_FILE', 'SSH_USER', 'SSH_HOST', 'REMOTE_PATH'], true),

('SCP Download File', 'Download file from remote server', 'ssh',
 'scp [SSH_USER]@[SSH_HOST]:[REMOTE_FILE] [LOCAL_PATH]',
 ARRAY['SSH_USER', 'SSH_HOST', 'REMOTE_FILE', 'LOCAL_PATH'], true),

-- Docker Commands
('Docker Login Registry', 'Login to Docker registry', 'docker',
 'docker login [DOCKER_REGISTRY] -u [DOCKER_USER] -p [DOCKER_PASSWORD]',
 ARRAY['DOCKER_REGISTRY', 'DOCKER_USER', 'DOCKER_PASSWORD'], true),

('Docker Build & Push', 'Build and push Docker image', 'docker',
 'docker build -t [DOCKER_REGISTRY]/[IMAGE_NAME]:[TAG] . && docker push [DOCKER_REGISTRY]/[IMAGE_NAME]:[TAG]',
 ARRAY['DOCKER_REGISTRY', 'IMAGE_NAME', 'TAG'], true),

('Docker Compose Up', 'Start containers with environment file', 'docker',
 'docker-compose --env-file [ENV_FILE] up -d',
 ARRAY['ENV_FILE'], true),

-- Git Commands
('Git Clone with Token', 'Clone private repository using token', 'git',
 'git clone https://[GIT_TOKEN]@github.com/[GIT_USER]/[GIT_REPO].git',
 ARRAY['GIT_TOKEN', 'GIT_USER', 'GIT_REPO'], true),

('Git Remote Add with Token', 'Add remote with token authentication', 'git',
 'git remote add origin https://[GIT_TOKEN]@github.com/[GIT_USER]/[GIT_REPO].git',
 ARRAY['GIT_TOKEN', 'GIT_USER', 'GIT_REPO'], true),

-- Cloud CLI Commands
('AWS CLI Configure Profile', 'Configure AWS CLI profile', 'cloud',
 'aws configure --profile [AWS_PROFILE] set aws_access_key_id [AWS_ACCESS_KEY] && aws configure --profile [AWS_PROFILE] set aws_secret_access_key [AWS_SECRET_KEY]',
 ARRAY['AWS_PROFILE', 'AWS_ACCESS_KEY', 'AWS_SECRET_KEY'], true),

('GCloud Auth', 'Authenticate with Google Cloud', 'cloud',
 'gcloud auth activate-service-account --key-file=[GCP_KEY_FILE]',
 ARRAY['GCP_KEY_FILE'], true),

-- API Testing Commands
('cURL API Request', 'Make authenticated API request', 'api',
 'curl -X [HTTP_METHOD] "[API_URL]" -H "Authorization: Bearer [API_TOKEN]" -H "Content-Type: application/json"',
 ARRAY['HTTP_METHOD', 'API_URL', 'API_TOKEN'], true),

('cURL POST with Data', 'Make POST request with JSON data', 'api',
 'curl -X POST "[API_URL]" -H "Authorization: Bearer [API_TOKEN]" -H "Content-Type: application/json" -d ''{"key": "value"}''',
 ARRAY['API_URL', 'API_TOKEN'], true),

-- Environment Setup
('Export Environment Variables', 'Export multiple environment variables', 'environment',
 'export SUPABASE_URL=[SUPABASE_URL] && export SUPABASE_ANON_KEY=[SUPABASE_ANON_KEY] && export SUPABASE_SERVICE_KEY=[SUPABASE_SERVICE_KEY]',
 ARRAY['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'], true),

('NPM Registry Login', 'Login to private NPM registry', 'environment',
 'npm login --registry=[NPM_REGISTRY] --scope=@[NPM_SCOPE]',
 ARRAY['NPM_REGISTRY', 'NPM_SCOPE'], true),

-- Self-hosted Supabase
('Self-hosted Supabase PSQL', 'Connect to self-hosted Supabase PostgreSQL', 'supabase-selfhost',
 'psql -h [SUPABASE_HOST] -p [DB_PORT] -d postgres -U postgres',
 ARRAY['SUPABASE_HOST', 'DB_PORT'], true),

('Self-hosted Supabase Connection String', 'Full connection string for self-hosted Supabase', 'supabase-selfhost',
 'postgresql://postgres:[DB_PASSWORD]@[SUPABASE_HOST]:[DB_PORT]/postgres',
 ARRAY['DB_PASSWORD', 'SUPABASE_HOST', 'DB_PORT'], true)

ON CONFLICT DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE public.vault_command_templates IS 'Stores command templates with placeholder support for the Command Builder feature';
COMMENT ON COLUMN public.vault_command_templates.placeholders IS 'Array of placeholder keys used in this template (e.g., SUPABASE_PROJECT_REF)';
COMMENT ON COLUMN public.secure_vault_items.placeholder_key IS 'Unique key used to reference this secret in command templates (e.g., SUPABASE_PROJECT_REF)';
