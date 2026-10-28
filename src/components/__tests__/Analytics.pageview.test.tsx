import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import Analytics, { useAnalytics } from '../Analytics';
import ScrollTracker from '../ScrollTracker';

let navigateTo: (path: string) => void = () => {};

// Stands in for pages/Index, which calls useAnalytics() for trackCTA.
const PageUsingHelpers = () => {
  useAnalytics();
  navigateTo = useNavigate();
  return null;
};

const pageViewCalls = (gtag: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>) =>
  gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'page_view');

describe('page_view tracking', () => {
  let gtag: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;

  beforeEach(() => {
    gtag = vi.fn<(...args: unknown[]) => void>();
    window.gtag = gtag;
    // Run idle callbacks synchronously so the deferred page_view is observable.
    vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
  });

  afterEach(() => {
    // Unmount while the stubbed idle APIs still exist.
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sends one page_view per route change even with several useAnalytics() callers', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Analytics />
        <ScrollTracker />
        <PageUsingHelpers />
      </MemoryRouter>
    );

    expect(pageViewCalls(gtag)).toHaveLength(1);

    act(() => navigateTo('/about'));
    expect(pageViewCalls(gtag)).toHaveLength(2);
    expect(pageViewCalls(gtag)[1][2]).toMatchObject({ page_path: '/about' });
  });

  it('useAnalytics() on its own sends no page_view', () => {
    render(
      <MemoryRouter>
        <PageUsingHelpers />
      </MemoryRouter>
    );
    expect(pageViewCalls(gtag)).toHaveLength(0);
  });
});

describe('ScrollTracker', () => {
  it('binds its scroll listener once, not again after each milestone', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    window.gtag = vi.fn();

    render(
      <MemoryRouter>
        <ScrollTracker />
      </MemoryRouter>
    );

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 1000 });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    const scrollEvents = (window.gtag as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[1] === 'scroll'
    );
    expect(scrollEvents).toHaveLength(5);
    expect(addSpy.mock.calls.filter((call) => call[0] === 'scroll')).toHaveLength(1);
    addSpy.mockRestore();
  });
});
