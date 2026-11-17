import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import { PaymentsManager } from '../PaymentsManager';

const mock = supabase as unknown as SupabaseMock;

beforeEach(() => {
  mock.resetTableResults();
  mock.setTableResult('payments', { data: [], error: null });
});

function renderManager() {
  return render(
    <ConfirmProvider>
      <PaymentsManager />
    </ConfirmProvider>
  );
}

describe('PaymentsManager record dialog', () => {
  it('asks before Escape discards a typed amount', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: /record payment/i }));
    await user.type(screen.getByLabelText(/amount/i), '125.50');
    await user.keyboard('{Escape}');

    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep Editing' }));

    await waitFor(() =>
      expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument()
    );
    expect(screen.getByLabelText(/amount/i)).toHaveValue(125.5);
  });

  it('closes straight away when nothing was typed', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: /record payment/i }));
    expect(screen.getByText('Record New Payment')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByText('Record New Payment')).not.toBeInTheDocument());
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
  });
});
