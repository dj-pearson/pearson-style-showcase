/**
 * Read every row of a PostgREST query, past the server's max_rows cap.
 *
 * supabase/config.toml sets max_rows = 1000, so an unpaged select silently
 * stops at 1000 rows. fetchAll asks for one page at a time with .range() and
 * stops at the first short page.
 *
 * The factory must build a fresh query each call (builders are single-use)
 * and should order by a unique column, or rows can repeat or go missing
 * between pages.
 *
 *   const rows = await fetchAll(() =>
 *     supabase.from('invoices').select('*').order('invoice_date').order('id')
 *   );
 */

interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

interface RangeableQuery<T> {
  range(from: number, to: number): PromiseLike<PageResult<T>>;
}

export interface FetchAllOptions {
  pageSize?: number;
  /** Give up (and throw) after this many pages instead of looping forever. */
  maxPages?: number;
}

export class FetchAllLimitError extends Error {
  constructor(maxRows: number) {
    super(`Query returned more than ${maxRows} rows; refusing to load a partial result.`);
    this.name = 'FetchAllLimitError';
  }
}

export async function fetchAll<T>(
  buildQuery: () => RangeableQuery<T>,
  pageSizeOrOptions: number | FetchAllOptions = {}
): Promise<T[]> {
  const opts =
    typeof pageSizeOrOptions === 'number' ? { pageSize: pageSizeOrOptions } : pageSizeOrOptions;
  const pageSize = opts.pageSize ?? 1000;
  const maxPages = opts.maxPages ?? 100;
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error('fetchAll: pageSize must be a positive integer');
  }

  const rows: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
  throw new FetchAllLimitError(maxPages * pageSize);
}
