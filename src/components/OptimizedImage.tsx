import { useState, useEffect, useRef } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean; // Set to true for above-the-fold images
  placeholder?: string;
  quality?: number; // 1-100 for image quality
  sizes?: string; // Responsive sizes attribute
  blurDataURL?: string; // Base64 blur placeholder
}

/**
 * OptimizedImage - Enhanced lazy loading with WebP support and responsive images
 * Features:
 * - Intersection Observer for efficient lazy loading
 * - WebP format support with fallbacks
 * - Responsive srcset for different screen sizes
 * - Blur-up placeholder technique
 * - Error handling with fallback images
 */
export const OptimizedImage = ({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  placeholder = '/placeholder.svg',
  quality = 75,
  sizes,
  blurDataURL,
}: OptimizedImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority); // Priority images load immediately
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Skip intersection observer for priority images
    if (priority) return;

    // Check if Intersection Observer is supported
    if (!('IntersectionObserver' in window)) {
      setIsInView(true); // Fallback: load immediately if not supported
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect(); // Stop observing once loaded
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before image enters viewport
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true); // Still mark as loaded to remove spinner
  };

  // Generate responsive srcset if width is provided
  const generateSrcSet = (originalSrc: string): string => {
    if (!width) return '';

    const widths = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
    const srcset = widths
      .filter(w => w <= width * 2) // Only include sizes up to 2x original
      .map(w => {
        // For external URLs or if not using a CDN, just use original
        if (originalSrc.startsWith('http')) {
          return `${originalSrc} ${w}w`;
        }
        // For local images, could add CDN URL transformation here
        return `${originalSrc} ${w}w`;
      })
      .join(', ');

    return srcset;
  };

  // Check if browser supports WebP
  const supportsWebP = () => {
    if (typeof window === 'undefined') return false;

    const elem = document.createElement('canvas');
    if (elem.getContext && elem.getContext('2d')) {
      return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    return false;
  };

  // Generate WebP source if supported and not already WebP
  const getWebPSource = (originalSrc: string): string => {
    if (originalSrc.endsWith('.webp')) return originalSrc;

    // For external URLs or CDNs, you might add WebP conversion here
    // Example: return originalSrc.replace(/\.(jpg|jpeg|png)$/, '.webp');
    return originalSrc;
  };

  const srcSet = generateSrcSet(src);
  const webpSrc = supportsWebP() ? getWebPSource(src) : src;

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: width && height ? `${width} / ${height}` : undefined }}
    >
      {/* Blur placeholder */}
      {!isLoaded && blurDataURL && (
        <img
          src={blurDataURL}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110"
        />
      )}

      {/* Loading placeholder */}
      {!isLoaded && !blurDataURL && (
        <div className="absolute inset-0 bg-muted/30 animate-pulse" />
      )}

      {/* Actual image - only render when in view or priority */}
      {isInView && (
        <picture>
          {/* WebP source if browser supports it */}
          {supportsWebP() && !src.endsWith('.webp') && (
            <source
              type="image/webp"
              srcSet={srcSet || webpSrc}
              sizes={sizes}
            />
          )}

          {/* Fallback image */}
          <img
            src={hasError ? placeholder : src}
            alt={alt}
            width={width}
            height={height}
            srcSet={srcSet}
            sizes={sizes}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handleLoad}
            onError={handleError}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            // Provide aspect ratio hint to prevent layout shift
            style={{
              aspectRatio: width && height ? `${width} / ${height}` : undefined,
            }}
          />
        </picture>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <p className="text-xs text-muted-foreground">Failed to load image</p>
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;
