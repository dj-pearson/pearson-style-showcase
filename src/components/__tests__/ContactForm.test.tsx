import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

const { invokeEdgeFunction } = vi.hoisted(() => ({ invokeEdgeFunction: vi.fn() }));
vi.mock('@/lib/edge-functions', () => ({ invokeEdgeFunction }));

const { trackContactForm } = vi.hoisted(() => ({ trackContactForm: vi.fn() }));
vi.mock('@/components/Analytics', () => ({ useAnalytics: () => ({ trackContactForm }) }));

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
  trackContactForm.mockReset();
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
    // The text appears twice: the visible notice and the live region.
    await waitFor(() =>
      expect(
        screen.getAllByText('Sending your message...').some((el) => el.matches('[role="status"]'))
      ).toBe(true)
    );
    // The completion meter is the only progressbar left; the invented
    // submission bar that jumped 25 -> 100 is gone.
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);

    release({ error: null });
    await waitFor(() => expect(screen.queryAllByText('Sending your message...')).toHaveLength(0));
  });

  it('announces success through the same live region and moves focus to the confirmation', async () => {
    invokeEdgeFunction.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    const { container } = render(<ContactForm />);
    const region = container.querySelector('[role="status"][aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region).toHaveTextContent('');

    await fill(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    const heading = await screen.findByRole('heading', { name: 'Message sent.' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(heading.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    // Same node, new text: a region mounted along with its message is often
    // not announced.
    expect(container.querySelector('[role="status"][aria-live="polite"]')).toBe(region);
    expect(region).toHaveTextContent(
      "Message sent. I'll reply to mary@example.com within one business day."
    );
  });

  it('replaces the form with a confirmation naming the reply address', async () => {
    invokeEdgeFunction.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<ContactForm />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Message sent.')).toBeInTheDocument();
    expect(screen.getByText('mary@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send message/i })).not.toBeInTheDocument();
  });

  it('shows a fixed fallback with the email address instead of the raw error', async () => {
    invokeEdgeFunction.mockResolvedValue({ error: new Error('FunctionsHttpError: 500 internal') });

    const user = userEvent.setup();
    render(<ContactForm />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    const alert = await screen.findByText(/didn't go through/i);
    expect(alert.closest('[role="alert"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'dan@danpearson.net' })).toHaveAttribute(
      'href',
      'mailto:dan@danpearson.net'
    );
    expect(screen.queryByText(/FunctionsHttpError/)).not.toBeInTheDocument();
    expect(trackContactForm).toHaveBeenCalledWith('failure');
  });
});

describe('ContactForm tracking', () => {
  it('fires start once on first focus, then submit and success', async () => {
    invokeEdgeFunction.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<ContactForm />);
    await fill(user);

    expect(trackContactForm.mock.calls.map(([s]) => s)).toEqual(['start']);

    await user.click(screen.getByRole('button', { name: /send message/i }));
    await screen.findByText('Message sent.');

    expect(trackContactForm.mock.calls.map(([s]) => s)).toEqual(['start', 'submit', 'success']);
  });
});
