import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import Navigation from '../Navigation';

describe('Navigation search entry points', () => {
  it('offers a search control outside the desktop-only bar', () => {
    render(<Navigation />);

    // Two triggers share the label: the desktop bar and the mobile header. The
    // mobile one is what matters - Cmd+K does not exist on a phone.
    const triggers = screen.getAllByRole('button', { name: 'Open search' });
    expect(triggers.length).toBeGreaterThan(1);

    const desktopOnly = triggers.filter((button) => button.closest('.hidden.lg\\:flex') !== null);
    expect(triggers.length).toBeGreaterThan(desktopOnly.length);
  });

  it('opens the search dialog from the mobile header', async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    const triggers = screen.getAllByRole('button', { name: 'Open search' });
    const mobileTrigger = triggers.find((button) => button.closest('.hidden.lg\\:flex') === null);
    expect(mobileTrigger).toBeDefined();

    await user.click(mobileTrigger!);
    // The dialog is a lazy chunk mounted on first open.
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
  });
});

describe('Navigation admin entry point', () => {
  it('does not link to the admin login from the desktop bar or the mobile menu', async () => {
    const user = userEvent.setup();
    const { container } = render(<Navigation />);

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    expect(container.querySelector('a[href^="/admin"]')).toBeNull();
  });
});

describe('Navigation mobile panel', () => {
  it('moves focus into the panel on open and back to the toggle on Escape', async () => {
    const user = userEvent.setup();
    const { container } = render(<Navigation />);

    const toggle = screen.getByRole('button', { name: 'Open navigation menu' });
    await user.click(toggle);

    const panel = container.querySelector('#mobile-navigation-menu');
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveAttribute('role', 'menu');
    expect(panel!.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(container.querySelector('#mobile-navigation-menu')).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it('offers "Book an audit" as the link to /connect', async () => {
    const user = userEvent.setup();
    render(<Navigation />);
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    const ctas = screen.getAllByRole('link', { name: 'Book an audit' });
    expect(ctas.length).toBe(2);
    ctas.forEach((cta) => expect(cta).toHaveAttribute('href', '/connect'));
    expect(screen.queryByRole('link', { name: 'Connect' })).toBeNull();
  });
});
