import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildDeliveries, dispatch, sign } from './dispatch.js';
import { draftFixture } from './testing/fixtures.js';
import { MemoryStore } from './testing/memory-store.js';
import type { Platform, Post, WebhookTarget } from './types.js';

const SECRET = 'test-webhook-secret-value';

interface Hit {
  path: string;
  body: string;
  headers: IncomingMessage['headers'];
}

let server: Server;
let base = '';
const hits: Hit[] = [];
/** Status to answer per path, consumed in order; default 200. */
const script: Record<string, number[]> = {};

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const path = req.url ?? '/';
      hits.push({ path, body, headers: req.headers });
      const status = script[path]?.shift() ?? 200;
      res
        .writeHead(status, { 'Content-Type': 'text/plain' })
        .end(status === 200 ? 'Accepted' : 'scenario error');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  hits.length = 0;
  for (const k of Object.keys(script)) delete script[k];
});

function postFixture(over: Partial<Post> = {}): Post {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    track: 'eatpal',
    product: 'eatpal',
    run_date: '2026-11-17',
    topic_id: null,
    format: 'text_carousel',
    status: 'dispatching',
    copy: draftFixture().copy,
    slides: draftFixture().slides,
    image_urls: [
      'https://cdn.test/1.png',
      'https://cdn.test/2.png',
      'https://cdn.test/3.png',
      'https://cdn.test/4.png',
      'https://cdn.test/5.png',
    ],
    video_url: 'https://cdn.test/video.mp4',
    skip_reason: null,
    skip_stage: null,
    attempts: 0,
    dry_run: false,
    notified_at: null,
    created_at: '2026-11-17T18:15:00Z',
    ...over,
  };
}

function targets(platforms: Platform[], over: Partial<WebhookTarget> = {}): WebhookTarget[] {
  return platforms.map((p) => ({
    platform: p,
    url: `${base}/${p}`,
    enabled: true,
    reels: false,
    ...over,
  }));
}

const deps = (store: MemoryStore, dryRun = false) => ({
  store,
  webhookSecret: SECRET,
  dryRun,
  sleep: async () => {},
  now: () => new Date('2026-11-17T18:15:02.000Z'),
});

describe('buildDeliveries', () => {
  const now = new Date('2026-11-17T18:15:02.000Z');
  it('applies the per-platform media rules', () => {
    const all = targets(['x', 'linkedin', 'instagram', 'facebook', 'threads', 'youtube']);
    const d = Object.fromEntries(
      buildDeliveries(postFixture(), all, now).map((x) => [
        `${x.platform}:${x.variant}`,
        x.payload.data,
      ])
    );
    expect(d['instagram:post']).toMatchObject({
      media_type: 'carousel',
      image_urls: postFixture().image_urls,
    });
    expect(d['linkedin:post']).toMatchObject({ media_type: 'carousel' });
    expect(d['facebook:post']).toMatchObject({ media_type: 'carousel' });
    expect(d['x:post']).toMatchObject({ media_type: 'carousel' });
    expect(d['x:post']!.image_urls).toHaveLength(4);
    expect(d['threads:post']).toMatchObject({
      media_type: 'image',
      image_url: 'https://cdn.test/1.png',
    });
    expect(d['threads:post']!.image_urls).toBeUndefined();
    expect(d['youtube:post']).toMatchObject({
      media_type: 'video',
      video_url: 'https://cdn.test/video.mp4',
      title: postFixture().copy!.youtube.title,
    });
    expect(d['instagram:reel']).toBeUndefined();
  });

  it('sends single images as images and skips youtube without a video', () => {
    const post = postFixture({
      format: 'single_image',
      image_urls: ['https://cdn.test/1.png'],
      video_url: null,
    });
    const d = buildDeliveries(post, targets(['instagram', 'x', 'youtube']), now);
    expect(d.map((x) => [x.platform, x.payload.data.media_type])).toEqual([
      ['instagram', 'image'],
      ['x', 'image'],
    ]);
  });

  it('adds an instagram reel only when reels is on and a video exists', () => {
    const d = buildDeliveries(postFixture(), targets(['instagram'], { reels: true }), now);
    expect(d.map((x) => x.variant)).toEqual(['post', 'reel']);
    expect(d[1]!.payload.data).toMatchObject({
      media_type: 'video',
      video_url: 'https://cdn.test/video.mp4',
    });
  });

  it('leaves out disabled targets and targets with no url', () => {
    const t = [
      ...targets(['x']),
      { platform: 'linkedin' as const, url: '', enabled: true, reels: false },
      { platform: 'threads' as const, url: `${base}/threads`, enabled: false, reels: false },
    ];
    expect(buildDeliveries(postFixture(), t, now).map((x) => x.platform)).toEqual(['x']);
  });

  it('never includes a test field on a real send', () => {
    for (const d of buildDeliveries(postFixture(), targets(['x', 'instagram']), now)) {
      expect('test' in d.payload).toBe(false);
      expect(JSON.stringify(d.payload)).not.toContain('"test"');
    }
  });
});

describe('dispatch', () => {
  it('signs the raw body and sets the idempotency key', async () => {
    const store = new MemoryStore();
    store.targets = targets(['instagram'], { reels: true });
    const result = await dispatch(deps(store), postFixture());
    expect(result.status).toBe('posted');
    expect(hits).toHaveLength(2);
    for (const hit of hits) {
      expect(hit.headers['x-content-signature']).toBe(sign(hit.body, SECRET));
      expect(hit.headers['content-type']).toBe('application/json');
    }
    expect(hits.map((h) => h.headers['x-idempotency-key'])).toEqual([
      '11111111-1111-1111-1111-111111111111:instagram',
      '11111111-1111-1111-1111-111111111111:instagram:reel',
    ]);
    expect(JSON.parse(hits[0]!.body)).toMatchObject({
      event: 'social.published',
      platform: 'instagram',
      data: { id: '11111111-1111-1111-1111-111111111111', track: 'eatpal' },
    });
  });

  it('retries a failure once and logs both attempts', async () => {
    const store = new MemoryStore();
    store.targets = targets(['x']);
    script['/x'] = [500, 200];
    const result = await dispatch(deps(store), postFixture());
    expect(result).toMatchObject({ status: 'posted', sent: ['x'] });
    expect(store.log.map((l) => [l.attempt, l.http_status, l.ok])).toEqual([
      [1, 500, false],
      [2, 200, true],
    ]);
  });

  it('gives up after the retry and reports partial when another platform succeeded', async () => {
    const store = new MemoryStore();
    store.targets = targets(['x', 'linkedin']);
    script['/x'] = [500, 502];
    const result = await dispatch(deps(store), postFixture());
    expect(result).toMatchObject({ status: 'partial', sent: ['linkedin'], failed: ['x'] });
    expect(hits.filter((h) => h.path === '/x')).toHaveLength(2);
  });

  it('reports failed when no platform succeeded', async () => {
    const store = new MemoryStore();
    store.targets = targets(['x']);
    script['/x'] = [500, 500];
    expect((await dispatch(deps(store), postFixture())).status).toBe('failed');
  });

  it('never sends again to a platform that already accepted the post', async () => {
    const store = new MemoryStore();
    store.targets = targets(['x', 'linkedin']);
    script['/x'] = [500, 500];
    await dispatch(deps(store), postFixture());
    hits.length = 0;
    const second = await dispatch(deps(store), postFixture());
    // Only x is sent again; linkedin already accepted the post.
    expect(hits.map((h) => h.path)).toEqual(['/x']);
    expect(second.skippedAlreadySent).toEqual(['linkedin']);
    expect(second.status).toBe('posted');
  });

  it('times out a hanging webhook and retries', async () => {
    const hang = createServer(() => {});
    await new Promise<void>((r) => hang.listen(0, '127.0.0.1', r));
    try {
      const store = new MemoryStore();
      store.targets = [
        {
          platform: 'x',
          url: `http://127.0.0.1:${(hang.address() as AddressInfo).port}/x`,
          enabled: true,
          reels: false,
        },
      ];
      const result = await dispatch({ ...deps(store), timeoutMs: 200 }, postFixture());
      expect(result.status).toBe('failed');
      expect(store.log.map((l) => [l.attempt, l.http_status, l.response_excerpt])).toEqual([
        [1, null, 'timed out after 0.2s'],
        [2, null, 'timed out after 0.2s'],
      ]);
    } finally {
      hang.closeAllConnections();
      await new Promise<void>((r) => hang.close(() => r()));
    }
  });

  it('in dry run logs the payloads and sends nothing', async () => {
    const store = new MemoryStore();
    store.targets = targets(['x', 'instagram', 'youtube']);
    const result = await dispatch(deps(store, true), postFixture());
    expect(result.status).toBe('dry_run');
    expect(hits).toHaveLength(0);
    expect(store.log).toHaveLength(3);
    for (const l of store.log) expect(l).toMatchObject({ http_status: null, ok: false });
    expect((store.log[0]!.payload as { platform: string }).platform).toBe('x');
  });
});
