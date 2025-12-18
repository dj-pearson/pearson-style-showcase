-- Migration: Add Coolify Self-Hosted Supabase Commands to Command Builder
-- Adds comprehensive command templates for managing Supabase on Coolify

-- Insert Coolify-specific command templates
INSERT INTO public.vault_command_templates (name, description, category, template, placeholders, is_system) VALUES

-- SSH Connection Commands
('SSH Connect to Server', 'Connect to Coolify server via SSH', 'ssh',
 'ssh root@[SERVER_IP]',
 ARRAY['SERVER_IP'], true),

('SSH Connect with Port', 'Connect to server with specific SSH port', 'ssh',
 'ssh -p [SSH_PORT] root@[SERVER_IP]',
 ARRAY['SSH_PORT', 'SERVER_IP'], true),

-- Container Management
('Docker List All Containers', 'List all running Docker containers', 'docker',
 'docker ps',
 ARRAY[]::text[], true),

('Docker List Supabase Containers', 'Filter and list Supabase-related containers', 'docker',
 'docker ps | grep supabase',
 ARRAY[]::text[], true),

('Docker List All Supabase (Including Stopped)', 'List all Supabase containers including stopped ones', 'docker',
 'docker ps -a | grep supabase',
 ARRAY[]::text[], true),

('Docker Start Container', 'Start a stopped container', 'docker',
 'docker start supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('Docker Stop Container', 'Stop a running container', 'docker',
 'docker stop supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('Docker Restart Container', 'Restart a container', 'docker',
 'docker restart supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('Docker View Container Logs', 'View logs from a container', 'docker',
 'docker logs supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('Docker Follow Logs', 'Follow container logs in real-time', 'docker',
 'docker logs -f supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('Docker Logs Last 100 Lines', 'Show last 100 lines of container logs', 'docker',
 'docker logs --tail 100 supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('Docker Exec Command', 'Execute a command in a running container', 'docker',
 'docker exec -it supabase-db-[SERVICE_ID] [COMMAND]',
 ARRAY['SERVICE_ID', 'COMMAND'], true),

('Docker Get Container IP', 'Get the internal IP address of a container', 'docker',
 'docker inspect -f ''{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'' supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

-- PostgreSQL Access Commands
('PSQL Connect via Docker', 'Connect to PostgreSQL inside Docker container', 'supabase-selfhost',
 'docker exec -it supabase-db-[SERVICE_ID] psql -U postgres',
 ARRAY['SERVICE_ID'], true),

('PSQL Connect from Host', 'Connect to PostgreSQL from host server', 'database',
 'psql -h localhost -p 5432 -U postgres -d postgres',
 ARRAY[]::text[], true),

('PSQL Connect via Socat', 'Connect to PostgreSQL using socat proxy', 'database',
 'psql -h [SERVER_IP] -p 5555 -U postgres -d postgres',
 ARRAY['SERVER_IP'], true),

('PSQL Test Connection', 'Test if PostgreSQL is ready', 'database',
 'docker exec supabase-db-[SERVICE_ID] pg_isready -U postgres',
 ARRAY['SERVICE_ID'], true),

-- Backup and Restore Commands
('Backup Database (Full)', 'Create full database backup with timestamp', 'database',
 'docker exec supabase-db-[SERVICE_ID] pg_dump -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql',
 ARRAY['SERVICE_ID'], true),

('Backup Database (Compressed)', 'Create compressed database backup', 'database',
 'docker exec supabase-db-[SERVICE_ID] pg_dump -U postgres -d postgres | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz',
 ARRAY['SERVICE_ID'], true),

('Backup Database (Custom Format)', 'Create backup in custom format for large databases', 'database',
 'docker exec supabase-db-[SERVICE_ID] pg_dump -U postgres -Fc -d postgres > backup_$(date +%Y%m%d_%H%M%S).dump',
 ARRAY['SERVICE_ID'], true),

('Backup Specific Tables', 'Backup only specific tables', 'database',
 'docker exec supabase-db-[SERVICE_ID] pg_dump -U postgres -d postgres -t [TABLE1] -t [TABLE2] > tables_backup.sql',
 ARRAY['SERVICE_ID', 'TABLE1', 'TABLE2'], true),

('Backup Schema Only', 'Backup database schema without data', 'database',
 'docker exec supabase-db-[SERVICE_ID] pg_dump -U postgres -d postgres --schema-only > schema_backup.sql',
 ARRAY['SERVICE_ID'], true),

('Backup Data Only', 'Backup data without schema', 'database',
 'docker exec supabase-db-[SERVICE_ID] pg_dump -U postgres -d postgres --data-only > data_backup.sql',
 ARRAY['SERVICE_ID'], true),

('Restore Database', 'Restore database from SQL file', 'database',
 'docker exec -i supabase-db-[SERVICE_ID] psql -U postgres -d postgres < backup.sql',
 ARRAY['SERVICE_ID'], true),

('Restore from Compressed', 'Restore database from gzipped backup', 'database',
 'gunzip -c backup.sql.gz | docker exec -i supabase-db-[SERVICE_ID] psql -U postgres -d postgres',
 ARRAY['SERVICE_ID'], true),

('Restore from Custom Format', 'Restore database from custom format backup', 'database',
 'docker exec -i supabase-db-[SERVICE_ID] pg_restore -U postgres -d postgres < backup.dump',
 ARRAY['SERVICE_ID'], true),

('Restore Specific Table', 'Restore only specific table from backup', 'database',
 'docker exec -i supabase-db-[SERVICE_ID] pg_restore -U postgres -d postgres -t [TABLE_NAME] < backup.dump',
 ARRAY['SERVICE_ID', 'TABLE_NAME'], true),

-- File Transfer Commands
('SCP Backup to Local', 'Download backup file to local machine', 'ssh',
 'scp root@[SERVER_IP]:/path/to/backup.sql ./backup.sql',
 ARRAY['SERVER_IP'], true),

('SCP Backup to Server', 'Upload backup file to server', 'ssh',
 'scp ./backup.sql root@[SERVER_IP]:/path/to/backup.sql',
 ARRAY['SERVER_IP'], true),

-- Container Logs for All Services
('View Database Logs', 'View Supabase database container logs', 'supabase-selfhost',
 'docker logs supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('View Auth Logs', 'View Supabase Auth service logs', 'supabase-selfhost',
 'docker logs supabase-auth-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('View Kong Logs', 'View Supabase Kong (API Gateway) logs', 'supabase-selfhost',
 'docker logs supabase-kong-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('View REST API Logs', 'View Supabase REST API logs', 'supabase-selfhost',
 'docker logs supabase-rest-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('View Realtime Logs', 'View Supabase Realtime service logs', 'supabase-selfhost',
 'docker logs supabase-realtime-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('View Storage Logs', 'View Supabase Storage service logs', 'supabase-selfhost',
 'docker logs supabase-storage-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('View Studio Logs', 'View Supabase Studio logs', 'supabase-selfhost',
 'docker logs supabase-studio-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

-- Network Configuration
('Check PostgreSQL Listen Address', 'Check what addresses PostgreSQL is listening on', 'database',
 'docker exec supabase-db-[SERVICE_ID] cat /var/lib/postgresql/data/postgresql.conf | grep listen_addresses',
 ARRAY['SERVICE_ID'], true),

('Check PostgreSQL Port', 'Check what port PostgreSQL is using', 'database',
 'docker exec supabase-db-[SERVICE_ID] cat /proc/net/tcp | awk ''{print $2}'' | cut -d: -f2 | sort -u',
 ARRAY['SERVICE_ID'], true),

('Configure PostgreSQL for External Access', 'Allow external connections to PostgreSQL', 'database',
 'docker exec supabase-db-[SERVICE_ID] sed -i "s/#listen_addresses = ''localhost''/listen_addresses = ''*''/" /var/lib/postgresql/data/postgresql.conf && docker restart supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

-- Socat Proxy Setup
('Install Socat', 'Install socat on the server', 'general',
 'apt-get update && apt-get install -y socat',
 ARRAY[]::text[], true),

('Start Socat Proxy (Foreground)', 'Start socat proxy in foreground', 'general',
 'socat TCP-LISTEN:5555,bind=0.0.0.0,fork,reuseaddr TCP:[INTERNAL_DB_IP]:5432',
 ARRAY['INTERNAL_DB_IP'], true),

('Start Socat Proxy (Background)', 'Start socat proxy as background process', 'general',
 'socat TCP-LISTEN:5555,bind=0.0.0.0,fork,reuseaddr TCP:[INTERNAL_DB_IP]:5432 &',
 ARRAY['INTERNAL_DB_IP'], true),

('Check Socat Running', 'Check if socat process is running', 'general',
 'ps aux | grep socat',
 ARRAY[]::text[], true),

('Kill Socat Process', 'Stop all socat processes', 'general',
 'pkill socat',
 ARRAY[]::text[], true),

-- SSH Tunnel (Alternative to Socat)
('Create SSH Tunnel', 'Create SSH tunnel for database access', 'ssh',
 'ssh -L 5555:[INTERNAL_DB_IP]:5432 root@[SERVER_IP] -N',
 ARRAY['INTERNAL_DB_IP', 'SERVER_IP'], true),

('Create SSH Tunnel with Port', 'Create SSH tunnel with custom PostgreSQL port', 'ssh',
 'ssh -L 5555:[INTERNAL_DB_IP]:[DB_PORT] root@[SERVER_IP] -N',
 ARRAY['INTERNAL_DB_IP', 'DB_PORT', 'SERVER_IP'], true),

-- Docker Network Inspection
('List Docker Networks', 'List all Docker networks on server', 'docker',
 'docker network ls',
 ARRAY[]::text[], true),

('Inspect Docker Network', 'Inspect a specific Docker network', 'docker',
 'docker network inspect [NETWORK_NAME]',
 ARRAY['NETWORK_NAME'], true),

('Find Container Network', 'Find which network a container is connected to', 'docker',
 'docker inspect [CONTAINER_ID] | grep -A 20 "Networks"',
 ARRAY['CONTAINER_ID'], true),

-- Drizzle ORM Commands (Coolify-specific)
('Drizzle Push to Coolify DB', 'Push Drizzle schema to Coolify-hosted database', 'database',
 'npm run db:push',
 ARRAY[]::text[], true),

('Drizzle Generate Migrations', 'Generate Drizzle migration files', 'database',
 'npx drizzle-kit generate',
 ARRAY[]::text[], true),

('Drizzle Apply Migrations', 'Apply Drizzle migrations to database', 'database',
 'npx drizzle-kit migrate',
 ARRAY[]::text[], true),

('Drizzle Pull Schema', 'Pull existing schema from database', 'database',
 'npx drizzle-kit introspect',
 ARRAY[]::text[], true),

('Drizzle Studio', 'Open Drizzle Studio database GUI', 'database',
 'npx drizzle-kit studio',
 ARRAY[]::text[], true),

-- Troubleshooting Commands
('Check Port Connectivity', 'Test if a port is open and accessible', 'general',
 'nc -zv [SERVER_IP] [PORT]',
 ARRAY['SERVER_IP', 'PORT'], true),

('Check UFW Firewall Status', 'Check Ubuntu firewall status', 'general',
 'ufw status',
 ARRAY[]::text[], true),

('Allow Port Through Firewall', 'Allow a port through UFW firewall', 'general',
 'ufw allow [PORT]/tcp',
 ARRAY['PORT'], true),

('Check Disk Space', 'Check available disk space on server', 'general',
 'df -h',
 ARRAY[]::text[], true),

('Check Docker Disk Usage', 'Check Docker disk usage statistics', 'docker',
 'docker system df',
 ARRAY[]::text[], true),

('Docker System Prune', 'Clean up unused Docker resources (CAUTION)', 'docker',
 'docker system prune -a',
 ARRAY[]::text[], true),

-- Database Administration SQL Commands
('Reset Database Schema (DANGER)', 'Drop and recreate public schema - DESTROYS ALL DATA', 'database',
 'docker exec -it supabase-db-[SERVICE_ID] psql -U postgres -d postgres -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"',
 ARRAY['SERVICE_ID'], true),

('Check PostgreSQL Version', 'Check the PostgreSQL version', 'database',
 'docker exec supabase-db-[SERVICE_ID] psql -U postgres -c "SELECT version();"',
 ARRAY['SERVICE_ID'], true),

('Show All PostgreSQL Settings', 'Display all PostgreSQL configuration settings', 'database',
 'docker exec supabase-db-[SERVICE_ID] psql -U postgres -c "SHOW ALL;"',
 ARRAY['SERVICE_ID'], true),

('Show Max Connections', 'Show PostgreSQL max_connections setting', 'database',
 'docker exec supabase-db-[SERVICE_ID] psql -U postgres -c "SHOW max_connections;"',
 ARRAY['SERVICE_ID'], true),

('Show Shared Buffers', 'Show PostgreSQL shared_buffers setting', 'database',
 'docker exec supabase-db-[SERVICE_ID] psql -U postgres -c "SHOW shared_buffers;"',
 ARRAY['SERVICE_ID'], true),

-- Quick Reference Commands (Most Common)
('Quick: Connect to Database', 'Quick command to connect to database via Docker', 'supabase-selfhost',
 'docker exec -it supabase-db-[SERVICE_ID] psql -U postgres',
 ARRAY['SERVICE_ID'], true),

('Quick: Follow Database Logs', 'Quick command to follow database logs', 'supabase-selfhost',
 'docker logs -f supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('Quick: Restart Database', 'Quick command to restart database container', 'supabase-selfhost',
 'docker restart supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('Quick: Create Backup', 'Quick command to create a backup', 'database',
 'docker exec supabase-db-[SERVICE_ID] pg_dump -U postgres -d postgres > backup.sql',
 ARRAY['SERVICE_ID'], true),

('Quick: Get Container IP', 'Quick command to get container internal IP', 'docker',
 'docker inspect -f ''{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'' supabase-db-[SERVICE_ID]',
 ARRAY['SERVICE_ID'], true),

('Quick: Start Socat Proxy', 'Quick command to start socat proxy for external access', 'general',
 'socat TCP-LISTEN:5555,bind=0.0.0.0,fork,reuseaddr TCP:[INTERNAL_DB_IP]:5432 &',
 ARRAY['INTERNAL_DB_IP'], true);

-- Add helpful comments
COMMENT ON TABLE public.vault_command_templates IS 'Command templates for DevOps tasks. Use [PLACEHOLDER_KEY] syntax for variables.';
