import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { checkPushable, pushPost, type PushDeps } from './push.js';
import { draftFixture } from './testing/fixtures.js';
import { MemoryStore } from './testing/memory-store.js';
import type { Post } from './types.js';

const SECRET = 'test-webhook-secret-value';
const POST_ID = '22222222-2222-2222-2222-222222222222';

let server: Server;
let base = '';
const hits: { path: string; body: string }[] = [];
/** Status to answer per path, consumed in order; default 200. */
const script: Record<string, number[]> = {};

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const path = req.url ?? '/';
      hits.push({ path, body });
      const status = script[path]?.shift() ?? 200;
      res.writeHead(status, { 'Content-Type': 'text/plain' }).end(status === 200 ? 'Accepted' : 'error');
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

function seed(over: Partial<Post> = {}): { store: MemoryStore; deps: PushDeps } {
  const store = new MemoryStore();
  store.targets = [
    { platform: 'x', url: `${base}/x`, enabled: true, reels: false },
    { platform: 'linkedin', url: `${base}/linkedin`, enabled: true, reels: false },
  ];
  store.posts.push({
    id: POST_ID,
    track: 'eatpal',
    product: 'eatpal',
    run_date: '2026-11-17',
    topic_id: null,
    format: 'text_carousel',
    status: 'dry_run',
    copy: draftFixture().copy,
    slides: draftFixture().slides,
    image_urls: ['https://cdn.test/1.png', 'https://cdn.test/2.png'],
    video_url: null,
    skip_reason: null,
    skip_stage: null,
    attempts: 1,
    dry_run: true,
    notified_at: null,
    created_at: '2026-11-17T18:15:00.000Z',
    ...over,
  });
  return {
    store,
    deps: { store, webhookSecret: SECRET, dryRun: false, sleep: async () => {}, log: () => {} },
  };
}

describe('checkPushable', () => {
  it('accepts a finished dry-run post', async () => {
    const { deps } = seed();
    const r = await checkPushable(deps, POST_ID);
    expect(r.ok).toBe(true);
  });

  it('refuses while the service is in dry-run mode, and says how to change it', async () => {
    const { deps } = seed();
    const r = await checkPushable({ ...deps, dryRun: true }, POST_ID);
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(!r.ok && r.error).toContain('VOICE_DRY_RUN');
  });

  it('refuses an unknown post, a running post and a post with nothing to send', async () => {
    const { deps } = seed();
    expect(await checkPushable(deps, '33333333-3333-3333-3333-333333333333')).toMatchObject({ ok: false, status: 404 });

    const running = seed({ status: 'rendering' });
    expect(await checkPushable(running.deps, POST_ID)).toMatchObject({ ok: false, status: 409 });

    const skipped = seed({ status: 'skipped', copy: null, image_urls: [], skip_stage: 'check' });
    const r = await checkPushable(skipped.deps, POST_ID);
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(!r.ok && r.error).toContain('skipped at check');
  });
});

describe('pushPost', () => {
  it('sends a dry-run post for real, logs it and clears the dry-run mark', async () => {
    const { store, deps } = seed();
    const post = (await store.getPost(POST_ID))!;
    const r = await pushPost(deps, post);

    expect(r.status).toBe('posted');
    expect(hits.map((h) => h.path).sort()).toEqual(['/linkedin', '/x']);
    // A real send: no test flag, so the Make scenarios do not drop it.
    for (const h of hits) expect(JSON.parse(h.body)).not.toHaveProperty('test');
    const saved = (await store.getPost(POST_ID))!;
    expect(saved).toMatchObject({ status: 'posted', dry_run: false, skip_reason: null });
    expect(store.log.filter((l) => l.ok).map((l) => l.platform).sort()).toEqual(['linkedin', 'x']);
  });

  it('never re-sends a platform that already took the post', async () => {
    const { store, deps } = seed({ status: 'partial', dry_run: false });
    await store.insertWebhookLog({ post_id: POST_ID, platform: 'x', variant: 'post', attempt: 1, http_status: 200, ok: true, response_excerpt: 'Accepted' });
    const r = await pushPost(deps, (await store.getPost(POST_ID))!);

    expect(hits.map((h) => h.path)).toEqual(['/linkedin']);
    expect(r.skippedAlreadySent).toEqual(['x']);
    expect((await store.getPost(POST_ID))!.status).toBe('posted');
  });

  it('records a push that no platform accepted as failed, with the reason', async () => {
    const { store, deps } = seed();
    script['/x'] = [500, 500];
    script['/linkedin'] = [500, 500];
    const r = await pushPost(deps, (await store.getPost(POST_ID))!);

    expect(r.status).toBe('failed');
    const saved = (await store.getPost(POST_ID))!;
    expect(saved.status).toBe('failed');
    expect(saved.skip_reason).toMatch(/^push: no platform accepted/);
    // Still marked dry run: nothing went out.
    expect(saved.dry_run).toBe(true);
  });

  it('keeps the dry-run mark when a real post for that track and day already exists', async () => {
    const { store, deps } = seed();
    store.posts.push({ ...(await store.getPost(POST_ID))!, id: '44444444-4444-4444-4444-444444444444', dry_run: false, status: 'posted' });
    await pushPost(deps, (await store.getPost(POST_ID))!);
    expect((await store.getPost(POST_ID))!).toMatchObject({ status: 'posted', dry_run: true });
  });
});
