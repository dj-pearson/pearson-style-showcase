import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import FinancialOverview from '../FinancialOverview';

const mock = supabase as unknown as SupabaseMock;

beforeEach(() => {
  mock.resetTableResults();
});

describe('FinancialOverview', () => {
  it('renders the financial summary cards', async () => {
    mock.setTableResult('invoices', { data: [], error: null });
    mock.setTableResult('platform_transactions', { data: [], error: null });
    mock.setTableResult('amazon_affiliate_stats', { data: [], error: null });

    render(<FinancialOverview />);

    await waitFor(() => expect(screen.getByText('Financial Overview')).toBeInTheDocument());
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    expect(screen.getByText('Net Profit')).toBeInTheDocument();
  });

  it('displays computed totals from the data', async () => {
    mock.setTableResult('invoices', {
      data: [
        { invoice_type: 'sales', amount_paid: 5000, amount_due: 0, invoice_date: '2026-01-15' },
      ],
      error: null,
    });
    mock.setTableResult('platform_transactions', { data: [], error: null });
    mock.setTableResult('amazon_affiliate_stats', { data: [], error: null });

    render(<FinancialOverview />);

    // Revenue and (with zero expenses) Net Profit both show $5,000.00.
    await waitFor(() => expect(screen.getAllByText('$5,000.00').length).toBeGreaterThan(0));
  });

  it('renders gracefully with no data (empty / loading state)', async () => {
    // Leave all tables at their default (null data) - metrics fall back to zero.
    render(<FinancialOverview />);
    await waitFor(() => expect(screen.getByText('Financial Overview')).toBeInTheDocument());
    // Zero totals rendered as currency across the metric cards.
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
  });

  it('shows an error with Retry instead of $0 when a query fails', async () => {
    mock.setTableResult('invoices', { data: null, error: { message: 'db error' } });
    mock.setTableResult('platform_transactions', { data: [], error: null });
    mock.setTableResult('amazon_affiliate_stats', { data: [], error: null });
    render(<FinancialOverview />);

    expect(await screen.findByText(/couldn't load the financial overview/i)).toBeInTheDocument();
    expect(screen.getByText(/db error/)).toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();

    // Retry recovers once the table answers.
    mock.setTableResult('invoices', { data: [], error: null });
    await userEvent.setup().click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('Total Revenue')).toBeInTheDocument());
  });
});
