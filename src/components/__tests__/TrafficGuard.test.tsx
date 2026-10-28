import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const runTrafficDetection = vi.fn(() => Promise.resolve());
vi.mock('@/lib/traffic-detection', () => ({
  runTrafficDetection: () => runTrafficDetection(),
}));

import TrafficGuard from '../TrafficGuard';

describe('TrafficGuard', () => {
  beforeEach(() => {
    runTrafficDetection.mockClear();
  });

  afterEach(() => {
    // Unmount while the stubbed idle APIs still exist.
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('waits for an idle callback before running detection', () => {
    let idleCb: IdleRequestCallback | undefined;
    vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback) => {
      idleCb = cb;
      return 7;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());

    render(<TrafficGuard />);
    expect(runTrafficDetection).not.toHaveBeenCalled();

    idleCb?.({ didTimeout: false, timeRemaining: () => 50 });
    expect(runTrafficDetection).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending idle callback on unmount', () => {
    const cancel = vi.fn();
    vi.stubGlobal('requestIdleCallback', () => 7);
    vi.stubGlobal('cancelIdleCallback', cancel);

    const { unmount } = render(<TrafficGuard />);
    unmount();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it('falls back to a 2s timeout without requestIdleCallback', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);

    const { unmount } = render(<TrafficGuard />);
    vi.advanceTimersByTime(1999);
    expect(runTrafficDetection).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(runTrafficDetection).toHaveBeenCalledTimes(1);
    unmount();
  });
});
