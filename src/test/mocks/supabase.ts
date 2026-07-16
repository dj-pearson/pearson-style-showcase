/**
 * Comprehensive Supabase client mock for tests.
 *
 * The real client exposes a fluent query builder where nearly every method
 * (`select`, `eq`, `order`, ...) returns the builder again, and the chain is
 * finally awaited (it is thenable) or resolved via a terminal method
 * (`single`, `maybeSingle`). This mock reproduces that shape so components and
 * hooks under test can call the client exactly as they do in production.
 *
 * Usage:
 *   import { createSupabaseMock } from '@/test/mocks/supabase';
 *   const supabase = createSupabaseMock({ data: [createMockArticle()] });
 *   vi.mock('@/integrations/supabase/client', () => ({ supabase }));
 *
 * Per-test you can override what a table resolves to via `setTableResult`, or
 * inspect calls through the exposed `vi.fn()` spies.
 */

import { vi } from 'vitest';

export interface SupabaseResult<T = unknown> {
  data: T;
  error: { message: string; code?: string } | null;
}

export interface SupabaseMockOptions {
  /** Default resolved value for query chains that don't have a table override. */
  data?: unknown;
  error?: { message: string; code?: string } | null;
  /** Result for `auth.getSession()`. */
  session?: unknown;
  /** Result for `functions.invoke()`. */
  functionResult?: SupabaseResult;
}

/**
 * A query builder whose chainable methods all return `this`, and which is
 * awaitable (thenable) so `await supabase.from('x').select('*').eq(...)` works,
 * as do terminal `.single()` / `.maybeSingle()` calls.
 */
function createQueryBuilder(getResult: () => SupabaseResult) {
  const builder: Record<string, unknown> = {};

  const chainMethods = [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'is',
    'in',
    'contains',
    'or',
    'and',
    'not',
    'filter',
    'match',
    'order',
    'limit',
    'range',
    'returns',
    'overrideTypes',
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }

  // Terminal resolvers return a promise of the result.
  builder.single = vi.fn(() => Promise.resolve(getResult()));
  builder.maybeSingle = vi.fn(() => Promise.resolve(getResult()));
  builder.csv = vi.fn(() => Promise.resolve(getResult()));

  // Make the builder awaitable so chains without a terminal method still resolve.
  builder.then = (
    onFulfilled?: (value: SupabaseResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(getResult()).then(onFulfilled, onRejected);

  return builder;
}

export function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const defaultResult: SupabaseResult = {
    data: options.data ?? null,
    error: options.error ?? null,
  };

  // Per-table result overrides, keyed by table name.
  const tableResults = new Map<string, SupabaseResult>();

  const getResultForTable = (table: string): SupabaseResult =>
    tableResults.get(table) ?? defaultResult;

  const from = vi.fn((table: string) => createQueryBuilder(() => getResultForTable(table)));

  const auth = {
    getSession: vi.fn(() =>
      Promise.resolve({ data: { session: options.session ?? null }, error: null })
    ),
    getUser: vi.fn(() =>
      Promise.resolve({ data: { user: null }, error: null })
    ),
    signInWithPassword: vi.fn(() =>
      Promise.resolve({ data: { session: options.session ?? null, user: null }, error: null })
    ),
    signInWithOAuth: vi.fn(() =>
      Promise.resolve({ data: { provider: 'google', url: 'https://example.com' }, error: null })
    ),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    refreshSession: vi.fn(() =>
      Promise.resolve({ data: { session: options.session ?? null, user: null }, error: null })
    ),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  };

  const functions = {
    invoke: vi.fn(() =>
      Promise.resolve(options.functionResult ?? { data: null, error: null })
    ),
  };

  const channelObj = {
    on: vi.fn(function on() {
      return channelObj;
    }),
    subscribe: vi.fn(() => channelObj),
    unsubscribe: vi.fn(() => Promise.resolve('ok')),
  };
  const channel = vi.fn(() => channelObj);
  const removeChannel = vi.fn(() => Promise.resolve('ok'));

  const storageBucket = {
    upload: vi.fn(() => Promise.resolve({ data: { path: 'path/to/file' }, error: null })),
    download: vi.fn(() => Promise.resolve({ data: new Blob(), error: null })),
    remove: vi.fn(() => Promise.resolve({ data: [], error: null })),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/file' } })),
  };
  const storage = { from: vi.fn(() => storageBucket) };

  return {
    from,
    auth,
    functions,
    channel,
    removeChannel,
    storage,
    /** Test helper: set the resolved result for a specific table's next query. */
    setTableResult(table: string, result: SupabaseResult) {
      tableResults.set(table, result);
    },
    /** Test helper: clear all per-table overrides. */
    resetTableResults() {
      tableResults.clear();
    },
  };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
