import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});
vi.mock('@/integrations/supabase/public-client', () => import('@/test/mocks/public-client'));

import Navigation from '../Navigation';

const Page = () => (
  <div>
    <Navigation />
    <main id="main-content">
      <a href="/behind">Link behind the menu</a>
    </main>
    <footer>
      <a href="/privacy">Footer link</a>
    </footer>
    <div role="status" aria-live="polite" data-testid="announcer" />
  </div>
);

describe('Navigation mobile menu', () => {
  it('makes the page behind the open menu inert and restores it on Escape', async () => {
    const user = userEvent.setup();
    const { container } = render(<Page />);
    const main = container.querySelector('#main-content')!;
    const footer = container.querySelector('footer')!;
    const toggle = screen.getByRole('button', { name: 'Open navigation menu' });

    await user.click(toggle);

    const panel = container.querySelector('#mobile-navigation-menu')!;
    expect(panel).not.toBeNull();
    expect(main).toHaveAttribute('inert');
    expect(footer).toHaveAttribute('inert');
    expect(panel.closest('[inert]')).toBeNull();
    expect(toggle.closest('[inert]')).toBeNull();
    // Live regions keep announcing (route changes fire while the menu closes).
    expect(screen.getByTestId('announcer')).not.toHaveAttribute('inert');
    // The dismiss-on-tap backdrop has to stay clickable.
    expect(container.querySelector('.bg-black\\/60')?.hasAttribute('inert')).toBe(false);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(container.querySelector('#mobile-navigation-menu')).toBeNull());
    expect(main).not.toHaveAttribute('inert');
    expect(footer).not.toHaveAttribute('inert');
    expect(toggle).toHaveFocus();
  });

  it('leaves an element that was already inert alone when the menu closes', async () => {
    const user = userEvent.setup();
    const { container } = render(<Page />);
    const footer = container.querySelector('footer')!;
    footer.setAttribute('inert', '');

    const toggle = screen.getByRole('button', { name: 'Open navigation menu' });
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Close navigation menu' }));

    expect(footer).toHaveAttribute('inert');
  });

  it('keeps the active item label centred by taking its marker out of the flow', async () => {
    const user = userEvent.setup();
    const { container } = render(<Page />, { initialEntries: ['/news'] });
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    const panel = container.querySelector('#mobile-navigation-menu')!;
    const active = panel.querySelector('a[aria-current="page"]')!;
    expect(active).toHaveTextContent('News');
    const marker = active.querySelector('[aria-hidden="true"]')!;
    expect(marker.className).toMatch(/\babsolute\b/);
    expect(marker.className).not.toMatch(/ml-auto/);
  });
});
