import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import { SupportTicketInbox } from '../SupportTicketInbox';
import { buildTicketSearchFilter } from '../ticketQuery';
import userEvent from '@testing-library/user-event';

const mock = supabase as unknown as SupabaseMock;

beforeEach(() => {
  mock.resetTableResults();
  mock.setTableResult('support_tickets', { data: [], error: null });
});

// The admin dashboard mounts ConfirmProvider; the inbox needs it for bulk delete.
function renderInbox() {
  return render(
    <ConfirmProvider>
      <SupportTicketInbox onSelectTicket={() => {}} />
    </ConfirmProvider>
  );
}

describe('SupportTicketInbox stat filters', () => {
  // These five tiles were clickable divs: no role, no tab stop, no key handler,
  // so the filters could not be reached without a mouse at all.
  it.each([
    ['Show open tickets'],
    ['Show tickets in progress'],
    ['Show tickets waiting on the user'],
    ['Show all active tickets'],
    ['Toggle archived tickets'],
  ])('exposes "%s" as a button', async (name) => {
    renderInbox();
    await waitFor(() => expect(screen.getByRole('button', { name })).toBeInTheDocument());
  });

  it('renders each stat filter as a real button element, not a div with a role', async () => {
    renderInbox();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Show open tickets' })).toBeInTheDocument()
    );
    for (const name of [
      'Show open tickets',
      'Show tickets in progress',
      'Show tickets waiting on the user',
      'Show all active tickets',
      'Toggle archived tickets',
    ]) {
      expect(screen.getByRole('button', { name }).tagName).toBe('BUTTON');
    }
  });
});

describe('SupportTicketInbox server-side search and paging', () => {
  const makeTickets = (n: number, offset = 0) =>
    Array.from({ length: n }, (_, i) => ({
      id: `t${offset + i}`,
      ticket_number: `TKT-${offset + i}`,
      subject: `Subject ${offset + i}`,
      message: 'm',
      user_email: 'reader@example.com',
      user_name: 'Reader',
      category: 'question',
      priority: 2,
      status: 'open',
      assigned_to: null,
      ai_sentiment_score: null,
      created_at: '2026-11-01T10:00:00Z',
      last_activity_at: '2026-11-01T10:00:00Z',
      first_response_at: null,
    }));

  // The shared mock's result type has no count; PostgREST returns one.
  const withCount = (data: unknown[], count: number) =>
    ({ data, error: null, count }) as unknown as { data: unknown; error: null };

  type Builder = Record<string, { mock: { calls: unknown[][] } }>;
  const listBuilders = () =>
    mock.from.mock.results
      .map((r) => r.value as Builder)
      .filter((b) => b.range.mock.calls.length > 0);

  it('shows the total count and pages with Load more', async () => {
    mock.from.mockClear();
    mock.setTableResult('support_tickets', withCount(makeTickets(50), 120));
    renderInbox();

    expect(await screen.findByText('Showing 50 of 120 tickets')).toBeInTheDocument();
    expect(listBuilders()[0].range.mock.calls[0]).toEqual([0, 49]);

    mock.setTableResult('support_tickets', withCount(makeTickets(50, 50), 120));
    await userEvent.click(screen.getByRole('button', { name: 'Load 50 more' }));

    expect(await screen.findByText('Showing 100 of 120 tickets')).toBeInTheDocument();
    const builders = listBuilders();
    expect(builders[builders.length - 1].range.mock.calls[0]).toEqual([50, 99]);
  });

  it('sends the search to the server as an escaped or filter', async () => {
    mock.from.mockClear();
    renderInbox();
    await userEvent.type(screen.getByPlaceholderText('Search tickets...'), '100%,x');

    await waitFor(() => {
      const ors = listBuilders().flatMap((b) => b.or.mock.calls.map((c) => c[0]));
      expect(ors).toContain(buildTicketSearchFilter('100%,x'));
    });
    const ors = listBuilders().flatMap((b) => b.or.mock.calls.map((c) => c[0] as string));
    expect(ors.at(-1)).toContain('subject.ilike."%100\\\\%,x%"');
  });
});
