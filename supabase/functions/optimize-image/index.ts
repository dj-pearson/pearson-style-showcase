/**
 * Image Optimization Edge Function
 *
 * Processes uploaded images to optimize for web delivery:
 * - Resize to specified dimensions
 * - Compress with quality settings
 * - Convert to WebP/AVIF format
 * - Generate responsive variants
 * - Store optimized versions in Supabase Storage
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import {
  ImageMagick,
  initialize,
  MagickFormat,
} from 'https://deno.land/x/imagemagick_deno@0.0.25/mod.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import { createEdgeFunctionLogger } from '../_shared/production-logger.ts';
import { readImageHeader } from './image-dimensions.ts';

const baseLogger = createEdgeFunctionLogger('optimize-image');

/**
 * Caps checked before ImageMagick sees the file. Every function shares one
 * Deno process, and the wasm decoder allocates the whole bitmap (about 8 bytes
 * per pixel at Q16), so one oversized image could exhaust the container for
 * every other function. 25 MP is roughly a 6000 x 4000 photo.
 */
const MAX_SOURCE_BYTES = Number(Deno.env.get('OPTIMIZE_IMAGE_MAX_BYTES')) || 25 * 1024 * 1024;
const MAX_SOURCE_PIXELS = Number(Deno.env.get('OPTIMIZE_IMAGE_MAX_PIXELS')) || 25_000_000;
const MAX_SOURCE_SIDE = 16_384;
const MAX_OUTPUT_SIDE = 4096;
const MAX_VARIANTS = 8;

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

interface OptimizeRequest {
  /** Source file path in storage bucket */
  sourcePath: string;
  /** Storage bucket name */
  bucket?: string;
  /** Maximum width */
  maxWidth?: number;
  /** Maximum height */
  maxHeight?: number;
  /** Quality (1-100) */
  quality?: number;
  /** Output format */
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  /** Generate responsive variants */
  generateVariants?: boolean;
  /** Variant widths */
  variantWidths?: number[];
  /** Destination folder path */
  destinationPath?: string;
}

interface OptimizedResult {
  original: {
    width: number;
    height: number;
    size: number;
    path: string;
  };
  optimized: {
    width: number;
    height: number;
    size: number;
    path: string;
    url: string;
  };
  variants?: Array<{
    width: number;
    size: number;
    path: string;
    url: string;
  }>;
  savings: {
    bytes: number;
    percentage: number;
  };
}

// Initialize ImageMagick
let magickInitialized = false;

async function initializeMagick() {
  if (!magickInitialized) {
    await initialize();
    magickInitialized = true;
  }
}

// Get MIME type for format
function getMimeType(format: string): string {
  switch (format) {
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'png':
      return 'image/png';
    default:
      return 'image/jpeg';
  }
}

// Get MagickFormat for format string
function getMagickFormat(format: string): MagickFormat {
  switch (format) {
    case 'webp':
      return MagickFormat.Webp;
    case 'avif':
      return MagickFormat.Avif;
    case 'png':
      return MagickFormat.Png;
    default:
      return MagickFormat.Jpeg;
  }
}

// Get file extension
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

const handler = async (req: Request): Promise<Response> => {
  // CORS from the shared allow-list (per request; never a wildcard).
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // bucket and sourcePath are caller-supplied and are used against the service
  // role, so any valid JWT could otherwise read or overwrite arbitrary storage
  // objects. Restrict to admins, matching the other service-role functions.
  const auth = await requireAdmin(req, corsHeaders, { allowServiceRole: true });
  if (!auth.ok) return auth.response!;
  const log = baseLogger.forRequest(req);
  const reject = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // Parse request
    const body: OptimizeRequest = await req.json();
    const {
      sourcePath,
      bucket = 'admin-uploads',
      format = 'webp',
      generateVariants = false,
      destinationPath,
    } = body;
    const maxWidth = clampInt(body.maxWidth, 1, MAX_OUTPUT_SIDE, 1920);
    const maxHeight = clampInt(body.maxHeight, 1, MAX_OUTPUT_SIDE, 1080);
    const quality = clampInt(body.quality, 1, 100, 85);
    const variantWidths = (
      Array.isArray(body.variantWidths) ? body.variantWidths : [640, 768, 1024, 1280]
    )
      .slice(0, MAX_VARIANTS)
      .map((w) => clampInt(w, 1, MAX_OUTPUT_SIDE, 0))
      .filter((w) => w > 0);

    if (!sourcePath) {
      return new Response(JSON.stringify({ error: 'sourcePath is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the source image
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(sourcePath);

    if (downloadError || !fileData) {
      log.error('Download error', downloadError);
      return new Response(JSON.stringify({ error: 'Failed to download source image' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (fileData.size > MAX_SOURCE_BYTES) {
      return reject(413, `Source image is larger than ${MAX_SOURCE_BYTES} bytes`);
    }

    const sourceBuffer = new Uint8Array(await fileData.arrayBuffer());
    const sourceSize = sourceBuffer.length;

    // Check the declared dimensions from the header before any decode.
    const header = readImageHeader(sourceBuffer);
    if (!header) {
      return reject(415, 'Unsupported image format. Send PNG, JPEG, GIF or WebP.');
    }
    if (
      header.width < 1 ||
      header.height < 1 ||
      header.width > MAX_SOURCE_SIDE ||
      header.height > MAX_SOURCE_SIDE ||
      header.width * header.height > MAX_SOURCE_PIXELS
    ) {
      log.warn('Rejected oversized image', {
        width: header.width,
        height: header.height,
        format: header.format,
      });
      return reject(
        413,
        `Image is ${header.width}x${header.height}; the limit is ${MAX_SOURCE_PIXELS} pixels and ${MAX_SOURCE_SIDE}px per side`
      );
    }

    await initializeMagick();

    // Process the image with ImageMagick
    const results: OptimizedResult = {
      original: {
        width: 0,
        height: 0,
        size: sourceSize,
        path: sourcePath,
      },
      optimized: {
        width: 0,
        height: 0,
        size: 0,
        path: '',
        url: '',
      },
      savings: {
        bytes: 0,
        percentage: 0,
      },
    };

    // Generate base filename
    const sourceFileName = sourcePath.split('/').pop() || 'image';
    const baseName = sourceFileName.replace(/\.[^.]+$/, '');
    const destFolder = destinationPath || sourcePath.replace(/\/[^/]+$/, '/optimized');
    const extension = getExtension(format);

    // Process main image
    await ImageMagick.read(sourceBuffer, async (image) => {
      // Store original dimensions
      results.original.width = image.width;
      results.original.height = image.height;

      // Calculate new dimensions maintaining aspect ratio
      let newWidth = image.width;
      let newHeight = image.height;

      if (newWidth > maxWidth) {
        newHeight = Math.round((newHeight * maxWidth) / newWidth);
        newWidth = maxWidth;
      }

      if (newHeight > maxHeight) {
        newWidth = Math.round((newWidth * maxHeight) / newHeight);
        newHeight = maxHeight;
      }

      // Resize the image
      image.resize(newWidth, newHeight);

      // Set quality
      image.quality = quality;

      // Convert to output format
      const outputFormat = getMagickFormat(format);

      await image.write(outputFormat, async (data: Uint8Array) => {
        const optimizedFileName = `${baseName}_${newWidth}x${newHeight}.${extension}`;
        const optimizedPath = `${destFolder}/${optimizedFileName}`;

        // Upload optimized image
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(optimizedPath, data, {
            contentType: getMimeType(format),
            upsert: true,
          });

        if (uploadError) {
          log.error('Upload error', uploadError);
          throw new Error('Failed to upload optimized image');
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(optimizedPath);

        results.optimized = {
          width: newWidth,
          height: newHeight,
          size: data.length,
          path: optimizedPath,
          url: urlData.publicUrl,
        };
      });
    });

    // Generate variants if requested
    if (generateVariants) {
      results.variants = [];

      for (const targetWidth of variantWidths) {
        // Skip if larger than optimized size
        if (targetWidth >= results.optimized.width) continue;

        await ImageMagick.read(sourceBuffer, async (image) => {
          // Calculate height maintaining aspect ratio
          const aspectRatio = image.height / image.width;
          const targetHeight = Math.round(targetWidth * aspectRatio);

          // Resize
          image.resize(targetWidth, targetHeight);
          image.quality = quality;

          const outputFormat = getMagickFormat(format);

          await image.write(outputFormat, async (data: Uint8Array) => {
            const variantFileName = `${baseName}_${targetWidth}w.${extension}`;
            const variantPath = `${destFolder}/${variantFileName}`;

            // Upload variant
            const { error: uploadError } = await supabase.storage
              .from(bucket)
              .upload(variantPath, data, {
                contentType: getMimeType(format),
                upsert: true,
              });

            if (uploadError) {
              log.error('Variant upload error', uploadError);
              return;
            }

            // Get public URL
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(variantPath);

            results.variants!.push({
              width: targetWidth,
              size: data.length,
              path: variantPath,
              url: urlData.publicUrl,
            });
          });
        });
      }

      // Sort variants by width
      results.variants.sort((a, b) => a.width - b.width);
    }

    // Calculate savings
    results.savings = {
      bytes: sourceSize - results.optimized.size,
      percentage: Math.round(((sourceSize - results.optimized.size) / sourceSize) * 100),
    };

    log.info('Image optimized', {
      original: `${results.original.width}x${results.original.height} (${sourceSize} bytes)`,
      optimized: `${results.optimized.width}x${results.optimized.height} (${results.optimized.size} bytes)`,
      savings_pct: results.savings.percentage,
      variants: results.variants?.length || 0,
    });

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('Optimization error', error);
    return new Response(JSON.stringify({ error: 'Failed to optimize image' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

export default handler;
