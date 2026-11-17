import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import Analytics, {
  sanitizePageLocation,
  trackCTA,
  trackContactForm,
  trackEvent,
  trackNewsletterSignup,
  trackSearch,
  trackShare,
  useAnalytics,
} from '../Analytics';
import ScrollTracker from '../ScrollTracker';
import { acceptAll, rejectAll } from '@/lib/consent';

let navigateTo: (path: string) => void = () => {};

// Stands in for pages/Index, which calls useAnalytics() for trackCTA.
const PageUsingHelpers = () => {
  useAnalytics();
  navigateTo = useNavigate();
  return null;
};

type GtagMock = ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;

const eventCalls = (gtag: GtagMock, name: string) =>
  gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === name);

const pageViewCalls = (gtag: GtagMock) => eventCalls(gtag, 'page_view');

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Analytics />
      <ScrollTracker />
      <PageUsingHelpers />
    </MemoryRouter>
  );
}

let gtag: GtagMock;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  acceptAll();
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
  document.querySelectorAll('script[src*="googletagmanager"]').forEach((s) => s.remove());
});

describe('page_view tracking', () => {
  it('sends one page_view per route change even with several useAnalytics() callers', () => {
    renderAt('/');
    expect(pageViewCalls(gtag)).toHaveLength(1);

    act(() => navigateTo('/about'));
    expect(pageViewCalls(gtag)).toHaveLength(2);
    expect(pageViewCalls(gtag)[1][2]).toMatchObject({ page_path: '/about' });
  });

  it('does not send another page_view when only the query string changes', () => {
    renderAt('/search');
    act(() => navigateTo('/search?q=hub'));
    act(() => navigateTo('/search?q=hubspot'));
    expect(pageViewCalls(gtag)).toHaveLength(1);

    act(() => navigateTo('/news'));
    expect(pageViewCalls(gtag)).toHaveLength(2);
  });

  it('useAnalytics() on its own sends no page_view', () => {
    render(
      <MemoryRouter>
        <PageUsingHelpers />
      </MemoryRouter>
    );
    expect(pageViewCalls(gtag)).toHaveLength(0);
  });

  it('skips admin and auth pages but still tracks /author archives', () => {
    window.history.replaceState(null, '', '/admin/dashboard');
    renderAt('/admin/dashboard');
    window.history.replaceState(null, '', '/auth/callback?code=secret');
    act(() => navigateTo('/auth/callback'));
    expect(pageViewCalls(gtag)).toHaveLength(0);

    window.history.replaceState(null, '', '/author/dan-pearson');
    act(() => navigateTo('/author/dan-pearson'));
    expect(pageViewCalls(gtag)).toHaveLength(1);
  });

  it('drops the token from a newsletter link', () => {
    window.history.replaceState(null, '', '/newsletter/unsubscribe?token=abc123&utm_source=x');
    renderAt('/newsletter/unsubscribe');
    const [, , params] = pageViewCalls(gtag)[0];
    expect((params as { page_location: string }).page_location).toBe(
      `${window.location.origin}/newsletter/unsubscribe`
    );
  });

  it('sends nothing without analytics consent', () => {
    rejectAll();
    gtag.mockClear(); // rejectAll itself pushes a Consent Mode update.
    renderAt('/');
    trackEvent('click', 'Test');
    trackCTA('Book an audit', 'Homepage CTA', '/connect');
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe('sanitizePageLocation', () => {
  const origin = 'https://danpearson.net';

  it('strips credential params and the hash, keeping the rest', () => {
    expect(
      sanitizePageLocation(
        `${origin}/news?utm_source=li&token=a&code=b&access_token=c&refresh_token=d#access_token=e`
      )
    ).toBe(`${origin}/news?utm_source=li`);
  });

  it('returns the bare path for newsletter pages', () => {
    expect(sanitizePageLocation(`${origin}/newsletter/confirm?token=a&x=1`)).toBe(
      `${origin}/newsletter/confirm`
    );
  });

  it('returns null for admin and auth pages', () => {
    expect(sanitizePageLocation(`${origin}/admin`)).toBeNull();
    expect(sanitizePageLocation(`${origin}/admin/login`)).toBeNull();
    expect(sanitizePageLocation(`${origin}/auth/callback?code=x`)).toBeNull();
    expect(sanitizePageLocation(`${origin}/author/dan`)).toBe(`${origin}/author/dan`);
  });
});

describe('event helpers', () => {
  it('sends cta_click with separate name, location and link', () => {
    trackCTA('Book an audit', 'Article end', '/connect');
    expect(eventCalls(gtag, 'cta_click')[0][2]).toMatchObject({
      cta_name: 'Book an audit',
      cta_location: 'Article end',
      link_url: '/connect',
    });
  });

  it('trims, caps and ignores empty search terms', () => {
    trackSearch('   ', 'palette');
    expect(eventCalls(gtag, 'search')).toHaveLength(0);

    trackSearch(`  ${'a'.repeat(150)}  `, 'search_page');
    const params = eventCalls(gtag, 'search')[0][2] as Record<string, string>;
    expect(params.search_term).toHaveLength(100);
    expect(params.search_source).toBe('search_page');
  });

  it('sends share with method and article slug', () => {
    trackShare('copy', 'my-article');
    expect(eventCalls(gtag, 'share')[0][2]).toMatchObject({
      method: 'copy',
      content_type: 'article',
      item_id: 'my-article',
    });
  });

  it('marks a contact form lead with its source and currency', () => {
    trackContactForm('success');
    expect(eventCalls(gtag, 'generate_lead')[0][2]).toMatchObject({
      lead_source: 'contact_form',
      currency: 'USD',
      value: 1,
    });
  });

  it('counts a newsletter request as sign_up, not as a lead', () => {
    trackNewsletterSignup('success');
    expect(eventCalls(gtag, 'sign_up')[0][2]).toMatchObject({ method: 'newsletter' });
    expect(eventCalls(gtag, 'generate_lead')).toHaveLength(0);
  });

  it('never sends the raw URL on an event', () => {
    window.history.replaceState(null, '', '/news?token=secret');
    trackCTA('x', 'y');
    expect(eventCalls(gtag, 'cta_click')[0][2]).toMatchObject({
      page_location: `${window.location.origin}/news`,
    });
  });
});

describe('ScrollTracker', () => {
  function scrollToMiddleOfTwoScreens() {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 1000 });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
  }

  it('binds its scroll listener once, not again after each milestone', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    render(
      <MemoryRouter>
        <ScrollTracker />
      </MemoryRouter>
    );
    scrollToMiddleOfTwoScreens();

    const depthEvents = eventCalls(gtag, 'scroll_depth');
    expect(depthEvents.map((call) => (call[2] as { percent: number }).percent)).toEqual([
      25, 50, 75, 90, 100,
    ]);
    expect(eventCalls(gtag, 'scroll')).toHaveLength(0);
    expect(addSpy.mock.calls.filter((call) => call[0] === 'scroll')).toHaveLength(1);
    addSpy.mockRestore();
  });

  it('starts the milestones over on a new page', async () => {
    renderAt('/');
    scrollToMiddleOfTwoScreens();
    expect(eventCalls(gtag, 'scroll_depth')).toHaveLength(5);

    act(() => navigateTo('/about'));
    // The scroll handler is throttled to 100ms.
    await new Promise((resolve) => setTimeout(resolve, 150));
    scrollToMiddleOfTwoScreens();
    expect(eventCalls(gtag, 'scroll_depth')).toHaveLength(10);
  });
});
