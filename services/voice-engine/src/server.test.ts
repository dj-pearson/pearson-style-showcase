import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, RunLimiter, secretMatches } from './server.js';
import { MemoryStore } from './testing/memory-store.js';
import type { TrackKey } from './types.js';

const SECRET = 'run-secret-value-1234567';
let server: Server | null = null;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

async function start(
  over: {
    dryRun?: boolean;
    store?: MemoryStore;
    limiter?: RunLimiter;
    launch?: (t: TrackKey) => boolean;
    push?: (id: string) => Promise<{ ok: true } | { ok: false; status: number; error: string }>;
  } = {}
) {
  const launched: { track: TrackKey; dryRun: boolean }[] = [];
  const store = over.store ?? new MemoryStore();
  server = createApp({
    store,
    runSecret: SECRET,
    dryRun: over.dryRun ?? false,
    limiter: over.limiter,
    now: () => new Date('2026-11-17T18:00:00Z'),
    launch: (track, opts) => {
      launched.push({ track, dryRun: opts.dryRun });
      return over.launch ? over.launch(track) : true;
    },
    push: over.push,
  });
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  const run = (body: unknown, secret: string | null = SECRET) =>
    fetch(`${base}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret !== null ? { 'x-run-secret': secret } : {}),
      },
      body: JSON.stringify(body),
    });
  return { base, run, launched, store };
}

describe('server', () => {
  it('GET /health reports ok, version and dry run, nothing secret', async () => {
    const { base } = await start({ dryRun: true });
    const res = await fetch(`${base}/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, version: '0.1.0', dryRun: true });
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('POST /run needs the secret', async () => {
    const { run, launched } = await start();
    expect((await run({ track: 'eatpal' }, null)).status).toBe(401);
    expect((await run({ track: 'eatpal' }, 'wrong-secret')).status).toBe(401);
    expect(launched).toEqual([]);
  });

  it('POST /run starts the track and answers 202', async () => {
    const { run, launched } = await start();
    const res = await run({ track: 'eatpal', dryRun: true });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ accepted: true, track: 'eatpal', dryRun: true });
    expect(launched).toEqual([{ track: 'eatpal', dryRun: true }]);
  });

  it('a dry-run service never starts a real run', async () => {
    const { run, launched } = await start({ dryRun: true });
    await run({ track: 'eatpal', dryRun: false });
    expect(launched).toEqual([{ track: 'eatpal', dryRun: true }]);
  });

  it('rejects an unknown track', async () => {
    const { run } = await start();
    expect((await run({ track: 'tiktok' })).status).toBe(400);
  });

  it('answers 409 when the track already posted today', async () => {
    const store = new MemoryStore();
    await store.claimPost({
      track: 'eatpal',
      product: 'eatpal',
      runDate: '2026-11-17',
      dryRun: false,
    });
    const { run } = await start({ store });
    expect((await run({ track: 'eatpal' })).status).toBe(409);
    expect((await run({ track: 'eatpal', dryRun: true })).status).toBe(202);
  });

  it('answers 409 when the track is already running here', async () => {
    const { run } = await start({ launch: () => false });
    expect((await run({ track: 'eatpal' })).status).toBe(409);
  });

  it('allows at most 6 runs per hour', async () => {
    let t = 0;
    const { run } = await start({ limiter: new RunLimiter(6, () => t) });
    for (let i = 0; i < 6; i++)
      expect((await run({ track: 'eatpal', dryRun: true })).status).toBe(202);
    expect((await run({ track: 'eatpal', dryRun: true })).status).toBe(429);
    t = 3_600_000;
    expect((await run({ track: 'eatpal', dryRun: true })).status).toBe(202);
  });

  it('serves nothing else', async () => {
    const { base } = await start();
    expect((await fetch(`${base}/`)).status).toBe(404);
    expect((await fetch(`${base}/run`)).status).toBe(405);
  });
});

describe('POST /push', () => {
  const ID = '22222222-2222-2222-2222-222222222222';
  const push = (base: string, body: unknown, secret: string | null) =>
    fetch(`${base}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(secret !== null ? { 'x-run-secret': secret } : {}) },
      body: JSON.stringify(body),
    });

  it('needs the run secret and a post id, and starts the push', async () => {
    const asked: string[] = [];
    const { base } = await start({
      push: async (id) => {
        asked.push(id);
        return { ok: true };
      },
    });
    expect((await push(base, { postId: ID }, null)).status).toBe(401);
    expect((await push(base, { postId: 'nope' }, SECRET)).status).toBe(400);
    expect(asked).toEqual([]);

    const res = await push(base, { postId: ID }, SECRET);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ accepted: true, postId: ID });
    expect(asked).toEqual([ID]);
  });

  it('passes a refusal through with its status and reason', async () => {
    const { base } = await start({
      push: async () => ({ ok: false, status: 409, error: 'VOICE_DRY_RUN is on' }),
    });
    const res = await push(base, { postId: ID }, SECRET);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'VOICE_DRY_RUN is on' });
  });
});

describe('secretMatches', () => {
  it('compares exactly', () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches(SECRET + 'x', SECRET)).toBe(false);
    expect(secretMatches('', SECRET)).toBe(false);
    expect(secretMatches(undefined, SECRET)).toBe(false);
  });
});
