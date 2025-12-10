import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LazyVideoProps {
  /** Video source URL */
  src: string;
  /** Poster image to show before video loads */
  poster?: string;
  /** Alt text for accessibility (used with poster image) */
  alt?: string;
  /** Video title for accessibility */
  title?: string;
  /** Additional CSS classes */
  className?: string;
  /** Aspect ratio (default: 16/9) */
  aspectRatio?: number;
  /** Autoplay when in view (default: false) */
  autoPlay?: boolean;
  /** Mute video (default: true for autoplay compatibility) */
  muted?: boolean;
  /** Loop video (default: false) */
  loop?: boolean;
  /** Show controls (default: true) */
  controls?: boolean;
  /** Preload strategy: 'none' | 'metadata' | 'auto' (default: 'none' for lazy loading) */
  preload?: 'none' | 'metadata' | 'auto';
  /** Root margin for intersection observer (default: '100px') */
  rootMargin?: string;
  /** Threshold for intersection (default: 0.1) */
  threshold?: number;
  /** Priority loading - skip lazy loading (default: false) */
  priority?: boolean;
  /** Callback when video starts playing */
  onPlay?: () => void;
  /** Callback when video is paused */
  onPause?: () => void;
  /** Callback when video ends */
  onEnded?: () => void;
  /** Callback when video errors */
  onError?: (error: Error) => void;
  /** Width constraint */
  width?: number;
  /** Height constraint */
  height?: number;
  /** Enable playsinline for mobile (default: true) */
  playsInline?: boolean;
}

interface VideoState {
  isLoaded: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  hasError: boolean;
  errorMessage: string;
  progress: number;
  duration: number;
  currentTime: number;
}

export const LazyVideo: React.FC<LazyVideoProps> = ({
  src,
  poster,
  alt = 'Video content',
  title,
  className,
  aspectRatio = 16 / 9,
  autoPlay = false,
  muted = true,
  loop = false,
  controls = true,
  preload = 'none',
  rootMargin = '100px',
  threshold = 0.1,
  priority = false,
  onPlay,
  onPause,
  onEnded,
  onError,
  width,
  height,
  playsInline = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(priority);
  const [showCustomControls, setShowCustomControls] = useState(false);
  const [state, setState] = useState<VideoState>({
    isLoaded: false,
    isPlaying: false,
    isMuted: muted,
    isFullscreen: false,
    hasError: false,
    errorMessage: '',
    progress: 0,
    duration: 0,
    currentTime: 0,
  });

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            // Stop observing once loaded
            observer.disconnect();
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, rootMargin, threshold]);

  // Handle video loaded
  const handleLoadedData = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setState((prev) => ({
        ...prev,
        isLoaded: true,
        duration: video.duration,
      }));

      // Auto-play if enabled and in view
      if (autoPlay && isInView) {
        video.play().catch(() => {
          // Autoplay might be blocked, user needs to interact
          setState((prev) => ({ ...prev, isPlaying: false }));
        });
      }
    }
  }, [autoPlay, isInView]);

  // Handle video error
  const handleError = useCallback(() => {
    const video = videoRef.current;
    const error = new Error(video?.error?.message || 'Failed to load video');
    setState((prev) => ({
      ...prev,
      hasError: true,
      errorMessage: error.message,
    }));
    onError?.(error);
  }, [onError]);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (state.isPlaying) {
      video.pause();
    } else {
      video.play().catch((err) => {
        onError?.(err);
      });
    }
  }, [state.isPlaying, onError]);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setState((prev) => ({ ...prev, isMuted: video.muted }));
  }, []);

  // Handle fullscreen
  const handleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen().catch(() => {
        // Fullscreen not supported
      });
    }
  }, []);

  // Video event handlers
  const handleVideoPlay = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: true }));
    onPlay?.();
  }, [onPlay]);

  const handleVideoPause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
    onPause?.();
  }, [onPause]);

  const handleVideoEnded = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
    onEnded?.();
  }, [onEnded]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const progress = (video.currentTime / video.duration) * 100;
    setState((prev) => ({
      ...prev,
      progress,
      currentTime: video.currentTime,
    }));
  }, []);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setState((prev) => ({
        ...prev,
        isFullscreen: !!document.fullscreenElement,
      }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Format time (seconds to mm:ss)
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate dimensions
  const containerStyle: React.CSSProperties = {
    aspectRatio: `${aspectRatio}`,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-gray-900 rounded-lg',
        className
      )}
      style={containerStyle}
      onMouseEnter={() => setShowCustomControls(true)}
      onMouseLeave={() => setShowCustomControls(false)}
    >
      {/* Poster image shown before video loads */}
      {(!isInView || (!state.isLoaded && poster)) && (
        <div className="absolute inset-0 z-10">
          {poster ? (
            <img
              src={poster}
              alt={alt}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {/* Play button overlay for poster */}
          {isInView && !state.isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-12 w-12 animate-spin text-white" />
            </div>
          )}

          {!isInView && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/50 rounded-full p-4">
                <Play className="h-12 w-12 text-white" fill="white" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {state.hasError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900 text-white">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-lg font-medium">Failed to load video</p>
          <p className="text-sm text-gray-400 mt-1">{state.errorMessage}</p>
        </div>
      )}

      {/* Video element - only render source when in view */}
      {isInView && !state.hasError && (
        <video
          ref={videoRef}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            state.isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          poster={poster}
          muted={state.isMuted}
          loop={loop}
          controls={controls && !showCustomControls}
          preload={preload}
          playsInline={playsInline}
          title={title}
          aria-label={alt}
          onLoadedData={handleLoadedData}
          onError={handleError}
          onPlay={handleVideoPlay}
          onPause={handleVideoPause}
          onEnded={handleVideoEnded}
          onTimeUpdate={handleTimeUpdate}
        >
          <source src={src} type="video/mp4" />
          <source src={src.replace('.mp4', '.webm')} type="video/webm" />
          <p>Your browser does not support HTML5 video.</p>
        </video>
      )}

      {/* Custom controls overlay */}
      {controls && state.isLoaded && showCustomControls && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/60 via-transparent to-transparent">
          {/* Progress bar */}
          <div className="w-full px-4 pb-2">
            <div className="relative h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer">
              <div
                className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-100"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between px-4 pb-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={handlePlayPause}
                aria-label={state.isPlaying ? 'Pause' : 'Play'}
              >
                {state.isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={handleMuteToggle}
                aria-label={state.isMuted ? 'Unmute' : 'Mute'}
              >
                {state.isMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>

              <span className="text-white text-sm ml-2">
                {formatTime(state.currentTime)} / {formatTime(state.duration)}
              </span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
              onClick={handleFullscreen}
              aria-label={state.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              <Maximize className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Center play button when paused */}
      {state.isLoaded && !state.isPlaying && !showCustomControls && (
        <button
          type="button"
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 transition-opacity hover:bg-black/30"
          onClick={handlePlayPause}
          aria-label="Play video"
        >
          <div className="bg-black/50 rounded-full p-4 transition-transform hover:scale-110">
            <Play className="h-12 w-12 text-white" fill="white" />
          </div>
        </button>
      )}
    </div>
  );
};

export default LazyVideo;
