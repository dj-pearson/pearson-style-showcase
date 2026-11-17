import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

type Result = { data: unknown; error: { message: string } | null };

// A small fake of the PostgREST builder that records every request so the
// test can count round trips and decide each response.
const h = vi.hoisted(() => {
  const state = {
    calls: [] as Array<{ table: string; op: string; args: unknown[]; filters: unknown[][] }>,
    respond: (_call: {
      table: string;
      op: string;
      args: unknown[];
      filters: unknown[][];
    }): Result => ({ data: [], error: null }),
  };
  const from = (table: string) => {
    const call = { table, op: 'select', args: [] as unknown[], filters: [] as unknown[][] };
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'in', 'gte', 'lte', 'order', 'range', 'eq']) {
      builder[m] = (...args: unknown[]) => {
        call.filters.push([m, ...args]);
        return builder;
      };
    }
    builder.upsert = (...args: unknown[]) => {
      call.op = 'upsert';
      call.args = args;
      return builder;
    };
    builder.then = (ok: (r: Result) => unknown, bad: (e: unknown) => unknown) => {
      state.calls.push(call);
      return Promise.resolve(state.respond(call)).then(ok, bad);
    };
    return builder;
  };
  const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
  return { state, from, toast };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: h.from } }));
vi.mock('sonner', () => ({ toast: h.toast }));

import { AmazonReportImporter } from '../AmazonReportImporter';

const asinFor = (i: number) => `B${String(i).padStart(9, '0')}`;

function report(rows: Array<[string, string, number, number, number]>) {
  const header = 'Date Shipped\tASIN\tItems Shipped\tRevenue\tAd Fees (Commission)';
  return [header, ...rows.map((r) => r.join('\t'))].join('\n');
}

async function importText(text: string, onImported = vi.fn()) {
  const user = userEvent.setup();
  render(<AmazonReportImporter onImported={onImported} />);
  const input = document.getElementById('report-file') as HTMLInputElement;
  const file = new File([text], 'orders.txt', { type: 'text/plain' });
  // jsdom's File has no text(); the browser's does.
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
  await user.upload(input, file);
  await user.click(screen.getByRole('button', { name: 'Import Report' }));
  return { onImported };
}

const upserts = () => h.state.calls.filter((c) => c.op === 'upsert');
const lookups = (table: string) =>
  h.state.calls.filter((c) => c.table === table && c.op === 'select');

beforeEach(() => {
  h.state.calls = [];
  h.state.respond = () => ({ data: [], error: null });
  h.toast.success.mockClear();
  h.toast.error.mockClear();
  h.toast.warning.mockClear();
});

describe('AmazonReportImporter', () => {
  it('aggregates by date and ASIN and writes one upsert with the article match', async () => {
    h.state.respond = (call) => {
      if (call.table === 'article_products') {
        return {
          data: [
            { asin: 'B000000001', article_id: 'art-old' },
            { asin: 'B000000001', article_id: 'art-new' },
          ],
          error: null,
        };
      }
      if (call.table === 'amazon_affiliate_stats' && call.op === 'select') {
        return {
          data: [{ article_id: 'art-old', asin: 'B000000001', date: '2026-11-01' }],
          error: null,
        };
      }
      return { data: null, error: null };
    };

    const { onImported } = await importText(
      report([
        ['2026-11-01', 'B000000001', 1, 19.99, 0.8],
        ['2026-11-01', 'B000000001', 2, 10.01, 0.4],
        ['2026-11-02', 'B000000002', 1, 5, 0.2],
      ])
    );

    await waitFor(() => expect(h.toast.success).toHaveBeenCalled());
    expect(h.toast.success).toHaveBeenCalledWith('Imported 2 rows: 1 new, 1 updated');
    expect(onImported).toHaveBeenCalled();

    expect(lookups('article_products')).toHaveLength(1);
    expect(upserts()).toHaveLength(1);
    const [payload, options] = upserts()[0].args as [Array<Record<string, unknown>>, unknown];
    expect(options).toEqual({ onConflict: 'article_id,asin,date' });
    expect(payload).toEqual([
      {
        date: '2026-11-01',
        asin: 'B000000001',
        article_id: 'art-old',
        orders: 3,
        revenue: 30,
        commission: 1.2,
      },
      {
        date: '2026-11-02',
        asin: 'B000000002',
        article_id: null,
        orders: 1,
        revenue: 5,
        commission: 0.2,
      },
    ]);
    // clicks stays out of the payload so updates keep tracked clicks.
    expect(payload[0]).not.toHaveProperty('clicks');
  });

  it('batches 1,200 rows into 500-row upserts and counts a failed chunk', async () => {
    let upsertIndex = 0;
    h.state.respond = (call) => {
      if (call.op === 'upsert') {
        upsertIndex += 1;
        return upsertIndex === 2
          ? { data: null, error: { message: 'deadlock detected' } }
          : { data: null, error: null };
      }
      return { data: [], error: null };
    };
    const rows = Array.from(
      { length: 1200 },
      (_, i) => ['2026-11-01', asinFor(i), 1, 10, 1] as [string, string, number, number, number]
    );

    await importText(report(rows));

    await waitFor(() => expect(h.toast.warning).toHaveBeenCalled());
    expect(upserts().map((c) => (c.args[0] as unknown[]).length)).toEqual([500, 500, 200]);
    // 1,200 ASINs at 200 per .in() filter: 6 article lookups, 6 existing lookups.
    expect(lookups('article_products')).toHaveLength(6);
    expect(lookups('amazon_affiliate_stats')).toHaveLength(6);
    expect(h.toast.warning).toHaveBeenCalledWith(
      'Imported 700 rows (700 new, 0 updated); 500 failed. deadlock detected'
    );
    expect(h.toast.success).not.toHaveBeenCalled();
  });

  it('reports a full failure and skips the reload', async () => {
    h.state.respond = (call) =>
      call.op === 'upsert'
        ? { data: null, error: { message: 'permission denied' } }
        : { data: [], error: null };

    const { onImported } = await importText(report([['2026-11-01', 'B000000001', 1, 10, 1]]));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(h.toast.error).toHaveBeenCalledWith(
      'Import failed: all 1 rows were rejected. permission denied'
    );
    expect(onImported).not.toHaveBeenCalled();
  });

  it('stops before writing when the article lookup fails', async () => {
    h.state.respond = (call) =>
      call.table === 'article_products'
        ? { data: null, error: { message: 'timeout' } }
        : { data: [], error: null };

    await importText(report([['2026-11-01', 'B000000001', 1, 10, 1]]));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(h.toast.error).toHaveBeenCalledWith('Import failed: Article lookup failed: timeout');
    expect(upserts()).toHaveLength(0);
  });
});
