import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock({ data: [] }) };
});

import { supabase } from '@/integrations/supabase/client';
import { TicketDetailView } from '../TicketDetailView';
import { draftKey, loadReplyDraft, saveReplyDraft, clearReplyDraft } from '../ticketReplyDraft';

const mock = supabase as unknown as SupabaseMock;

const makeTicket = (id: string, subject: string) => ({
  id,
  ticket_number: `T-${id}`,
  subject,
  message: 'Help',
  user_email: 'reader@example.com',
  user_name: 'Reader',
  category: 'general',
  priority: 2,
  status: 'open',
  assigned_to: null,
  user_agent: null,
  referrer_url: null,
  page_url: null,
  ai_suggested_responses: null,
  created_at: '2026-11-01T10:00:00Z',
  mailbox_id: null,
});

const ticketA = makeTicket('a', 'Login loop');
const ticketB = makeTicket('b', 'Invoice copy');

const replyBox = () => screen.getByPlaceholderText(/compose your email reply|type your response/i);

beforeEach(() => {
  sessionStorage.clear();
  mock.resetTableResults();
});

describe('ticketReplyDraft storage', () => {
  it('round-trips a draft per ticket and drops blank ones', () => {
    saveReplyDraft('a', 'Try clearing cookies');
    saveReplyDraft('b', 'Attached');
    expect(loadReplyDraft('a')).toBe('Try clearing cookies');
    expect(loadReplyDraft('b')).toBe('Attached');

    saveReplyDraft('a', '   ');
    expect(sessionStorage.getItem(draftKey('a'))).toBeNull();

    clearReplyDraft('b');
    expect(loadReplyDraft('b')).toBe('');
  });

  it('degrades to no draft when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadReplyDraft('a')).toBe('');
    spy.mockRestore();
  });
});

describe('TicketDetailView reply draft', () => {
  it('keeps a draft per ticket across switching and reopening', async () => {
    const user = userEvent.setup();
    const props = { onClose: () => {}, onUpdate: () => {} };
    const { rerender, unmount } = render(<TicketDetailView ticket={ticketA} {...props} />);

    await user.type(replyBox(), 'Try clearing cookies');
    expect(sessionStorage.getItem(draftKey('a'))).toBe('Try clearing cookies');

    rerender(<TicketDetailView ticket={ticketB} {...props} />);
    await waitFor(() => expect(replyBox()).toHaveValue(''));

    rerender(<TicketDetailView ticket={ticketA} {...props} />);
    await waitFor(() => expect(replyBox()).toHaveValue('Try clearing cookies'));

    // Close and reopen: a fresh mount restores it from storage.
    unmount();
    render(<TicketDetailView ticket={ticketA} {...props} />);
    expect(replyBox()).toHaveValue('Try clearing cookies');
  });

  it('clears the draft after a successful send', async () => {
    const user = userEvent.setup();
    saveReplyDraft('a', 'Fixed on our side');
    const onUpdate = vi.fn();
    render(<TicketDetailView ticket={ticketA} onClose={() => {}} onUpdate={onUpdate} />);

    expect(replyBox()).toHaveValue('Fixed on our side');
    // Save as a plain response (no email) so the send goes through the table insert.
    await user.click(screen.getByRole('switch', { name: /send as email/i }));
    await user.click(screen.getByRole('button', { name: /save reply/i }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(sessionStorage.getItem(draftKey('a'))).toBeNull();
    expect(replyBox()).toHaveValue('');
  });

  it('keeps the draft when the send fails', async () => {
    const user = userEvent.setup();
    saveReplyDraft('a', 'Fixed on our side');
    mock.setTableResult('ticket_responses', { data: null, error: { message: 'rls' } });
    const onUpdate = vi.fn();
    render(<TicketDetailView ticket={ticketA} onClose={() => {}} onUpdate={onUpdate} />);

    await user.click(screen.getByRole('switch', { name: /send as email/i }));
    await user.click(screen.getByRole('button', { name: /save reply/i }));

    // Let the rejected insert settle (the toast itself is not mounted here).
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(replyBox()).toHaveValue('Fixed on our side');
    expect(onUpdate).not.toHaveBeenCalled();
    expect(loadReplyDraft('a')).toBe('Fixed on our side');
  });
});
