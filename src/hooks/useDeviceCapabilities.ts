import { useState, useEffect } from 'react';

interface DeviceCapabilities {
  /** Whether the device is considered low-performance */
  isLowPerformance: boolean;
  /** Whether the device prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Whether on a slow network connection */
  isSlowConnection: boolean;
  /** Device pixel ratio - lower values = fewer pixels to render */
  devicePixelRatio: number;
  /** Recommended particle count for 3D effects */
  recommendedParticleCount: {
    stars: number;
    nodes: number;
  };
  /** Whether to enable heavy animations */
  enableHeavyAnimations: boolean;
  /** Whether data saver mode is enabled */
  dataSaver: boolean;
  /** Number of logical CPU cores (navigator.hardwareConcurrency) */
  cpuCores: number;
  /** Device memory in GB if available */
  deviceMemory: number | null;
  /** Whether the device is mobile based on screen size and touch */
  isMobile: boolean;
}

/**
 * Hook to detect device capabilities and provide performance recommendations.
 * Used for adaptive loading of heavy components like Three.js, GSAP animations, etc.
 */
export function useDeviceCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>(() => getInitialCapabilities());

  useEffect(() => {
    // Re-evaluate on connection change
    const connection = (navigator as any).connection;

    const handleChange = () => {
      setCapabilities(getInitialCapabilities());
    };

    // Listen for connection changes
    if (connection) {
      connection.addEventListener('change', handleChange);
    }

    // Listen for media query changes (reduced motion)
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', handleChange);

    // Listen for resize (mobile detection)
    window.addEventListener('resize', handleChange);

    return () => {
      if (connection) {
        connection.removeEventListener('change', handleChange);
      }
      mediaQuery.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleChange);
    };
  }, []);

  return capabilities;
}

function getInitialCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    // SSR fallback - assume capable device
    return getDefaultCapabilities();
  }

  const connection = (navigator as any).connection;
  const deviceMemory = (navigator as any).deviceMemory ?? null;
  const cpuCores = navigator.hardwareConcurrency ?? 4;

  // Detect reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Detect slow connection
  const effectiveType = connection?.effectiveType;
  const isSlowConnection = connection?.saveData ||
    effectiveType === 'slow-2g' ||
    effectiveType === '2g' ||
    effectiveType === '3g';

  // Detect data saver mode
  const dataSaver = connection?.saveData ?? false;

  // Detect mobile device
  const isMobile = window.innerWidth < 768 ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0;

  // Calculate device pixel ratio (capped for performance)
  const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  // Determine if low performance device
  // Consider: CPU cores, memory, connection speed, mobile status
  const isLowPerformance =
    prefersReducedMotion ||
    dataSaver ||
    isSlowConnection ||
    cpuCores <= 2 ||
    (deviceMemory !== null && deviceMemory < 4) ||
    (isMobile && cpuCores <= 4);

  // Calculate recommended particle counts based on device capability
  let starCount = 1500;
  let nodeCount = 100;

  if (isLowPerformance) {
    starCount = 400;
    nodeCount = 30;
  } else if (isMobile) {
    starCount = 800;
    nodeCount = 50;
  } else if (cpuCores >= 8 && (!deviceMemory || deviceMemory >= 8)) {
    // High-end desktop
    starCount = 1500;
    nodeCount = 100;
  }

  // Disable heavy animations for low performance or reduced motion
  const enableHeavyAnimations = !prefersReducedMotion && !isLowPerformance;

  return {
    isLowPerformance,
    prefersReducedMotion,
    isSlowConnection,
    devicePixelRatio,
    recommendedParticleCount: {
      stars: starCount,
      nodes: nodeCount,
    },
    enableHeavyAnimations,
    dataSaver,
    cpuCores,
    deviceMemory,
    isMobile,
  };
}

function getDefaultCapabilities(): DeviceCapabilities {
  return {
    isLowPerformance: false,
    prefersReducedMotion: false,
    isSlowConnection: false,
    devicePixelRatio: 1,
    recommendedParticleCount: {
      stars: 1000,
      nodes: 75,
    },
    enableHeavyAnimations: true,
    dataSaver: false,
    cpuCores: 4,
    deviceMemory: null,
    isMobile: false,
  };
}

export default useDeviceCapabilities;
