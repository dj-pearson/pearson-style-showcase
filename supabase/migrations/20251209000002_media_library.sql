-- Migration: Add media library for centralized asset management
-- Provides a reusable media browser for images, videos, and other assets

-- Create media_assets table
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- File information
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    file_extension TEXT,
    -- Dimensions (for images/videos)
    width INTEGER,
    height INTEGER,
    duration_seconds NUMERIC, -- For video/audio
    -- Metadata
    title TEXT,
    alt_text TEXT,
    description TEXT,
    caption TEXT,
    -- Categorization
    folder TEXT DEFAULT 'uploads',
    tags TEXT[] DEFAULT '{}',
    -- Processing status
    processing_status TEXT DEFAULT 'complete', -- 'pending', 'processing', 'complete', 'failed'
    -- Optimized versions
    thumbnail_url TEXT,
    blur_placeholder TEXT,
    variants JSONB DEFAULT '[]'::jsonb, -- Array of {width, url, size}
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    -- Ownership
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    -- Public URL cache
    public_url TEXT,
    -- Search vector for full-text search
    search_vector tsvector
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_folder ON public.media_assets(folder);
CREATE INDEX IF NOT EXISTS idx_media_assets_mime_type ON public.media_assets(mime_type);
CREATE INDEX IF NOT EXISTS idx_media_assets_tags ON public.media_assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by ON public.media_assets(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON public.media_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_deleted_at ON public.media_assets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_search ON public.media_assets USING GIN(search_vector);

-- Create media_folders table
CREATE TABLE IF NOT EXISTS public.media_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    parent_id UUID REFERENCES public.media_folders(id) ON DELETE CASCADE,
    description TEXT,
    color TEXT DEFAULT '#6366f1', -- For UI display
    icon TEXT DEFAULT 'folder', -- Icon name
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_folder_slug_parent UNIQUE (slug, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_media_folders_parent ON public.media_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_media_folders_slug ON public.media_folders(slug);

-- Enable Row Level Security
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for media_assets
CREATE POLICY "Authenticated users can view non-deleted media"
    ON public.media_assets
    FOR SELECT
    TO authenticated
    USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can insert media"
    ON public.media_assets
    FOR INSERT
    TO authenticated
    WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update their own media or admins can update any"
    ON public.media_assets
    FOR UPDATE
    TO authenticated
    USING (
        uploaded_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.admin_whitelist
            WHERE email = auth.jwt() ->> 'email'
            AND is_active = true
        )
    );

CREATE POLICY "Users can delete their own media or admins can delete any"
    ON public.media_assets
    FOR DELETE
    TO authenticated
    USING (
        uploaded_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.admin_whitelist
            WHERE email = auth.jwt() ->> 'email'
            AND is_active = true
        )
    );

-- RLS Policies for media_folders
CREATE POLICY "Authenticated users can view folders"
    ON public.media_folders
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can manage folders"
    ON public.media_folders
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_media_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.alt_text, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.original_name, '')), 'D') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update search vector on insert/update
DROP TRIGGER IF EXISTS media_search_vector_trigger ON public.media_assets;
CREATE TRIGGER media_search_vector_trigger
    BEFORE INSERT OR UPDATE ON public.media_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_media_search_vector();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS media_updated_at_trigger ON public.media_assets;
CREATE TRIGGER media_updated_at_trigger
    BEFORE UPDATE ON public.media_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_media_updated_at();

DROP TRIGGER IF EXISTS folder_updated_at_trigger ON public.media_folders;
CREATE TRIGGER folder_updated_at_trigger
    BEFORE UPDATE ON public.media_folders
    FOR EACH ROW
    EXECUTE FUNCTION update_media_updated_at();

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_media_usage(_media_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.media_assets
    SET
        usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = _media_id;
END;
$$;

-- Function to search media with full-text search
CREATE OR REPLACE FUNCTION search_media(
    _query TEXT,
    _folder TEXT DEFAULT NULL,
    _mime_type TEXT DEFAULT NULL,
    _limit INTEGER DEFAULT 50,
    _offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    file_name TEXT,
    original_name TEXT,
    file_path TEXT,
    file_size INTEGER,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    title TEXT,
    alt_text TEXT,
    folder TEXT,
    tags TEXT[],
    thumbnail_url TEXT,
    public_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.file_name,
        m.original_name,
        m.file_path,
        m.file_size,
        m.mime_type,
        m.width,
        m.height,
        m.title,
        m.alt_text,
        m.folder,
        m.tags,
        m.thumbnail_url,
        m.public_url,
        m.created_at,
        ts_rank(m.search_vector, plainto_tsquery('english', _query)) as rank
    FROM public.media_assets m
    WHERE m.deleted_at IS NULL
    AND (
        _query IS NULL OR _query = '' OR
        m.search_vector @@ plainto_tsquery('english', _query) OR
        m.original_name ILIKE '%' || _query || '%'
    )
    AND (_folder IS NULL OR m.folder = _folder)
    AND (_mime_type IS NULL OR m.mime_type LIKE _mime_type || '%')
    ORDER BY
        CASE WHEN _query IS NOT NULL AND _query != ''
             THEN ts_rank(m.search_vector, plainto_tsquery('english', _query))
             ELSE 0
        END DESC,
        m.created_at DESC
    LIMIT _limit
    OFFSET _offset;
END;
$$;

-- Function to get folder tree
CREATE OR REPLACE FUNCTION get_folder_tree()
RETURNS TABLE(
    id UUID,
    name TEXT,
    slug TEXT,
    parent_id UUID,
    description TEXT,
    color TEXT,
    icon TEXT,
    depth INTEGER,
    path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE folder_tree AS (
        -- Base case: root folders
        SELECT
            f.id,
            f.name,
            f.slug,
            f.parent_id,
            f.description,
            f.color,
            f.icon,
            0 as depth,
            f.slug::TEXT as path
        FROM public.media_folders f
        WHERE f.parent_id IS NULL

        UNION ALL

        -- Recursive case: child folders
        SELECT
            f.id,
            f.name,
            f.slug,
            f.parent_id,
            f.description,
            f.color,
            f.icon,
            ft.depth + 1,
            ft.path || '/' || f.slug
        FROM public.media_folders f
        INNER JOIN folder_tree ft ON f.parent_id = ft.id
    )
    SELECT * FROM folder_tree
    ORDER BY path;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_media_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_media(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_folder_tree() TO authenticated;

-- Add comments
COMMENT ON TABLE public.media_assets IS 'Centralized media library for reusable assets';
COMMENT ON TABLE public.media_folders IS 'Folder structure for organizing media assets';

-- Insert default folders
INSERT INTO public.media_folders (name, slug, description, color, icon)
VALUES
    ('Images', 'images', 'General image uploads', '#22c55e', 'image'),
    ('Documents', 'documents', 'PDF and document files', '#3b82f6', 'file-text'),
    ('Videos', 'videos', 'Video content', '#ef4444', 'video'),
    ('Articles', 'articles', 'Article featured images', '#8b5cf6', 'newspaper'),
    ('Projects', 'projects', 'Project screenshots and media', '#f59e0b', 'briefcase')
ON CONFLICT (slug, parent_id) DO NOTHING;
