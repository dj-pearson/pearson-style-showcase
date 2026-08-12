import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import { FinancialReports } from '../FinancialReports';

const mock = supabase as unknown as SupabaseMock;

beforeEach(() => {
  mock.resetTableResults();
});

async function openBalanceSheet() {
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByText('Financial Reports')).toBeInTheDocument());
  await user.click(screen.getByRole('tab', { name: /balance sheet/i }));
  await waitFor(() => expect(screen.getByText('Total Assets')).toBeInTheDocument());
}

describe('FinancialReports balance sheet', () => {
  it('adds a same-named account to the derived receivable instead of replacing it', async () => {
    // A standard chart of accounts contains an account literally named
    // "Accounts Receivable", which collides with the line derived from unpaid
    // sales invoices. Assigning by name dropped one of the two silently.
    mock.setTableResult('invoices', {
      data: [
        {
          invoice_type: 'sales',
          amount_paid: 0,
          amount_due: 1000,
          invoice_date: '2026-01-15',
        },
      ],
      error: null,
    });
    mock.setTableResult('platform_transactions', { data: [], error: null });
    mock.setTableResult('journal_entries', { data: [], error: null });
    mock.setTableResult('accounts', {
      data: [
        {
          id: 'acct-ar',
          account_name: 'Accounts Receivable',
          account_type: 'Asset',
          opening_balance: 250,
        },
      ],
      error: null,
    });

    render(<FinancialReports />);
    await openBalanceSheet();

    // 1000 from the unpaid invoice + 250 opening balance, not one or the other.
    await waitFor(() => expect(screen.getAllByText('$1,250.00').length).toBeGreaterThan(0));
  });

  it('sums two distinct asset accounts that share a name', async () => {
    mock.setTableResult('invoices', { data: [], error: null });
    mock.setTableResult('platform_transactions', { data: [], error: null });
    mock.setTableResult('journal_entries', { data: [], error: null });
    mock.setTableResult('accounts', {
      data: [
        { id: 'a1', account_name: 'Cash', account_type: 'Asset', opening_balance: 100 },
        { id: 'a2', account_name: 'Cash', account_type: 'Asset', opening_balance: 400 },
      ],
      error: null,
    });

    render(<FinancialReports />);
    await openBalanceSheet();

    await waitFor(() => expect(screen.getAllByText('$500.00').length).toBeGreaterThan(0));
  });

  it('renders without data', async () => {
    render(<FinancialReports />);
    await waitFor(() => expect(screen.getByText('Financial Reports')).toBeInTheDocument());
  });

  it('does not crash when a query errors', async () => {
    mock.setTableResult('invoices', { data: null, error: { message: 'db error' } });
    render(<FinancialReports />);
    await waitFor(() => expect(screen.getByText('Financial Reports')).toBeInTheDocument());
  });
});
