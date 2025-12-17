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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ImageMagick, initialize, MagickFormat } from "https://deno.land/x/imagemagick_deno@0.0.25/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://danpearson.net",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    case 'webp': return 'image/webp';
    case 'avif': return 'image/avif';
    case 'png': return 'image/png';
    default: return 'image/jpeg';
  }
}

// Get MagickFormat for format string
function getMagickFormat(format: string): MagickFormat {
  switch (format) {
    case 'webp': return MagickFormat.Webp;
    case 'avif': return MagickFormat.Avif;
    case 'png': return MagickFormat.Png;
    default: return MagickFormat.Jpeg;
  }
}

// Get file extension
function getExtension(format: string): string {
  switch (format) {
    case 'webp': return 'webp';
    case 'avif': return 'avif';
    case 'png': return 'png';
    default: return 'jpg';
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize ImageMagick
    await initializeMagick();

    // Parse request
    const body: OptimizeRequest = await req.json();
    const {
      sourcePath,
      bucket = 'admin-uploads',
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 85,
      format = 'webp',
      generateVariants = false,
      variantWidths = [640, 768, 1024, 1280],
      destinationPath,
    } = body;

    if (!sourcePath) {
      return new Response(
        JSON.stringify({ error: 'sourcePath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the source image
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(sourcePath);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download source image' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sourceBuffer = new Uint8Array(await fileData.arrayBuffer());
    const sourceSize = sourceBuffer.length;

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
          console.error('Upload error:', uploadError);
          throw new Error('Failed to upload optimized image');
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(optimizedPath);

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
              console.error('Variant upload error:', uploadError);
              return;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
              .from(bucket)
              .getPublicUrl(variantPath);

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

    console.log('Image optimized:', {
      original: `${results.original.width}x${results.original.height} (${sourceSize} bytes)`,
      optimized: `${results.optimized.width}x${results.optimized.height} (${results.optimized.size} bytes)`,
      savings: `${results.savings.percentage}%`,
      variants: results.variants?.length || 0,
    };

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Optimization error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to optimize image', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
