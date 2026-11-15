/**
 * Sequential document numbers (DRAW-2026-004, EST-2026-Q1-2) that survive
 * deletions.
 *
 * Counting rows and adding one reuses a number after a delete: with
 * DRAW-001..003 on file, deleting 002 leaves two rows and the next draw is
 * "003" again, which payments.payment_number UNIQUE rejects. Take the
 * highest number in use instead, and retry if a concurrent save took it.
 */

/**
 * Highest sequence among `numbers` that start with `prefix`, plus one.
 * `${prefix}-007` counts as 7; a bare `${prefix}` (older single-payment
 * numbering) counts as 1. Anything else is ignored.
 */
export function nextSequence(numbers: Array<string | null | undefined>, prefix: string): number {
  let max = 0;
  for (const n of numbers) {
    if (!n || !n.startsWith(prefix)) continue;
    const rest = n.slice(prefix.length);
    if (rest === '') {
      max = Math.max(max, 1);
      continue;
    }
    const m = /^-(\d+)$/.exec(rest);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

interface DbError {
  code?: string;
  message: string;
}

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * Insert a row under the next free number, retrying when another save claims
 * the same number first.
 *
 * fetchNumbers: the numbers already in use under this prefix.
 * insert: write the row with the given sequence; resolve with its error.
 */
export async function insertWithNextSequence(args: {
  prefix: string;
  fetchNumbers: () => Promise<Array<string | null>>;
  insert: (seq: number) => PromiseLike<{ error: DbError | null }>;
  attempts?: number;
}): Promise<number> {
  const attempts = args.attempts ?? 3;
  let lastError: DbError | null = null;
  for (let i = 0; i < attempts; i++) {
    const seq = nextSequence(await args.fetchNumbers(), args.prefix);
    const { error } = await args.insert(seq);
    if (!error) return seq;
    if (error.code !== UNIQUE_VIOLATION) throw error;
    lastError = error;
  }
  throw lastError ?? new Error('Could not find a free number');
}
