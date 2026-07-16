import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import { SmartAlerts } from '../SmartAlerts';

const mock = supabase as unknown as SupabaseMock;

function alert(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alert-1',
    alert_type: 'system',
    severity: 'warning',
    title: 'Disk almost full',
    message: 'Disk usage at 85%',
    details: {},
    acknowledged: false,
    acknowledged_by: null,
    acknowledged_at: null,
    resolved: false,
    resolved_by: null,
    resolved_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mock.resetTableResults();
});

describe('SmartAlerts', () => {
  it('renders the alert list', async () => {
    mock.setTableResult('automated_alerts', { data: [alert()], error: null });
    render(<SmartAlerts />);
    await waitFor(() => expect(screen.getByText('Disk almost full')).toBeInTheDocument());
    expect(screen.getByText('Disk usage at 85%')).toBeInTheDocument();
  });

  it('displays the severity badge', async () => {
    mock.setTableResult('automated_alerts', {
      data: [alert({ severity: 'critical', title: 'Outage' })],
      error: null,
    });
    render(<SmartAlerts />);
    await waitFor(() => expect(screen.getByText('Outage')).toBeInTheDocument());
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('shows the empty state when there are no alerts', async () => {
    mock.setTableResult('automated_alerts', { data: [], error: null });
    render(<SmartAlerts />);
    await waitFor(() => expect(screen.getByText('No active alerts')).toBeInTheDocument());
  });

  it('dismisses (resolves) an alert', async () => {
    mock.setTableResult('automated_alerts', { data: [alert()], error: null });
    render(<SmartAlerts />);
    await waitFor(() => expect(screen.getByText('Disk almost full')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Resolve'));

    // resolveAlert removes the alert from the list on success.
    await waitFor(() => expect(screen.queryByText('Disk almost full')).not.toBeInTheDocument());
  });
});
