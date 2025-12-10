/**
 * Image Optimization Hook
 *
 * Provides methods for optimizing images before upload.
 * Supports client-side and server-side optimization.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  optimizeImage,
  optimizeWithVariants,
  createThumbnail,
  createBlurPlaceholder,
  formatBytes,
  isImageFile,
  type ImageOptimizationOptions,
  type OptimizedImage,
  type OptimizationResult,
} from '@/lib/image-optimization';
import { logger } from '@/lib/logger';

interface UseImageOptimizationOptions {
  /** Use server-side optimization (Edge Function) */
  serverSide?: boolean;
  /** Default optimization options */
  defaultOptions?: ImageOptimizationOptions;
  /** Storage bucket for uploads */
  bucket?: string;
}

interface OptimizationProgress {
  status: 'idle' | 'optimizing' | 'uploading' | 'complete' | 'error';
  progress: number;
  message: string;
  originalSize?: number;
  optimizedSize?: number;
  savings?: number;
}

interface UploadResult {
  url: string;
  path: string;
  width: number;
  height: number;
  size: number;
  blurPlaceholder?: string;
  variants?: Array<{
    url: string;
    width: number;
  }>;
}

export function useImageOptimization(options: UseImageOptimizationOptions = {}) {
  const { serverSide = false, defaultOptions = {}, bucket = 'admin-uploads' } = options;

  const [progress, setProgress] = useState<OptimizationProgress>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [error, setError] = useState<string | null>(null);

  /**
   * Optimize an image file (client-side)
   */
  const optimize = useCallback(
    async (
      file: File,
      opts?: ImageOptimizationOptions
    ): Promise<OptimizedImage | null> => {
      if (!isImageFile(file)) {
        setError('File is not an image');
        return null;
      }

      setError(null);
      setProgress({
        status: 'optimizing',
        progress: 0,
        message: 'Optimizing image...',
        originalSize: file.size,
      });

      try {
        const mergedOptions = { ...defaultOptions, ...opts };
        const result = await optimizeImage(file, mergedOptions);

        setProgress({
          status: 'complete',
          progress: 100,
          message: 'Optimization complete',
          originalSize: result.originalSize,
          optimizedSize: result.optimizedSize,
          savings: Math.round(
            ((result.originalSize - result.optimizedSize) / result.originalSize) * 100
          ),
        });

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Optimization failed';
        setError(message);
        setProgress({
          status: 'error',
          progress: 0,
          message,
        });
        return null;
      }
    },
    [defaultOptions]
  );

  /**
   * Optimize and generate responsive variants (client-side)
   */
  const optimizeResponsive = useCallback(
    async (
      file: File,
      opts?: ImageOptimizationOptions
    ): Promise<OptimizationResult | null> => {
      if (!isImageFile(file)) {
        setError('File is not an image');
        return null;
      }

      setError(null);
      setProgress({
        status: 'optimizing',
        progress: 0,
        message: 'Generating responsive images...',
        originalSize: file.size,
      });

      try {
        const mergedOptions = { ...defaultOptions, ...opts, generateVariants: true };
        const result = await optimizeWithVariants(file, mergedOptions);

        setProgress({
          status: 'complete',
          progress: 100,
          message: `Generated ${result.variants?.length || 0} variants`,
          originalSize: result.primary.originalSize,
          optimizedSize: result.primary.optimizedSize,
          savings: Math.round(
            ((result.primary.originalSize - result.primary.optimizedSize) /
              result.primary.originalSize) *
              100
          ),
        });

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Optimization failed';
        setError(message);
        setProgress({
          status: 'error',
          progress: 0,
          message,
        });
        return null;
      }
    },
    [defaultOptions]
  );

  /**
   * Optimize and upload an image
   */
  const optimizeAndUpload = useCallback(
    async (
      file: File,
      uploadPath?: string,
      opts?: ImageOptimizationOptions
    ): Promise<UploadResult | null> => {
      if (!isImageFile(file)) {
        setError('File is not an image');
        return null;
      }

      setError(null);

      try {
        // Step 1: Optimize
        setProgress({
          status: 'optimizing',
          progress: 20,
          message: 'Optimizing image...',
          originalSize: file.size,
        });

        const mergedOptions = { ...defaultOptions, ...opts };
        const optimized = await optimizeImage(file, mergedOptions);

        setProgress((prev) => ({
          ...prev,
          progress: 40,
          message: 'Creating blur placeholder...',
          optimizedSize: optimized.optimizedSize,
        }));

        // Step 2: Create blur placeholder
        let blurPlaceholder: string | undefined;
        try {
          blurPlaceholder = await createBlurPlaceholder(file);
        } catch {
          logger.warn('Failed to create blur placeholder');
        }

        // Step 3: Upload
        setProgress((prev) => ({
          ...prev,
          status: 'uploading',
          progress: 60,
          message: 'Uploading optimized image...',
        }));

        const path = uploadPath || `uploads/${Date.now()}_${optimized.fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, optimized.blob, {
            contentType: optimized.mimeType,
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

        setProgress({
          status: 'complete',
          progress: 100,
          message: 'Upload complete',
          originalSize: optimized.originalSize,
          optimizedSize: optimized.optimizedSize,
          savings: Math.round(
            ((optimized.originalSize - optimized.optimizedSize) /
              optimized.originalSize) *
              100
          ),
        });

        return {
          url: urlData.publicUrl,
          path,
          width: optimized.width,
          height: optimized.height,
          size: optimized.optimizedSize,
          blurPlaceholder,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        setProgress({
          status: 'error',
          progress: 0,
          message,
        });
        return null;
      }
    },
    [bucket, defaultOptions]
  );

  /**
   * Optimize using server-side Edge Function
   */
  const optimizeServerSide = useCallback(
    async (
      sourcePath: string,
      opts?: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
        format?: 'webp' | 'avif' | 'jpeg' | 'png';
        generateVariants?: boolean;
        variantWidths?: number[];
      }
    ): Promise<UploadResult | null> => {
      setError(null);
      setProgress({
        status: 'optimizing',
        progress: 30,
        message: 'Processing on server...',
      });

      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          'optimize-image',
          {
            body: {
              sourcePath,
              bucket,
              ...opts,
            },
          }
        );

        if (invokeError) {
          throw invokeError;
        }

        if (data.error) {
          throw new Error(data.error);
        }

        setProgress({
          status: 'complete',
          progress: 100,
          message: 'Optimization complete',
          originalSize: data.original.size,
          optimizedSize: data.optimized.size,
          savings: data.savings.percentage,
        });

        return {
          url: data.optimized.url,
          path: data.optimized.path,
          width: data.optimized.width,
          height: data.optimized.height,
          size: data.optimized.size,
          variants: data.variants?.map((v: { url: string; width: number }) => ({
            url: v.url,
            width: v.width,
          })),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Server optimization failed';
        setError(message);
        setProgress({
          status: 'error',
          progress: 0,
          message,
        });
        return null;
      }
    },
    [bucket]
  );

  /**
   * Generate a thumbnail
   */
  const generateThumbnail = useCallback(
    async (file: File, size = 200): Promise<Blob | null> => {
      if (!isImageFile(file)) {
        setError('File is not an image');
        return null;
      }

      try {
        return await createThumbnail(file, size);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Thumbnail generation failed';
        setError(message);
        return null;
      }
    },
    []
  );

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setProgress({
      status: 'idle',
      progress: 0,
      message: '',
    });
    setError(null);
  }, []);

  return {
    // State
    progress,
    error,
    isOptimizing: progress.status === 'optimizing',
    isUploading: progress.status === 'uploading',
    isComplete: progress.status === 'complete',

    // Methods
    optimize,
    optimizeResponsive,
    optimizeAndUpload,
    optimizeServerSide,
    generateThumbnail,
    reset,

    // Utilities
    formatBytes,
    isImageFile,
  };
}

export default useImageOptimization;
