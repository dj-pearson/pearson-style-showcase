import { assertEquals } from '../_shared/test-asserts.ts';
import { extractUrls, runPool, selectUrlsToCheck } from './link-check.ts';

Deno.test('extractUrls dedupes and drops trailing punctuation', () => {
  const content = 'See https://a.example/x. Also (https://b.example/y) and https://a.example/x';
  assertEquals(extractUrls(content), ['https://a.example/x', 'https://b.example/y']);
  assertEquals(extractUrls(null), []);
});

Deno.test('selectUrlsToCheck puts never-checked first, then oldest, and caps', () => {
  const last = new Map([
    ['https://old', '2026-01-01T00:00:00Z'],
    ['https://new', '2026-11-01T00:00:00Z'],
  ]);
  assertEquals(selectUrlsToCheck(['https://new', 'https://old', 'https://never'], last, 2), [
    'https://never',
    'https://old',
  ]);
});

Deno.test('runPool caps concurrency and stops when told to', async () => {
  let inFlight = 0;
  let peak = 0;
  const seen: number[] = [];
  const started = await runPool([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    seen.push(n);
    inFlight--;
  });
  assertEquals(started, 8);
  assertEquals(peak, 3);
  assertEquals(seen.length, 8);

  let budget = 2;
  const partial = await runPool(
    [1, 2, 3, 4],
    1,
    async () => {
      budget--;
    },
    () => budget > 0
  );
  assertEquals(partial, 2);
});
