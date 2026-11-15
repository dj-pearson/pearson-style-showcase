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
