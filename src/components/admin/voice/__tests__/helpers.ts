import type { SupabaseMock } from '@/test/mocks/supabase';

type Builder = Record<string, { mock: { calls: unknown[][] } }>;

/**
 * Every query builder the mock handed out for `table`. Each supabase.from()
 * call returns a fresh builder, so asserting on a write means finding the
 * builder whose insert/update spy was called.
 */
export function buildersFor(mock: SupabaseMock, table: string): Builder[] {
  return mock.from.mock.calls
    .map((call, index) => ({ call, value: mock.from.mock.results[index]?.value }))
    .filter(({ call }) => call[0] === table)
    .map(({ value }) => value as Builder);
}

/** Arguments of every call to `method` (insert, update, ...) made against `table`. */
export function callsTo(mock: SupabaseMock, table: string, method: string): unknown[][] {
  return buildersFor(mock, table).flatMap((builder) => builder[method].mock.calls);
}
