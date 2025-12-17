/**
 * Media Library Service
 *
 * Provides CRUD operations for media assets in the centralized media library.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
  optimizeImage,
  createThumbnail,
  createBlurPlaceholder,
  formatBytes,
} from '@/lib/image-optimization';

// Types
export interface MediaAsset {
  id: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  file_extension: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  title: string | null;
  alt_text: string | null;
  description: string | null;
  caption: string | null;
  folder: string;
  tags: string[];
  processing_status: 'pending' | 'processing' | 'complete' | 'failed';
  thumbnail_url: string | null;
  blur_placeholder: string | null;
  variants: MediaVariant[];
  usage_count: number;
  last_used_at: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  public_url: string | null;
}

export interface MediaVariant {
  width: number;
  url: string;
  size: number;
}

export interface MediaFolder {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  color: string;
  icon: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  depth?: number;
  path?: string;
}

export interface UploadMediaOptions {
  folder?: string;
  title?: string;
  altText?: string;
  description?: string;
  tags?: string[];
  optimize?: boolean;
  generateThumbnail?: boolean;
}

export interface MediaSearchOptions {
  query?: string;
  folder?: string;
  mimeType?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'file_name' | 'file_size' | 'usage_count';
  sortOrder?: 'asc' | 'desc';
}

export interface MediaSearchResult {
  assets: MediaAsset[];
  total: number;
  hasMore: boolean;
}

// Constants
const BUCKET_NAME = 'admin-uploads';
const DEFAULT_FOLDER = 'uploads';

// ============================================
// Media Asset Operations
// ============================================

/**
 * Upload a file to the media library
 */
export async function uploadMedia(
  file: File,
  options: UploadMediaOptions = {}
): Promise<MediaAsset | null> {
  const {
    folder = DEFAULT_FOLDER,
    title,
    altText,
    description,
    tags = [],
    optimize = true,
    generateThumbnail = true,
  } = options;

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    let fileToUpload = file;
    let optimizedData: {
      width: number;
      height: number;
      blurPlaceholder?: string;
    } | null = null;

    // Optimize image if applicable
    if (optimize && file.type.startsWith('image/')) {
      try {
        const optimized = await optimizeImage(file, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.85,
          format: 'webp',
        });

        fileToUpload = new File([optimized.blob], optimized.fileName, {
          type: optimized.mimeType,
        });

        optimizedData = {
          width: optimized.width,
          height: optimized.height,
        };

        // Generate blur placeholder
        try {
          optimizedData.blurPlaceholder = await createBlurPlaceholder(file);
        } catch {
          logger.warn('Failed to generate blur placeholder');
        }
      } catch (error) {
        logger.warn('Optimization failed, using original file:', error);
      }
    }

    // Generate unique file path
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = fileToUpload.name.split('.').pop() || '';
    const fileName = `${timestamp}_${randomStr}.${extension}`;
    const filePath = `media/${folder}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileToUpload, {
        contentType: fileToUpload.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Generate thumbnail
    let thumbnailUrl: string | null = null;
    if (generateThumbnail && file.type.startsWith('image/')) {
      try {
        const thumbnail = await createThumbnail(file, 200);
        const thumbPath = `media/${folder}/thumbs/${fileName}`;

        const { error: thumbError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(thumbPath, thumbnail, {
            contentType: 'image/webp',
            upsert: false,
          });

        if (!thumbError) {
          const { data: thumbUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(thumbPath);
          thumbnailUrl = thumbUrlData.publicUrl;
        }
      } catch (error) {
        logger.warn('Thumbnail generation failed:', error);
      }
    }

    // Create media asset record
    const assetData = {
      file_name: fileName,
      original_name: file.name,
      file_path: filePath,
      file_size: fileToUpload.size,
      mime_type: fileToUpload.type,
      file_extension: extension,
      width: optimizedData?.width || null,
      height: optimizedData?.height || null,
      title: title || null,
      alt_text: altText || null,
      description: description || null,
      folder,
      tags,
      processing_status: 'complete',
      thumbnail_url: thumbnailUrl,
      blur_placeholder: optimizedData?.blurPlaceholder || null,
      public_url: urlData.publicUrl,
      uploaded_by: user.id,
    };

    const { data: asset, error: insertError } = await supabase
      .from('media_assets')
      .insert(assetData)
      .select()
      .single();

    if (insertError) {
      // Clean up uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      throw insertError;
    }

    logger.log('Media uploaded:', {
      id: asset.id,
      name: file.name,
      size: formatBytes(file.size),
      optimizedSize: formatBytes(fileToUpload.size),
    });

    return asset as MediaAsset;
  } catch (error) {
    logger.error('Media upload failed:', error);
    return null;
  }
}

/**
 * Get a media asset by ID
 */
export async function getMedia(id: string): Promise<MediaAsset | null> {
  try {
    const { data, error } = await supabase
      .from('media_assets')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    return data as MediaAsset;
  } catch (error) {
    logger.error('Failed to get media:', error);
    return null;
  }
}

/**
 * Search and list media assets
 */
export async function searchMedia(
  options: MediaSearchOptions = {}
): Promise<MediaSearchResult> {
  const {
    query,
    folder,
    mimeType,
    tags,
    limit = 50,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  try {
    // If query provided, use full-text search function
    if (query && query.trim()) {
      const { data, error } = await supabase.rpc('search_media', {
        _query: query,
        _folder: folder || null,
        _mime_type: mimeType || null,
        _limit: limit + 1, // Fetch one extra to check if there's more
        _offset: offset,
      });

      if (error) throw error;

      const assets = (data || []) as MediaAsset[];
      const hasMore = assets.length > limit;
      if (hasMore) assets.pop();

      return {
        assets,
        total: -1, // Search doesn't return total count
        hasMore,
      };
    }

    // Build query
    let queryBuilder = supabase
      .from('media_assets')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (folder) {
      queryBuilder = queryBuilder.eq('folder', folder);
    }

    if (mimeType) {
      queryBuilder = queryBuilder.like('mime_type', `${mimeType}%`);
    }

    if (tags && tags.length > 0) {
      queryBuilder = queryBuilder.overlaps('tags', tags);
    }

    queryBuilder = queryBuilder
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await queryBuilder;

    if (error) throw error;

    return {
      assets: (data || []) as MediaAsset[],
      total: count || 0,
      hasMore: count ? offset + limit < count : false,
    };
  } catch (error) {
    logger.error('Media search failed:', error);
    return { assets: [], total: 0, hasMore: false };
  }
}

/**
 * Update media asset metadata
 */
export async function updateMedia(
  id: string,
  updates: Partial<Pick<MediaAsset, 'title' | 'alt_text' | 'description' | 'caption' | 'folder' | 'tags'>>
): Promise<MediaAsset | null> {
  try {
    const { data, error } = await supabase
      .from('media_assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as MediaAsset;
  } catch (error) {
    logger.error('Failed to update media:', error);
    return null;
  }
}

/**
 * Delete media asset (soft delete)
 */
export async function deleteMedia(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('media_assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Failed to delete media:', error);
    return false;
  }
}

/**
 * Permanently delete media asset and file
 */
export async function permanentlyDeleteMedia(id: string): Promise<boolean> {
  try {
    // Get the asset first to get the file path
    const { data: asset, error: fetchError } = await supabase
      .from('media_assets')
      .select('file_path, thumbnail_url')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const filesToDelete = [asset.file_path];
    if (asset.thumbnail_url) {
      // Extract path from URL
      const thumbPath = asset.thumbnail_url.split(`${BUCKET_NAME}/`)[1];
      if (thumbPath) filesToDelete.push(thumbPath);
    }

    await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);

    // Delete database record
    const { error: deleteError } = await supabase
      .from('media_assets')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    return true;
  } catch (error) {
    logger.error('Failed to permanently delete media:', error);
    return false;
  }
}

/**
 * Increment usage count for a media asset
 */
export async function incrementUsage(id: string): Promise<void> {
  try {
    await supabase.rpc('increment_media_usage', { _media_id: id });
  } catch (error) {
    logger.warn('Failed to increment media usage:', error);
  }
}

// ============================================
// Folder Operations
// ============================================

/**
 * Get folder tree
 */
export async function getFolderTree(): Promise<MediaFolder[]> {
  try {
    const { data, error } = await supabase.rpc('get_folder_tree');
    if (error) throw error;
    return (data || []) as MediaFolder[];
  } catch (error) {
    logger.error('Failed to get folder tree:', error);
    return [];
  }
}

/**
 * Get all folders (flat list)
 */
export async function getFolders(): Promise<MediaFolder[]> {
  try {
    const { data, error } = await supabase
      .from('media_folders')
      .select('*')
      .order('name');

    if (error) throw error;
    return (data || []) as MediaFolder[];
  } catch (error) {
    logger.error('Failed to get folders:', error);
    return [];
  }
}

/**
 * Create a new folder
 */
export async function createFolder(
  name: string,
  options: { parentId?: string; description?: string; color?: string; icon?: string } = {}
): Promise<MediaFolder | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const { data, error } = await supabase
      .from('media_folders')
      .insert({
        name,
        slug,
        parent_id: options.parentId || null,
        description: options.description || null,
        color: options.color || '#6366f1',
        icon: options.icon || 'folder',
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as MediaFolder;
  } catch (error) {
    logger.error('Failed to create folder:', error);
    return null;
  }
}

/**
 * Update a folder
 */
export async function updateFolder(
  id: string,
  updates: Partial<Pick<MediaFolder, 'name' | 'description' | 'color' | 'icon'>>
): Promise<MediaFolder | null> {
  try {
    const updateData: Record<string, unknown> = { ...updates };

    // Update slug if name changed
    if (updates.name) {
      updateData.slug = updates.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    const { data, error } = await supabase
      .from('media_folders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as MediaFolder;
  } catch (error) {
    logger.error('Failed to update folder:', error);
    return null;
  }
}

/**
 * Delete a folder
 */
export async function deleteFolder(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('media_folders')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Failed to delete folder:', error);
    return false;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get media type from MIME type
 */
export function getMediaType(mimeType: string): 'image' | 'video' | 'audio' | 'document' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('document') ||
    mimeType.includes('text/')
  ) {
    return 'document';
  }
  return 'other';
}

/**
 * Get icon name for media type
 */
export function getMediaIcon(mimeType: string): string {
  const type = getMediaType(mimeType);
  switch (type) {
    case 'image': return 'image';
    case 'video': return 'video';
    case 'audio': return 'music';
    case 'document': return 'file-text';
    default: return 'file';
  }
}

/**
 * Format file size
 */
export { formatBytes };
