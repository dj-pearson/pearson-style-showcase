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
 * OptimizedImage - lazy-loaded image with placeholder and error fallback.
 * - Intersection Observer lazy loading for non-priority images
 * - priority: rendered immediately, eager, fetchpriority="high", no fade
 * - Blur-up / pulse placeholder for lazy images
 * - Error handling with fallback image
 *
 * `quality` and `sizes` are accepted for API compatibility but not emitted:
 * there is no image CDN to produce real width variants, and `sizes` does
 * nothing without a real srcset.
 */
export const OptimizedImage = ({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  placeholder = '/placeholder.svg',
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

  // Priority images (LCP candidates) are painted as soon as the browser has
  // bytes, so they skip the placeholder overlay and the opacity fade.
  const showPlaceholder = !priority && !isLoaded;

  // React 18 does not know the camelCase `fetchPriority` prop and warns on it,
  // so pass the lowercase DOM attribute through instead.
  const priorityAttrs = priority
    ? ({ fetchpriority: 'high' } as Record<string, string>)
    : undefined;

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: width && height ? `${width} / ${height}` : undefined }}
    >
      {/* Blur placeholder */}
      {showPlaceholder && blurDataURL && (
        <img
          src={blurDataURL}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110"
        />
      )}

      {/* Loading placeholder */}
      {showPlaceholder && !blurDataURL && (
        <div className="absolute inset-0 bg-muted/50 animate-pulse" />
      )}

      {/* Actual image - only render when in view or priority */}
      {isInView && (
        <img
          src={hasError ? placeholder : src}
          alt={alt}
          width={width}
          height={height}
          className={
            priority
              ? 'w-full h-full object-cover'
              : `w-full h-full object-cover transition-opacity duration-300 ${
                  isLoaded ? 'opacity-100' : 'opacity-0'
                }`
          }
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? undefined : 'async'}
          {...priorityAttrs}
          // Provide aspect ratio hint to prevent layout shift
          style={{
            aspectRatio: width && height ? `${width} / ${height}` : undefined,
          }}
        />
      )}

      {/* Error overlay - accessible announcement */}
      {hasError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted/50"
          role="alert"
          aria-live="polite"
        >
          <p className="text-xs text-muted-foreground">Failed to load image</p>
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;
