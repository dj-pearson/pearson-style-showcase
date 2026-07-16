import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeviceCapabilities } from '../useDeviceCapabilities';

/**
 * NOTE: useDeviceCapabilities derives capabilities from screen size, touch
 * points, hardwareConcurrency, network connection and the reduced-motion media
 * query. It does not probe WebGL directly (Three.js handles its own fallback),
 * so the AC's "WebGL support" is covered here as the closest real signal:
 * mobile/touch detection and the low-performance / reduced-motion gating that
 * decides whether heavy (3D) animations are enabled.
 */

interface EnvOpts {
  innerWidth?: number;
  cores?: number;
  maxTouchPoints?: number;
  reducedMotion?: boolean;
  devicePixelRatio?: number;
}

function setEnv({
  innerWidth = 1280,
  cores = 8,
  maxTouchPoints = 0,
  reducedMotion = false,
  devicePixelRatio = 1,
}: EnvOpts) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: innerWidth });
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    value: devicePixelRatio,
  });
  Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: cores });
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
  // jsdom always defines window.ontouchstart, which would force isMobile true.
  // Remove it so mobile detection is driven only by viewport width and
  // maxTouchPoints, matching a real desktop browser without touch.
  delete (window as unknown as { ontouchstart?: unknown }).ontouchstart;
  window.matchMedia = ((query: string) => ({
    matches: reducedMotion && query.includes('reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  setEnv({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDeviceCapabilities', () => {
  it('treats a wide, multi-core desktop as capable (heavy animations on)', () => {
    setEnv({ innerWidth: 1280, cores: 8 });
    const { result } = renderHook(() => useDeviceCapabilities());
    expect(result.current.isMobile).toBe(false);
    expect(result.current.prefersReducedMotion).toBe(false);
    expect(result.current.enableHeavyAnimations).toBe(true);
    expect(result.current.recommendedParticleCount.stars).toBeGreaterThan(1000);
  });

  it('detects mobile via a narrow viewport', () => {
    setEnv({ innerWidth: 500, cores: 8 });
    const { result } = renderHook(() => useDeviceCapabilities());
    expect(result.current.isMobile).toBe(true);
  });

  it('detects touch support via maxTouchPoints even on a wide screen', () => {
    setEnv({ innerWidth: 1280, cores: 8, maxTouchPoints: 5 });
    const { result } = renderHook(() => useDeviceCapabilities());
    expect(result.current.isMobile).toBe(true);
  });

  it('honors the reduced-motion preference by disabling heavy animations', () => {
    setEnv({ reducedMotion: true });
    const { result } = renderHook(() => useDeviceCapabilities());
    expect(result.current.prefersReducedMotion).toBe(true);
    expect(result.current.enableHeavyAnimations).toBe(false);
    expect(result.current.isLowPerformance).toBe(true);
  });

  it('flags a low-core device as low performance with reduced particle counts', () => {
    setEnv({ innerWidth: 1280, cores: 2 });
    const { result } = renderHook(() => useDeviceCapabilities());
    expect(result.current.isLowPerformance).toBe(true);
    expect(result.current.recommendedParticleCount.stars).toBeLessThan(500);
    expect(result.current.enableHeavyAnimations).toBe(false);
  });

  it('caps the device pixel ratio at 2 for render performance', () => {
    setEnv({ devicePixelRatio: 3 });
    const { result } = renderHook(() => useDeviceCapabilities());
    expect(result.current.devicePixelRatio).toBe(2);
  });
});
