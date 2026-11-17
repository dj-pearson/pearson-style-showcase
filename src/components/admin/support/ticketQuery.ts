/**
 * Server-side filtering for the support inbox. Everything here builds
 * PostgREST filters so search and paging see every ticket, not just the
 * newest page that happens to be loaded.
 */

export const ARCHIVED_STATUSES = ['closed', 'resolved', 'disregard', 'spam'] as const;
export const ACTIVE_STATUSES = [
  'open',
  'in_progress',
  'waiting_for_user',
  'waiting_for_agent',
] as const;

/** Columns the search box matches against. */
export const TICKET_SEARCH_COLUMNS = [
  'ticket_number',
  'subject',
  'user_email',
  'user_name',
  'message',
] as const;

export const TICKET_PAGE_SIZE = 50;

export interface TicketFilters {
  search: string;
  status: string; // 'active' | 'all' | a status value
  category: string; // 'all' | a category value
  priority: string; // 'all' | '1'..'4'
  showArchived: boolean;
}

/**
 * Escape LIKE metacharacters so user text matches literally. Postgres LIKE
 * uses backslash as its default escape character.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Quote a value for a PostgREST logic tree (or=(...)). Inside double quotes
 * the reserved , ( ) . : characters are literal; only " and \ need escaping.
 */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (ch) => `\\${ch}`)}"`;
}

/**
 * Build the `or` filter for a search term, or null for a blank search.
 * PostgREST turns `*` into `%` in like patterns, so a literal `*` cannot be
 * matched exactly; it is sent as `_` (any single character) instead of
 * becoming a wildcard run.
 */
export function buildTicketSearchFilter(raw: string): string | null {
  const term = raw.trim();
  if (!term) return null;
  const pattern = `%${escapeLikePattern(term).replace(/\*/g, '_')}%`;
  const quoted = quotePostgrestValue(pattern);
  return TICKET_SEARCH_COLUMNS.map((col) => `${col}.ilike.${quoted}`).join(',');
}

/** The subset of the PostgREST builder used here (kept loose for testing). */
export interface FilterableQuery<Q> {
  eq(column: string, value: unknown): Q;
  in(column: string, values: readonly unknown[]): Q;
  not(column: string, operator: string, value: unknown): Q;
  or(filters: string): Q;
}

export function applyTicketFilters<Q extends FilterableQuery<Q>>(
  query: Q,
  filters: TicketFilters
): Q {
  let q = query;
  if (!filters.showArchived) {
    q = q.not('status', 'in', `(${ARCHIVED_STATUSES.join(',')})`);
  }
  if (filters.status === 'active') {
    q = q.in('status', ACTIVE_STATUSES);
  } else if (filters.status !== 'all') {
    q = q.eq('status', filters.status);
  }
  if (filters.category !== 'all') {
    q = q.eq('category', filters.category);
  }
  if (filters.priority !== 'all') {
    const priority = Number.parseInt(filters.priority, 10);
    if (Number.isFinite(priority)) q = q.eq('priority', priority);
  }
  const search = buildTicketSearchFilter(filters.search);
  if (search) q = q.or(search);
  return q;
}

/** Inclusive row range for a zero-based page. */
export function pageRange(page: number, size = TICKET_PAGE_SIZE): [number, number] {
  const from = page * size;
  return [from, from + size - 1];
}
