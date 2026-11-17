import { describe, expect, it, vi } from 'vitest';
import { EdgeNotifier } from './notify.js';

const post = {
  id: 'p1',
  track: 'eatpal' as const,
  product: 'eatpal',
  run_date: '2026-11-17',
  dry_run: false,
};

describe('EdgeNotifier', () => {
  it('posts the post id, stage and reason to voice-notify with the service role bearer', async () => {
    const fetcher = vi.fn(async () => new Response('{"sent":true}', { status: 200 }));
    await new EdgeNotifier(
      'https://fn.test',
      'service-key',
      fetcher as unknown as typeof fetch
    ).skipped({ post, stage: 'check', reason: 'unsourced claim' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://fn.test/voice-notify');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer service-key');
    expect(JSON.parse(init.body as string)).toEqual({
      post_id: 'p1',
      stage: 'check',
      reason: 'unsourced claim',
    });
  });

  it('never emails about a dry run', async () => {
    const fetcher = vi.fn();
    await new EdgeNotifier('https://fn.test', 'k', fetcher as unknown as typeof fetch).skipped({
      post: { ...post, dry_run: true },
      stage: 'write',
      reason: 'x',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('logs and swallows a network failure or an error status', async () => {
    const logs: string[] = [];
    const down = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(
      new EdgeNotifier('https://fn.test', 'k', down as unknown as typeof fetch, (m) =>
        logs.push(m)
      ).skipped({ post, stage: 'x', reason: 'y' })
    ).resolves.toBeUndefined();
    const bad = vi.fn(async () => new Response('', { status: 500 }));
    await new EdgeNotifier('https://fn.test', 'k', bad as unknown as typeof fetch, (m) =>
      logs.push(m)
    ).skipped({ post, stage: 'x', reason: 'y' });
    expect(logs).toEqual([
      '[voice] notify failed for p1: ECONNREFUSED',
      '[voice] notify failed for p1: HTTP 500',
    ]);
  });
});
