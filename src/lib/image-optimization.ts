/**
 * Image Optimization Pipeline
 *
 * Provides client-side image optimization including:
 * - Compression
 * - Resizing
 * - Format conversion (WebP, AVIF)
 * - Quality adjustment
 */

import { logger } from './logger';

// Types
export interface ImageOptimizationOptions {
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Quality for lossy formats (0-1) */
  quality?: number;
  /** Output format */
  format?: 'webp' | 'jpeg' | 'png' | 'avif' | 'original';
  /** Whether to maintain aspect ratio */
  maintainAspectRatio?: boolean;
  /** Whether to generate responsive variants */
  generateVariants?: boolean;
  /** Sizes for responsive variants */
  variantSizes?: number[];
}

export interface OptimizedImage {
  /** The optimized blob */
  blob: Blob;
  /** The new file name */
  fileName: string;
  /** Original dimensions */
  originalWidth: number;
  originalHeight: number;
  /** New dimensions */
  width: number;
  height: number;
  /** File size before optimization */
  originalSize: number;
  /** File size after optimization */
  optimizedSize: number;
  /** Compression ratio (original/optimized) */
  compressionRatio: number;
  /** MIME type */
  mimeType: string;
}

export interface ImageVariant {
  width: number;
  blob: Blob;
  fileName: string;
  size: number;
}

export interface OptimizationResult {
  primary: OptimizedImage;
  variants?: ImageVariant[];
}

// Default responsive breakpoints
const DEFAULT_VARIANT_SIZES = [640, 768, 1024, 1280, 1536, 1920];

// Default options
const DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.85,
  format: 'webp',
  maintainAspectRatio: true,
  generateVariants: false,
  variantSizes: DEFAULT_VARIANT_SIZES,
};

/**
 * Check if the browser supports a specific image format
 */
export async function supportsFormat(format: 'webp' | 'avif'): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);

    if (format === 'webp') {
      img.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    } else if (format === 'avif') {
      img.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKBzgABpAQ0AIAAAACAAAAAgAAAAC0';
    }
  });
}

/**
 * Get the best supported format for output
 */
export async function getBestFormat(): Promise<'avif' | 'webp' | 'jpeg'> {
  if (await supportsFormat('avif')) return 'avif';
  if (await supportsFormat('webp')) return 'webp';
  return 'jpeg';
}

/**
 * Load an image from a file
 */
export function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
  maintainAspectRatio = true
): { width: number; height: number } {
  if (!maintainAspectRatio) {
    return { width: maxWidth, height: maxHeight };
  }

  let width = originalWidth;
  let height = originalHeight;

  // Scale down if exceeds max dimensions
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  return { width, height };
}

/**
 * Get MIME type for format
 */
function getMimeType(format: string): string {
  switch (format) {
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'png':
      return 'image/png';
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    default:
      return 'image/jpeg';
  }
}

/**
 * Get file extension for format
 */
function getExtension(format: string): string {
  switch (format) {
    case 'webp':
      return 'webp';
    case 'avif':
      return 'avif';
    case 'png':
      return 'png';
    default:
      return 'jpg';
  }
}

/**
 * Convert image to specified format using canvas
 */
async function convertImage(
  img: HTMLImageElement,
  width: number,
  height: number,
  format: string,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the image
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob
  const mimeType = getMimeType(format);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert image'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Optimize a single image
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Determine output format
  let outputFormat = opts.format;
  if (outputFormat === 'original') {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'png') {
      outputFormat = 'png';
    } else if (ext === 'webp') {
      outputFormat = 'webp';
    } else {
      outputFormat = 'jpeg';
    }
  } else if (outputFormat === 'avif') {
    // Check AVIF support, fallback to WebP
    if (!(await supportsFormat('avif'))) {
      outputFormat = 'webp';
    }
  }

  // Load the image
  const img = await loadImage(file);

  // Calculate dimensions
  const { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxWidth,
    opts.maxHeight,
    opts.maintainAspectRatio
  );

  // Convert the image
  const blob = await convertImage(img, width, height, outputFormat, opts.quality);

  // Generate file name
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const extension = getExtension(outputFormat);
  const fileName = `${baseName}_${width}x${height}.${extension}`;

  const result: OptimizedImage = {
    blob,
    fileName,
    originalWidth: img.naturalWidth,
    originalHeight: img.naturalHeight,
    width,
    height,
    originalSize: file.size,
    optimizedSize: blob.size,
    compressionRatio: file.size / blob.size,
    mimeType: getMimeType(outputFormat),
  };

  logger.log('Image optimized:', {
    original: `${img.naturalWidth}x${img.naturalHeight} (${formatBytes(file.size)})`,
    optimized: `${width}x${height} (${formatBytes(blob.size)})`,
    ratio: `${result.compressionRatio.toFixed(2)}x`,
  });

  return result;
}

/**
 * Optimize an image and generate responsive variants
 */
export async function optimizeWithVariants(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<OptimizationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options, generateVariants: true };

  // Optimize the primary image
  const primary = await optimizeImage(file, opts);

  // Generate variants
  const variants: ImageVariant[] = [];

  // Determine output format
  let outputFormat = opts.format;
  if (outputFormat === 'original' || outputFormat === 'avif') {
    outputFormat = (await supportsFormat('avif')) ? 'avif' : 'webp';
  }

  // Load image once for all variants
  const img = await loadImage(file);

  // Generate each variant size
  for (const targetWidth of opts.variantSizes) {
    // Skip if larger than original or primary
    if (targetWidth >= primary.width) continue;

    // Calculate height maintaining aspect ratio
    const aspectRatio = img.naturalHeight / img.naturalWidth;
    const targetHeight = Math.round(targetWidth * aspectRatio);

    try {
      const blob = await convertImage(img, targetWidth, targetHeight, outputFormat, opts.quality);

      const baseName = file.name.replace(/\.[^.]+$/, '');
      const extension = getExtension(outputFormat);
      const fileName = `${baseName}_${targetWidth}w.${extension}`;

      variants.push({
        width: targetWidth,
        blob,
        fileName,
        size: blob.size,
      });
    } catch (error) {
      logger.warn(`Failed to generate variant at ${targetWidth}px:`, error);
    }
  }

  // Sort variants by width (ascending)
  variants.sort((a, b) => a.width - b.width);

  return {
    primary,
    variants,
  };
}

/**
 * Generate a srcset string from variants
 */
export function generateSrcSet(variants: ImageVariant[], baseUrl: string): string {
  return variants
    .map((v) => `${baseUrl}/${v.fileName} ${v.width}w`)
    .join(', ');
}

/**
 * Generate sizes attribute for responsive images
 */
export function generateSizes(breakpoints?: { [key: string]: string }): string {
  const defaultBreakpoints = {
    '(max-width: 640px)': '100vw',
    '(max-width: 768px)': '90vw',
    '(max-width: 1024px)': '80vw',
    '(max-width: 1280px)': '70vw',
    default: '60vw',
  };

  const bp = breakpoints || defaultBreakpoints;
  const entries = Object.entries(bp);
  const defaultSize = entries.find(([k]) => k === 'default')?.[1] || '100vw';

  return entries
    .filter(([k]) => k !== 'default')
    .map(([media, size]) => `${media} ${size}`)
    .concat([defaultSize])
    .join(', ');
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Get image dimensions without fully loading the image
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Create a thumbnail from an image
 */
export async function createThumbnail(
  file: File,
  size: number = 200
): Promise<Blob> {
  const img = await loadImage(file);
  const aspectRatio = img.naturalWidth / img.naturalHeight;

  let width: number;
  let height: number;

  if (aspectRatio > 1) {
    // Landscape
    width = size;
    height = Math.round(size / aspectRatio);
  } else {
    // Portrait or square
    height = size;
    width = Math.round(size * aspectRatio);
  }

  return convertImage(img, width, height, 'webp', 0.8);
}

/**
 * Create a blur placeholder (tiny image for blur-up effect)
 */
export async function createBlurPlaceholder(file: File): Promise<string> {
  const img = await loadImage(file);
  const aspectRatio = img.naturalWidth / img.naturalHeight;

  // Create a tiny version (10px wide)
  const width = 10;
  const height = Math.round(10 / aspectRatio);

  const blob = await convertImage(img, width, height, 'webp', 0.5);

  // Convert to base64 data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Estimate optimization savings
 */
export async function estimateOptimization(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<{
  estimatedSize: number;
  estimatedSavings: number;
  estimatedRatio: number;
}> {
  // Use sample quality to estimate
  const sampleOptions = { ...options, quality: 0.85 };
  const result = await optimizeImage(file, sampleOptions);

  return {
    estimatedSize: result.optimizedSize,
    estimatedSavings: file.size - result.optimizedSize,
    estimatedRatio: result.compressionRatio,
  };
}
