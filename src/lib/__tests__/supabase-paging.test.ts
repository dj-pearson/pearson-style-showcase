import { describe, it, expect, vi } from 'vitest';
import { createSupabaseMock } from '@/test/mocks/supabase';
import { fetchAll, FetchAllLimitError } from '../supabase-paging';

/** A fake table of `total` rows that honours .range(from, to). */
function pagedTable(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  const range = vi.fn((from: number, to: number) =>
    Promise.resolve({ data: rows.slice(from, to + 1), error: null })
  );
  return { rows, range, build: () => ({ range }) };
}

describe('fetchAll', () => {
  it('reads every page until a short page', async () => {
    const table = pagedTable(2500);
    const result = await fetchAll(table.build, 1000);
    expect(result).toHaveLength(2500);
    expect(result[2499]).toEqual({ id: 2500 });
    expect(table.range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('asks for one more page when the last page is exactly full', async () => {
    const table = pagedTable(2000);
    const result = await fetchAll(table.build, 1000);
    expect(result).toHaveLength(2000);
    expect(table.range).toHaveBeenCalledTimes(3);
  });

  it('throws the PostgREST error instead of returning a partial list', async () => {
    let call = 0;
    const build = () => ({
      range: () =>
        Promise.resolve(
          call++ === 0
            ? { data: Array.from({ length: 2 }, (_, i) => ({ id: i })), error: null }
            : { data: null, error: { message: 'boom' } }
        ),
    });
    await expect(fetchAll(build, 2)).rejects.toEqual({ message: 'boom' });
  });

  it('stops at the safety cap rather than looping forever', async () => {
    const build = () => ({
      range: () => Promise.resolve({ data: [{ id: 1 }, { id: 2 }], error: null }),
    });
    await expect(fetchAll(build, { pageSize: 2, maxPages: 3 })).rejects.toBeInstanceOf(
      FetchAllLimitError
    );
  });

  it('works with the shared supabase query-builder mock', async () => {
    const supabase = createSupabaseMock();
    supabase.setTableResult('invoices', { data: [{ id: 'a' }, { id: 'b' }], error: null });
    const result = await fetchAll(() => supabase.from('invoices').select('*').order('id') as never);
    expect(result).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('rejects a bad page size', async () => {
    await expect(fetchAll(pagedTable(1).build, 0)).rejects.toThrow(/pageSize/);
  });
});
