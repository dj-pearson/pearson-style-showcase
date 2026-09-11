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
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
