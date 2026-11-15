/**
 * Pure helpers for the link health check. No Deno or network globals, so they
 * can be unit-tested with `deno test --no-check`.
 */

const URL_RE = /https?:\/\/[^\s"')<>\]]+/g;

/** Every distinct http(s) URL in a block of article content. */
export function extractUrls(content: string | null | undefined): string[] {
  if (!content) return [];
  const found = content.match(URL_RE) || [];
  // Trailing sentence punctuation is almost never part of the link.
  return Array.from(new Set(found.map((u) => u.replace(/[.,;:!?]+$/, ''))));
}

/**
 * Pick which URLs to check this run. Never-checked URLs go first, then the
 * ones checked longest ago, so a capped run works through the whole set over
 * successive days instead of re-checking the same first N every time.
 */
export function selectUrlsToCheck(
  urls: string[],
  lastChecked: Map<string, string>,
  limit: number
): string[] {
  const ts = (u: string): number => {
    const v = lastChecked.get(u);
    if (!v) return -Infinity;
    const t = Date.parse(v);
    return Number.isNaN(t) ? -Infinity : t;
  };
  return [...urls].sort((a, b) => ts(a) - ts(b)).slice(0, Math.max(0, limit));
}

/**
 * Run `worker` over `items` with at most `concurrency` in flight. Stops
 * starting new items once `keepGoing()` returns false; items already started
 * are awaited. Returns how many items were started.
 */
export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
  keepGoing: () => boolean = () => true
): Promise<number> {
  let next = 0;
  const lanes = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (next < items.length && keepGoing()) {
        const item = items[next++];
        await worker(item);
      }
    }
  );
  await Promise.all(lanes);
  return next;
}
