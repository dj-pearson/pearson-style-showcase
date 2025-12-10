import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVideoLazyLoadOptions {
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection */
  threshold?: number;
  /** Skip lazy loading (priority mode) */
  priority?: boolean;
  /** Preload strategy when in view */
  preloadStrategy?: 'none' | 'metadata' | 'auto';
}

interface UseVideoLazyLoadReturn {
  /** Ref to attach to the container element */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Ref to attach to the video element */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Whether the video is in view */
  isInView: boolean;
  /** Whether the video has started loading */
  isLoading: boolean;
  /** Whether the video is ready to play */
  isReady: boolean;
  /** Whether the video has an error */
  hasError: boolean;
  /** Error message if any */
  errorMessage: string | null;
  /** Load the video manually */
  loadVideo: () => void;
  /** Current video source (only set when in view) */
  currentSrc: string | null;
}

/**
 * Hook for lazy loading video content with Intersection Observer
 * @param src - Video source URL
 * @param options - Configuration options
 */
export function useVideoLazyLoad(
  src: string,
  options: UseVideoLazyLoadOptions = {}
): UseVideoLazyLoadReturn {
  const {
    rootMargin = '100px',
    threshold = 0.1,
    priority = false,
    preloadStrategy = 'metadata',
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isInView, setIsInView] = useState(priority);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentSrc, setCurrentSrc] = useState<string | null>(priority ? src : null);

  // Intersection Observer
  useEffect(() => {
    if (priority) {
      setIsInView(true);
      setCurrentSrc(src);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            setCurrentSrc(src);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    const element = containerRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
      observer.disconnect();
    };
  }, [src, priority, rootMargin, threshold]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isInView) return;

    const handleLoadStart = () => {
      setIsLoading(true);
      setHasError(false);
      setErrorMessage(null);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      setIsReady(true);
    };

    const handleError = () => {
      setIsLoading(false);
      setIsReady(false);
      setHasError(true);
      setErrorMessage(video.error?.message || 'Failed to load video');
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    // Set preload strategy
    video.preload = preloadStrategy;

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [isInView, preloadStrategy]);

  // Manual load function
  const loadVideo = useCallback(() => {
    setIsInView(true);
    setCurrentSrc(src);

    const video = videoRef.current;
    if (video) {
      video.load();
    }
  }, [src]);

  return {
    containerRef,
    videoRef,
    isInView,
    isLoading,
    isReady,
    hasError,
    errorMessage,
    loadVideo,
    currentSrc,
  };
}

/**
 * Hook to detect if the browser supports specific video formats
 */
export function useVideoFormatSupport(): {
  mp4: boolean;
  webm: boolean;
  ogg: boolean;
  hls: boolean;
} {
  const [support, setSupport] = useState({
    mp4: false,
    webm: false,
    ogg: false,
    hls: false,
  });

  useEffect(() => {
    const video = document.createElement('video');

    setSupport({
      mp4: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
      webm: video.canPlayType('video/webm; codecs="vp8, vorbis"') !== '',
      ogg: video.canPlayType('video/ogg; codecs="theora"') !== '',
      hls: video.canPlayType('application/vnd.apple.mpegurl') !== '',
    });
  }, []);

  return support;
}

/**
 * Hook to get video metadata without fully loading the video
 */
export function useVideoMetadata(src: string | null): {
  duration: number | null;
  width: number | null;
  height: number | null;
  isLoading: boolean;
  error: string | null;
} {
  const [metadata, setMetadata] = useState<{
    duration: number | null;
    width: number | null;
    height: number | null;
    isLoading: boolean;
    error: string | null;
  }>({
    duration: null,
    width: null,
    height: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!src) {
      setMetadata({
        duration: null,
        width: null,
        height: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    setMetadata((prev) => ({ ...prev, isLoading: true, error: null }));

    const video = document.createElement('video');
    video.preload = 'metadata';

    const handleLoadedMetadata = () => {
      setMetadata({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        isLoading: false,
        error: null,
      });
    };

    const handleError = () => {
      setMetadata({
        duration: null,
        width: null,
        height: null,
        isLoading: false,
        error: 'Failed to load video metadata',
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);

    video.src = src;

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
      video.src = '';
    };
  }, [src]);

  return metadata;
}

export default useVideoLazyLoad;
