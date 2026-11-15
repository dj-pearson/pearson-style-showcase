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

  it('shows an error with Retry instead of a $0 report when a query errors', async () => {
    mock.setTableResult('invoices', { data: null, error: { message: 'db error' } });
    render(<FinancialReports />);
    await waitFor(() => expect(screen.getByText('Financial Reports')).toBeInTheDocument());
    expect(await screen.findByText(/couldn't load the financial reports/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Total Revenue')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled();
  });

  it('adds amounts in cents so the balance sheet balances exactly', async () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004; in cents it is 30.
    mock.setTableResult('invoices', {
      data: [
        { invoice_type: 'sales', amount_paid: 0, amount_due: 0.1, invoice_date: '2026-01-15' },
        { invoice_type: 'sales', amount_paid: 0, amount_due: 0.2, invoice_date: '2026-01-16' },
      ],
      error: null,
    });
    mock.setTableResult('platform_transactions', { data: [], error: null });
    mock.setTableResult('journal_entries', { data: [], error: null });
    mock.setTableResult('accounts', {
      data: [
        { id: 'eq', account_name: 'Owner Equity', account_type: 'Equity', opening_balance: 0.3 },
      ],
      error: null,
    });

    render(<FinancialReports />);
    await openBalanceSheet();
    await waitFor(() => expect(screen.getAllByText('$0.30').length).toBeGreaterThan(0));
    expect(screen.getByText(/Balance Sheet is balanced/)).toBeInTheDocument();
  });
});
