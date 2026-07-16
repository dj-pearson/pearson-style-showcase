import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReadingProgress } from '../useReadingProgress';

/** Set the scroll geometry the hook reads from window/document. */
function setScroll({
  scrollY,
  scrollHeight,
  clientHeight,
}: {
  scrollY: number;
  scrollHeight: number;
  clientHeight: number;
}) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  });
}

beforeEach(() => {
  // Run requestAnimationFrame callbacks synchronously for deterministic tests.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  setScroll({ scrollY: 0, scrollHeight: 0, clientHeight: 0 });
});

describe('useReadingProgress', () => {
  it('reports 0% when the page is not scrollable / at the top', () => {
    setScroll({ scrollY: 0, scrollHeight: 1000, clientHeight: 1000 }); // docHeight 0
    const { result } = renderHook(() => useReadingProgress());
    expect(result.current).toBe(0);
  });

  it('updates progress on scroll (mid-page ~50%)', () => {
    setScroll({ scrollY: 0, scrollHeight: 2000, clientHeight: 1000 });
    const { result } = renderHook(() => useReadingProgress());
    expect(result.current).toBe(0);

    act(() => {
      setScroll({ scrollY: 500, scrollHeight: 2000, clientHeight: 1000 }); // 500/1000 = 50%
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current).toBeCloseTo(50, 1);
  });

  it('reports 100% at the bottom of the page', () => {
    setScroll({ scrollY: 0, scrollHeight: 2000, clientHeight: 1000 });
    const { result } = renderHook(() => useReadingProgress());

    act(() => {
      setScroll({ scrollY: 1000, scrollHeight: 2000, clientHeight: 1000 }); // 1000/1000 = 100%
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current).toBeCloseTo(100, 1);
  });

  it('removes the scroll listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useReadingProgress());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    removeSpy.mockRestore();
  });
});
