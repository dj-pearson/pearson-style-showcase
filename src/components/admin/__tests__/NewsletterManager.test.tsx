import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

type Call = { head: boolean; filters: unknown[][] };
type Result = { data: unknown; error: null | { message: string }; count?: number | null };

const h = vi.hoisted(() => {
  const state = {
    calls: [] as Call[],
    respond: (_c: Call): Result => ({ data: [], error: null, count: 0 }),
  };
  const from = () => {
    const call: Call = { head: false, filters: [] };
    const b: Record<string, unknown> = {};
    for (const m of ['eq', 'is', 'not', 'gte', 'order', 'ilike', 'range']) {
      b[m] = (...args: unknown[]) => {
        call.filters.push([m, ...args]);
        return b;
      };
    }
    b.select = (_cols: string, opts?: { head?: boolean }) => {
      call.head = Boolean(opts?.head);
      return b;
    };
    b.then = (ok: (r: Result) => unknown, bad: (e: unknown) => unknown) => {
      state.calls.push(call);
      return Promise.resolve(state.respond(call)).then(ok, bad);
    };
    return b;
  };
  return { state, from };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: h.from } }));

import NewsletterManager from '../NewsletterManager';

const has = (c: Call, ...f: unknown[]) =>
  c.filters.some((x) => JSON.stringify(x) === JSON.stringify(f));

const subscriber = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `s${i}`,
  email: `reader${i}@example.com`,
  subscribed_at: '2026-11-01T10:00:00Z',
  created_at: '2026-11-01T10:00:00Z',
  welcome_email_sent: false,
  active: true,
  confirmed_at: '2026-11-01T10:05:00Z',
  unsubscribed_at: null,
  ...extra,
});

beforeEach(() => {
  h.state.calls = [];
});

describe('NewsletterManager', () => {
  it('reads counts from head-only queries with the double opt-in filters', async () => {
    h.state.respond = (c) => {
      if (!c.head) return { data: [], error: null, count: 0 };
      if (has(c, 'not', 'unsubscribed_at', 'is', null))
        return { data: null, error: null, count: 7 };
      if (has(c, 'eq', 'active', false) && has(c, 'is', 'confirmed_at', null))
        return { data: null, error: null, count: 3 };
      if (has(c, 'eq', 'active', true) && has(c, 'not', 'confirmed_at', 'is', null))
        return { data: null, error: null, count: 1500 };
      if (c.filters.length === 0) return { data: null, error: null, count: 1510 };
      return { data: null, error: null, count: 0 };
    };

    render(<NewsletterManager />);

    expect(await screen.findByText('1500')).toBeInTheDocument();
    expect(screen.getByText('3 pending, 7 unsubscribed, 1510 total')).toBeInTheDocument();

    const pending = h.state.calls.find(
      (c) => c.head && has(c, 'eq', 'active', false) && has(c, 'is', 'confirmed_at', null)
    );
    expect(pending && has(pending, 'is', 'unsubscribed_at', null)).toBe(true);
  });

  it('pages the list 50 rows at a time and labels each status', async () => {
    const user = userEvent.setup();
    h.state.respond = (c) => {
      if (c.head) return { data: null, error: null, count: 0 };
      const range = c.filters.find((f) => f[0] === 'range') as [string, number, number];
      if (range[1] === 0) {
        return {
          data: [
            subscriber(0),
            subscriber(1, { active: false, confirmed_at: null }),
            subscriber(2, { active: false, unsubscribed_at: '2026-11-03T00:00:00Z' }),
            ...Array.from({ length: 47 }, (_, i) => subscriber(i + 3)),
          ],
          error: null,
          count: 60,
        };
      }
      return {
        data: Array.from({ length: 10 }, (_, i) => subscriber(i + 50)),
        error: null,
        count: 60,
      };
    };

    render(<NewsletterManager />);
    expect(await screen.findByText('Showing 50 of 60')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Unsubscribed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Showing 60 of 60')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();

    const ranges = h.state.calls
      .filter((c) => !c.head)
      .map((c) => c.filters.find((f) => f[0] === 'range'));
    expect(ranges).toContainEqual(['range', 50, 99]);
  });

  it('searches on the server with LIKE wildcards escaped', async () => {
    const user = userEvent.setup();
    h.state.respond = () => ({ data: [], error: null, count: 0 });
    render(<NewsletterManager />);

    await user.type(screen.getByLabelText('Search subscribers by email'), '50%_off');
    await waitFor(() =>
      expect(h.state.calls.some((c) => has(c, 'ilike', 'email', '%50\\%\\_off%'))).toBe(true)
    );
  });
});
