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
import { InvoicesManager } from '../InvoicesManager';

const mock = supabase as unknown as SupabaseMock & { rpc: ReturnType<typeof vi.fn> };

const paidInvoice = {
  id: 'inv-1',
  invoice_type: 'sales',
  invoice_number: 'INV-100',
  invoice_date: '2026-03-01',
  due_date: null,
  total_amount: 2000,
  subtotal: 2000,
  tax_amount: 0,
  amount_paid: 2000,
  amount_due: 0,
  status: 'paid',
  import_source: 'manual',
  external_url: null,
  external_id: null,
  contact_id: null,
  currency_id: null,
  notes: 'old notes',
  contacts: null,
};

/** Every builder the component created, with the spies the mock attached. */
function builders() {
  return mock.from.mock.results.map((r) => r.value as Record<string, ReturnType<typeof vi.fn>>);
}

beforeEach(() => {
  mock.resetTableResults();
  mock.from.mockClear();
  mock.rpc = vi.fn(() => Promise.resolve({ error: null }));
});

describe('InvoicesManager edit', () => {
  it('saves a paid invoice without touching amount_paid or dropping its items', async () => {
    mock.setTableResult('invoices', { data: [paidInvoice], error: null });
    mock.setTableResult('invoice_items', {
      data: [
        {
          id: 'item-1',
          invoice_id: 'inv-1',
          line_number: 1,
          description: 'Consulting',
          quantity: 1,
          unit_price: 2000,
          line_total: 2000,
          metadata: null,
        },
      ],
      error: null,
    });

    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <InvoicesManager />
      </ConfirmProvider>
    );

    await waitFor(() => expect(screen.getByText('INV-100')).toBeInTheDocument());
    // Stored DATE shows as the stored day in any time zone.
    expect(screen.getAllByText('Mar 1, 2026').length).toBeGreaterThan(0);

    await user.click(screen.getByTitle('Edit'));
    // The existing line item replaces the blank starter row once it loads.
    await waitFor(() => expect(screen.getByDisplayValue('Consulting')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Update Invoice' }));

    await waitFor(() => expect(mock.rpc).toHaveBeenCalled());

    const updates = builders()
      .filter((b) => b.update?.mock.calls.length)
      .flatMap((b) => b.update.mock.calls.map((c) => c[0]));
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toHaveProperty('amount_paid');
    expect(updates[0].total_amount).toBe(2000);
    expect(updates[0].amount_due).toBe(0);

    expect(mock.rpc).toHaveBeenCalledWith('replace_invoice_items', {
      p_invoice_id: 'inv-1',
      p_items: [
        {
          line_number: 1,
          description: 'Consulting',
          quantity: 1,
          unit_price: 2000,
          line_total: 2000,
          metadata: null,
        },
      ],
    });
  });
});
