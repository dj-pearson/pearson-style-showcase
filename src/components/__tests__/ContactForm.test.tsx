import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

const { invokeEdgeFunction } = vi.hoisted(() => ({ invokeEdgeFunction: vi.fn() }));
vi.mock('@/lib/edge-functions', () => ({ invokeEdgeFunction }));

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

import ContactForm from '../ContactForm';

const fill = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText('Your full name'), "Mary O'Brien");
  await user.type(screen.getByPlaceholderText('your.email@example.com'), 'mary@example.com');
  await user.type(screen.getByPlaceholderText("What's this about?"), 'A question');
  await user.type(
    screen.getByPlaceholderText(/tell me about your project/i),
    'I would like to talk about a project.'
  );
};

beforeEach(() => {
  invokeEdgeFunction.mockReset();
  toast.mockReset();
});

describe('ContactForm while sending', () => {
  it('reports that it is sending without claiming a percentage it cannot know', async () => {
    let release: (value: { error: null }) => void = () => {};
    invokeEdgeFunction.mockReturnValue(
      new Promise<{ error: null }>((resolve) => {
        release = resolve;
      })
    );

    const user = userEvent.setup();
    render(<ContactForm />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    // test-utils renders global live regions, so pick the sending one by text.
    const status = await screen.findByText('Sending your message...');
    expect(status.closest('[role="status"]')).not.toBeNull();
    // The completion meter is the only progressbar left; the invented
    // submission bar that jumped 25 -> 100 is gone.
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);

    release({ error: null });
    await waitFor(() =>
      expect(screen.queryByText('Sending your message...')).not.toBeInTheDocument()
    );
  });

  it('confirms a sent message', async () => {
    invokeEdgeFunction.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<ContactForm />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Message sent successfully!' })
      )
    );
  });
});
