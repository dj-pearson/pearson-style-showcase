import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';
import { defaultTaxYear } from '@/lib/accounting/dates';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import { ScheduleCReport } from '../ScheduleCReport';

const mock = supabase as unknown as SupabaseMock;

beforeEach(() => {
  mock.resetTableResults();
  mock.setTableResult('expense_categories', { data: [], error: null });
  mock.setTableResult('platform_transactions', { data: [], error: null });
  mock.setTableResult('journal_entries', { data: [], error: null });
});

describe('ScheduleCReport', () => {
  it('defaults to the current filing year, not a hard-coded one', async () => {
    mock.setTableResult('invoices', { data: [], error: null });
    render(<ScheduleCReport />);
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toHaveTextContent(String(defaultTaxYear()))
    );
  });

  it('shows an error with Retry instead of $0 line items when a query fails', async () => {
    mock.setTableResult('invoices', { data: null, error: { message: 'db error' } });
    render(<ScheduleCReport />);

    expect(await screen.findByText(/couldn't load schedule c/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/Part I/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled();
  });

  it('sums receipts in cents', async () => {
    mock.setTableResult('invoices', {
      data: [
        { id: 'a', invoice_type: 'sales', amount_paid: 0.1, invoice_date: '2026-01-01' },
        { id: 'b', invoice_type: 'sales', amount_paid: 0.2, invoice_date: '2026-01-02' },
      ],
      error: null,
    });
    render(<ScheduleCReport />);
    // Both sales rows also come back for the purchase query in this mock, but
    // gross receipts must read exactly $0.30.
    await waitFor(() => expect(screen.getAllByText('$0.30').length).toBeGreaterThan(0));
  });
});
