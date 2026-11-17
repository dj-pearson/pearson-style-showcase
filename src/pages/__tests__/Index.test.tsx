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
    context: vi.fn((fn: () => void) => {
      fn();
      return { revert: vi.fn() };
    }),
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
    expect(document.title).toMatch(/AI CRM Automation/i);
  });

  it('renders the positioning sections', () => {
    render(<Index />, { initialEntries: ['/'] });
    // Static marketing content: the thesis, the framework and the offer ladder
    // are the homepage's own content (everything else is lazy or DB-driven).
    expect(
      screen.getByRole('heading', { name: /why most ai crm projects fail/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /pipeline automation ladder/i })
    ).toBeInTheDocument();
    expect(screen.getByText('CRM Automation Audit')).toBeInTheDocument();
  });

  it('renders lazy sections behind Suspense without crashing (loading handled)', () => {
    // The homepage renders immediately; lazy below-the-fold sections are wrapped
    // in Suspense so the initial paint never blocks or throws.
    const { container } = render(<Index />, { initialEntries: ['/'] });
    expect(container.querySelector('main, section, div')).not.toBeNull();
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
  });

  it('holds below-the-fold sections as placeholders until they near the viewport', () => {
    // The setup file's IntersectionObserver never fires, so nothing has scrolled
    // into range: each deferred section is still its sized placeholder, and the
    // anchor ids exist so an in-page link still has somewhere to land.
    const { container } = render(<Index />, { initialEntries: ['/'] });
    for (const selector of [
      '#authority',
      '#current-ventures',
      '#case-studies',
      '#testimonials',
      '#newsletter',
    ]) {
      expect(container.querySelector(selector), selector).not.toBeNull();
    }
    expect(container.querySelector('#authority > [aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector('#case-studies > [aria-hidden="true"]')).not.toBeNull();
    expect(
      screen.queryByRole('heading', { name: /how i work, and how you can check it/i })
    ).toBeNull();
  });

  it('mounts a deferred section at once when the URL hash targets it', async () => {
    render(<Index />, { initialEntries: ['/#authority'] });
    expect(
      await screen.findByRole('heading', { name: /how i work, and how you can check it/i })
    ).toBeInTheDocument();
  });
});
