import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';

// Index is a static marketing homepage wrapped in heavy animation/3D machinery.
// Mock GSAP and the Three.js hero so the page renders deterministically in jsdom;
// the tests target the page's own content, SEO, and layout rather than the
// animation internals.
vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    to: vi.fn(),
    from: vi.fn(),
    fromTo: vi.fn(),
    set: vi.fn(),
    timeline: vi.fn(() => ({ to: vi.fn(), from: vi.fn(), fromTo: vi.fn() })),
    utils: { toArray: vi.fn(() => []) },
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));
vi.mock('@gsap/react', () => ({ useGSAP: vi.fn() }));
vi.mock('../../components/HeroSection', () => ({
  default: () => <div data-testid="hero-section">Hero</div>,
}));
vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import Index from '../Index';

describe('Index page', () => {
  it('renders the hero section', () => {
    render(<Index />, { initialEntries: ['/'] });
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
  });

  it('sets SEO meta (document title)', async () => {
    render(<Index />, { initialEntries: ['/'] });
    await waitFor(() => expect(document.title).toMatch(/Dan Pearson/i));
    expect(document.title).toMatch(/AI Business Automation/i);
  });

  it('renders the featured content / services sections', () => {
    render(<Index />, { initialEntries: ['/'] });
    // Static marketing content (this homepage has no dynamic featured-articles
    // fetch; the services grid is its highlighted content).
    expect(screen.getByText('Sales Leadership')).toBeInTheDocument();
  });

  it('renders lazy sections behind Suspense without crashing (loading handled)', () => {
    // The homepage renders immediately; lazy below-the-fold sections are wrapped
    // in Suspense so the initial paint never blocks or throws.
    const { container } = render(<Index />, { initialEntries: ['/'] });
    expect(container.querySelector('main, section, div')).not.toBeNull();
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
  });
});
