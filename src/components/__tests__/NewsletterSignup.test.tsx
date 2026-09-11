import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

const { invokeEdgeFunction } = vi.hoisted(() => ({ invokeEdgeFunction: vi.fn() }));
vi.mock('@/lib/edge-functions', () => ({ invokeEdgeFunction }));

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import NewsletterSignup from '../NewsletterSignup';

beforeEach(() => {
  invokeEdgeFunction.mockReset();
  toast.mockReset();
  invokeEdgeFunction.mockResolvedValue({ data: { message: 'Subscribed.' }, error: null });
});

describe('NewsletterSignup', () => {
  it('names the field for a screen reader instead of relying on the placeholder', () => {
    render(<NewsletterSignup />);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('ties the validation message to the field and announces it', async () => {
    const user = userEvent.setup();
    render(<NewsletterSignup />);

    // Submitted empty. A malformed address never reaches this code - the
    // browser's own validation on a type=email field stops the submit first -
    // but an empty field passes that and fails the schema.
    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    const error = await screen.findByText('Please enter a valid email address');
    const field = screen.getByLabelText('Email address');

    expect(error).toHaveAttribute('role', 'alert');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', error.id);
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it('does not tell a returning subscriber they just subscribed', async () => {
    invokeEdgeFunction.mockResolvedValue({
      data: { message: "You're already subscribed!" },
      error: null,
    });

    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.type(screen.getByLabelText('Email address'), 'dan@example.com');
    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "You're already on the list" })
      )
    );
  });

  it('confirms a genuine new subscription', async () => {
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.type(screen.getByLabelText('Email address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Successfully subscribed!' })
      )
    );
  });
});
