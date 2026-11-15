import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@/test/test-utils';

// Stub every tab module: this test is about routing and lazy loading, not the
// managers themselves.
vi.mock('../accounting/FinancialOverview', () => ({
  default: () => <div>overview panel</div>,
}));
vi.mock('../accounting/AIBillingTracker', () => ({ AIBillingTracker: () => <div>ai panel</div> }));
vi.mock('../accounting/PlatformsManager', () => ({ default: () => <div>platforms panel</div> }));
vi.mock('../accounting/InvoicesManager', () => ({
  InvoicesManager: () => <div>invoices panel</div>,
}));
vi.mock('../accounting/PaymentsManager', () => ({
  PaymentsManager: () => <div>payments panel</div>,
}));
vi.mock('../accounting/RecurringTransactionsManager', () => ({
  default: () => <div>recurring</div>,
}));
vi.mock('../accounting/ExpenseCategoriesManager', () => ({ default: () => <div>categories</div> }));
vi.mock('../accounting/ChartOfAccountsManager', () => ({ ChartOfAccountsManager: () => <div /> }));
vi.mock('../accounting/ContactsManager', () => ({ ContactsManager: () => <div /> }));
vi.mock('../accounting/JournalEntriesManager', () => ({ JournalEntriesManager: () => <div /> }));
vi.mock('../accounting/ImportIntegrationsManager', () => ({
  ImportIntegrationsManager: () => <div />,
}));
vi.mock('../accounting/DataExporter', () => ({ DataExporter: () => <div /> }));
vi.mock('../accounting/FinancialReports', () => ({ FinancialReports: () => <div /> }));
vi.mock('../accounting/TaxCenter', () => ({ TaxCenter: () => <div /> }));

import { AccountingDashboard } from '../AccountingDashboard';

const LocationProbe = () => <output data-testid="search">{useLocation().search}</output>;

function renderAt(url: string) {
  return render(
    <>
      <AccountingDashboard />
      <LocationProbe />
    </>,
    { initialEntries: [url] }
  );
}

describe('AccountingDashboard', () => {
  it('opens the tab named in ?tab=', async () => {
    renderAt('/admin?view=accounting&tab=invoices');
    expect(await screen.findByText('invoices panel')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /invoices/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('overview panel')).not.toBeInTheDocument();
  });

  it('falls back to the overview for a missing or unknown tab', async () => {
    renderAt('/admin?view=accounting&tab=nope');
    expect(await screen.findByText('overview panel')).toBeInTheDocument();
  });

  it('writes the tab to the URL and keeps the other params', async () => {
    const user = userEvent.setup();
    renderAt('/admin?view=accounting');
    await screen.findByText('overview panel');

    await user.click(screen.getByRole('tab', { name: /payments/i }));
    expect(await screen.findByText('payments panel')).toBeInTheDocument();
    const params = new URLSearchParams(screen.getByTestId('search').textContent ?? '');
    expect(params.get('view')).toBe('accounting');
    expect(params.get('tab')).toBe('payments');

    // Back to the overview drops the param rather than writing tab=overview.
    await user.click(screen.getByRole('tab', { name: /overview/i }));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?view=accounting'));
  });
});
