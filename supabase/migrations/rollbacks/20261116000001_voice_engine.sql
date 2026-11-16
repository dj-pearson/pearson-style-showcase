-- Rollback for 20261116000001_voice_engine.sql.
-- Drops every voice_ table and the storage policies. Destructive: the Story
-- Bank, post history and webhook URLs go with it. Objects already uploaded to
-- the voice-media bucket are left in place (delete the bucket by hand if wanted;
-- Supabase refuses to drop a bucket that still holds objects).

BEGIN;

DROP POLICY IF EXISTS "Admins can upload voice-media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update voice-media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete voice-media" ON storage.objects;

DROP TABLE IF EXISTS public.voice_webhook_log;
DROP TABLE IF EXISTS public.voice_webhook_targets;
DROP TABLE IF EXISTS public.voice_posts;
DROP TABLE IF EXISTS public.voice_topics;
DROP TABLE IF EXISTS public.voice_assets;
DROP TABLE IF EXISTS public.voice_source_items;
DROP TABLE IF EXISTS public.voice_stories;
DROP TABLE IF EXISTS public.voice_tracks;

COMMIT;
