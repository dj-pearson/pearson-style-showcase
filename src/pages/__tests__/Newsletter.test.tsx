import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

const { invokeEdgeFunction } = vi.hoisted(() => ({ invokeEdgeFunction: vi.fn() }));
vi.mock('@/lib/edge-functions', () => ({ invokeEdgeFunction }));

// Navigation queries Supabase on mount; a default mock is enough for it to render.
vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import NewsletterConfirm from '../NewsletterConfirm';
import NewsletterUnsubscribe from '../NewsletterUnsubscribe';

const TOKEN = 'a'.repeat(43);

beforeEach(() => {
  invokeEdgeFunction.mockReset();
});

describe('NewsletterConfirm', () => {
  it('posts the token from the link and confirms', async () => {
    invokeEdgeFunction.mockResolvedValue({ data: { status: 'confirmed' }, error: null });
    render(<NewsletterConfirm />, { initialEntries: [`/newsletter/confirm?token=${TOKEN}`] });

    expect(await screen.findByText("You're subscribed.")).toBeInTheDocument();
    expect(invokeEdgeFunction).toHaveBeenCalledTimes(1);
    expect(invokeEdgeFunction).toHaveBeenCalledWith('newsletter-confirm', {
      body: { token: TOKEN },
    });
  });

  it('tells the visitor an expired link needs a new signup', async () => {
    invokeEdgeFunction.mockResolvedValue({ data: { status: 'expired' }, error: null });
    render(<NewsletterConfirm />, { initialEntries: [`/newsletter/confirm?token=${TOKEN}`] });

    expect(await screen.findByText('That link has expired.')).toBeInTheDocument();
    expect(screen.getByText('Sign up again on the homepage.')).toBeInTheDocument();
  });

  it('does not call the function without a token', () => {
    render(<NewsletterConfirm />, { initialEntries: ['/newsletter/confirm'] });

    expect(screen.getByText("That link doesn't work.")).toBeInTheDocument();
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it('marks the page noindex', async () => {
    invokeEdgeFunction.mockResolvedValue({ data: { status: 'confirmed' }, error: null });
    render(<NewsletterConfirm />, { initialEntries: [`/newsletter/confirm?token=${TOKEN}`] });

    await screen.findByText("You're subscribed.");
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow'
    );
  });
});

describe('NewsletterUnsubscribe', () => {
  it('posts the token and confirms the address is off the list', async () => {
    invokeEdgeFunction.mockResolvedValue({ data: { status: 'unsubscribed' }, error: null });
    render(<NewsletterUnsubscribe />, {
      initialEntries: ['/newsletter/unsubscribe?token=id.sig'],
    });

    expect(await screen.findByText("You're off the list.")).toBeInTheDocument();
    expect(invokeEdgeFunction).toHaveBeenCalledWith('newsletter-unsubscribe', {
      body: { token: 'id.sig' },
    });
  });

  it('offers a manual route when the link is rejected', async () => {
    invokeEdgeFunction.mockResolvedValue({ data: null, error: new Error('invalid') });
    render(<NewsletterUnsubscribe />, {
      initialEntries: ['/newsletter/unsubscribe?token=bad'],
    });

    expect(await screen.findByText("That unsubscribe link didn't work.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'dan@danpearson.net' })).toHaveAttribute(
      'href',
      'mailto:dan@danpearson.net?subject=Unsubscribe'
    );
  });
});
