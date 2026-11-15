import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

const { invokeEdgeFunction } = vi.hoisted(() => ({ invokeEdgeFunction: vi.fn() }));
vi.mock('@/lib/edge-functions', () => ({ invokeEdgeFunction }));

const { trackNewsletterSignup } = vi.hoisted(() => ({ trackNewsletterSignup: vi.fn() }));
vi.mock('@/components/Analytics', () => ({ useAnalytics: () => ({ trackNewsletterSignup }) }));

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import NewsletterSignup from '../NewsletterSignup';

beforeEach(() => {
  invokeEdgeFunction.mockReset();
  trackNewsletterSignup.mockReset();
  invokeEdgeFunction.mockResolvedValue({
    data: { status: 'confirmation_sent', message: 'Check your inbox for a link to confirm.' },
    error: null,
  });
});

describe('NewsletterSignup', () => {
  it('names the field for a screen reader instead of relying on the placeholder', () => {
    render(<NewsletterSignup />);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('ties the validation message to the field and announces it', async () => {
    const user = userEvent.setup();
    render(<NewsletterSignup />);

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    const error = await screen.findByText('Please enter a valid email address');
    const field = screen.getByLabelText('Email address');

    expect(error).toHaveAttribute('role', 'alert');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', error.id);
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it('does not tell a returning subscriber they just subscribed, or count them as a lead', async () => {
    invokeEdgeFunction.mockResolvedValue({
      data: { status: 'already_subscribed', message: "You're already subscribed!" },
      error: null,
    });

    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.type(screen.getByLabelText('Email address'), 'dan@example.com');
    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    expect(await screen.findByText("You're already on the list.")).toBeInTheDocument();
    expect(trackNewsletterSignup).toHaveBeenCalledWith('attempt');
    expect(trackNewsletterSignup).not.toHaveBeenCalledWith('success');
  });

  it('asks a new subscriber to confirm by email', async () => {
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.type(screen.getByLabelText('Email address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    const heading = await screen.findByText('One more step.');
    expect(heading.closest('[role="status"]')).toHaveTextContent(
      'Check new@example.com for a link to confirm.'
    );
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
    expect(trackNewsletterSignup).toHaveBeenCalledWith('success');
  });

  it('shows a fixed message rather than the raw error', async () => {
    invokeEdgeFunction.mockResolvedValue({
      data: null,
      error: new Error('relation does not exist'),
    });

    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.type(screen.getByLabelText('Email address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    expect(await screen.findByText(/didn't go through/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation does not exist/)).not.toBeInTheDocument();
    expect(trackNewsletterSignup).toHaveBeenCalledWith('failure');
  });
});
