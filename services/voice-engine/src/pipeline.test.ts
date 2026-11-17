import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { productFor, runTrack } from './pipeline.js';
import { decide, Scheduler } from './scheduler.js';
import { wireDraft } from './testing/fixtures.js';
import { harness } from './testing/pipeline-harness.js';
import type { Track } from './types.js';

let server: Server;
let hookUrl = '';
let hits = 0;
beforeAll(async () => {
  server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      hits += 1;
      res.writeHead(200).end('Accepted');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  hookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

// 12:20 in Chicago on a CST day.
const NOON = new Date('2026-11-17T18:20:00Z');

function ready(now = NOON, over = {}) {
  const h = harness(now, over);
  const src = h.store.addSourceItem({
    product: 'eatpal',
    url: 'https://tryeatpal.com/a',
    body_text: 'EatPal sorts the log by texture.',
  });
  h.store.targets = [{ platform: 'x', url: hookUrl, enabled: true, reels: false }];
  const topic = {
    topic: 'Texture first',
    angle: 'The list shows the next step',
    is_feature: false,
    source_item_ids: [src.id],
    story_ids: [],
  };
  const audit = {
    claims: [
      {
        text: 'EatPal sorts the log by texture',
        kind: 'product',
        supported: true,
        source_item_id: src.id,
        story_id: null,
      },
    ],
  };
  return { ...h, src, topic, audit };
}

describe('runTrack', () => {
  it('runs a track end to end and posts', async () => {
    const h = ready();
    h.llm.enqueue(h.topic, wireDraft({ sourceId: h.src.id }), h.audit);
    hits = 0;
    const r = await runTrack(h.deps, 'eatpal');
    expect(r.outcome).toBe('done');
    if (r.outcome !== 'done') return;
    expect(r.post).toMatchObject({
      status: 'posted',
      run_date: '2026-11-17',
      format: 'text_carousel',
      dry_run: false,
    });
    expect(r.post.image_urls).toHaveLength(5);
    expect(hits).toBe(1);
    expect(h.notifier.notices).toEqual([]);
  });

  it('cannot run the same track twice in a day: the second claim conflicts', async () => {
    const h = ready();
    h.llm.enqueue(h.topic, wireDraft({ sourceId: h.src.id }), h.audit);
    await runTrack(h.deps, 'eatpal');
    const second = await runTrack(h.deps, 'eatpal');
    expect(second).toEqual({ outcome: 'conflict', track: 'eatpal', runDate: '2026-11-17' });
    expect(h.store.posts).toHaveLength(1);
  });

  it('dry run sends nothing, ends as dry_run, and does not block the real post', async () => {
    const h = ready();
    h.llm.enqueue(h.topic, wireDraft({ sourceId: h.src.id }), h.audit);
    hits = 0;
    const dry = await runTrack(h.deps, 'eatpal', { dryRun: true });
    expect(dry.outcome === 'done' && dry.post.status).toBe('dry_run');
    expect(hits).toBe(0);
    expect(h.store.log.every((l) => l.http_status === null && !l.ok)).toBe(true);
    // The real run for the same day still gets its claim.
    h.llm.enqueue(
      { ...h.topic, topic: 'Second topic' },
      wireDraft({ sourceId: h.src.id }),
      h.audit
    );
    const real = await runTrack(h.deps, 'eatpal');
    expect(real.outcome).toBe('done');
  });

  it('a service in dry-run mode stays dry even when a caller asks for a real run', async () => {
    const h = ready(NOON, { dryRun: true });
    h.llm.enqueue(h.topic, wireDraft({ sourceId: h.src.id }), h.audit);
    hits = 0;
    const r = await runTrack(h.deps, 'eatpal', { dryRun: false });
    expect(r.outcome === 'done' && r.post.dry_run).toBe(true);
    expect(hits).toBe(0);
  });

  it('skips with a reason and notifies when the checker fails twice', async () => {
    const h = ready();
    const bait = wireDraft({ sourceId: h.src.id, linkedin: 'Sort it by texture. Agree?' });
    h.llm.enqueue(h.topic, bait, h.audit, bait, h.audit);
    const r = await runTrack(h.deps, 'eatpal');
    expect(r.outcome === 'done' && r.post).toMatchObject({
      status: 'skipped',
      skip_stage: 'check',
    });
    if (r.outcome === 'done') expect(r.post.skip_reason).toContain('agree_q');
    expect(h.notifier.notices).toHaveLength(1);
    expect(h.notifier.notices[0]).toMatchObject({ stage: 'check' });
  });

  it('retries a stage once on error, then skips', async () => {
    const h = ready();
    h.llm.enqueue(new Error('overloaded'), new Error('overloaded'));
    const r = await runTrack(h.deps, 'eatpal');
    expect(r.outcome === 'done' && r.post).toMatchObject({
      status: 'skipped',
      skip_stage: 'topic',
      skip_reason: 'overloaded',
    });
    expect(h.llm.calls).toHaveLength(2);
  });

  it('recovers when a stage fails once', async () => {
    const h = ready();
    h.llm.enqueue(new Error('overloaded'), h.topic, wireDraft({ sourceId: h.src.id }), h.audit);
    const r = await runTrack(h.deps, 'eatpal');
    expect(r.outcome === 'done' && r.post.status).toBe('posted');
  });

  it('marks the post failed when no platform accepts it, and notifies', async () => {
    const h = ready();
    h.store.targets = [
      { platform: 'x', url: 'http://127.0.0.1:1/down', enabled: true, reels: false },
    ];
    h.llm.enqueue(h.topic, wireDraft({ sourceId: h.src.id }), h.audit);
    const r = await runTrack(h.deps, 'eatpal');
    expect(r.outcome === 'done' && r.post).toMatchObject({
      status: 'failed',
      skip_stage: 'dispatch',
    });
    expect(h.notifier.notices).toHaveLength(1);
  });
});

describe('platform rotation', () => {
  const platformTrack = (rotation_index: number): Track => ({
    key: 'platform',
    enabled: true,
    post_time: '16:30',
    timezone: 'America/Chicago',
    products: ['brikly', 'printyx', 'agentbio'],
    rotation_index,
  });

  it('picks products[rotation_index % 3]', () => {
    expect([0, 1, 2, 3, 4].map((i) => productFor(platformTrack(i)))).toEqual([
      'brikly',
      'printyx',
      'agentbio',
      'brikly',
      'printyx',
    ]);
  });

  it('advances only when the post went out', async () => {
    const h = harness(new Date('2026-11-17T22:40:00Z'));
    const src = h.store.addSourceItem({ product: 'brikly', url: 'https://brikly.net/a' });
    h.store.targets = [{ platform: 'x', url: hookUrl, enabled: true, reels: false }];
    const audit = {
      claims: [
        { text: 'x', kind: 'product', supported: true, source_item_id: src.id, story_id: null },
      ],
    };
    const topic = {
      topic: 'Pipelines',
      angle: 'x',
      is_feature: false,
      source_item_ids: [src.id],
      story_ids: [],
    };

    // A skipped day leaves the rotation where it was.
    h.llm.enqueue(new Error('down'), new Error('down'));
    await runTrack(h.deps, 'platform');
    expect(h.store.tracks.find((t) => t.key === 'platform')!.rotation_index).toBe(0);

    // A dry run does not advance it either.
    h.llm.enqueue(topic, wireDraft({ sourceId: src.id }), audit);
    await runTrack(h.deps, 'platform', { dryRun: true });
    expect(h.store.tracks.find((t) => t.key === 'platform')!.rotation_index).toBe(0);

    // A real post the next day does.
    // The dry run used the only page; a page used in the last 30 days is not reused.
    h.deps.now = () => new Date('2026-11-18T22:40:00Z');
    const src2 = h.store.addSourceItem({ product: 'brikly', url: 'https://brikly.net/b' });
    const audit2 = {
      claims: [
        { text: 'x', kind: 'product', supported: true, source_item_id: src2.id, story_id: null },
      ],
    };
    // Formats alternate, so day two is a single image.
    const single = wireDraft({
      sourceId: src2.id,
      slides: [
        {
          role: 'single',
          headline: 'Wire the CRM to the work, not the other way round.',
          body: null,
          asset_id: null,
        },
      ],
    });
    h.llm.enqueue({ ...topic, topic: 'Another', source_item_ids: [src2.id] }, single, audit2);
    const r = await runTrack(h.deps, 'platform');
    expect(r.outcome === 'done' && [r.post.status, r.post.skip_stage, r.post.skip_reason]).toEqual([
      'posted',
      null,
      null,
    ]);
    expect(h.store.tracks.find((t) => t.key === 'platform')!.rotation_index).toBe(1);
  });
});

describe('scheduler', () => {
  const eatpal: Track = {
    key: 'eatpal',
    enabled: true,
    post_time: '08:30',
    timezone: 'America/Chicago',
    products: ['eatpal'],
    rotation_index: 0,
  };
  const none = async () => false;

  it('waits before the post time and runs after it', async () => {
    expect((await decide([eatpal], new Date('2026-11-17T14:29:00Z'), none))[0]!.action).toBe(
      'wait'
    ); // 08:29 CST
    expect((await decide([eatpal], new Date('2026-11-17T14:31:00Z'), none))[0]!.action).toBe('run'); // 08:31 CST
  });

  it('follows the wall clock across the DST change', async () => {
    // 2026-03-08 is the first day of CDT. 13:31Z is 08:31 CDT that day but 07:31 CST the day before.
    expect((await decide([eatpal], new Date('2026-03-07T13:31:00Z'), none))[0]!.action).toBe(
      'wait'
    );
    expect((await decide([eatpal], new Date('2026-03-08T13:31:00Z'), none))[0]).toMatchObject({
      action: 'run',
      runDate: '2026-03-08',
    });
    // And back: 2026-11-01 is the first day of CST.
    expect((await decide([eatpal], new Date('2026-10-31T13:31:00Z'), none))[0]!.action).toBe('run');
    expect((await decide([eatpal], new Date('2026-11-01T13:31:00Z'), none))[0]!.action).toBe(
      'wait'
    );
  });

  it('records a missed window instead of posting more than three hours late', async () => {
    expect((await decide([eatpal], new Date('2026-11-17T17:29:00Z'), none))[0]!.action).toBe('run'); // 11:29, 2h59m late
    expect((await decide([eatpal], new Date('2026-11-17T17:31:00Z'), none))[0]!.action).toBe(
      'miss'
    ); // 11:31
  });

  it('does nothing for a track that already has its post or is off', async () => {
    expect(
      (await decide([eatpal], new Date('2026-11-17T15:00:00Z'), async () => true))[0]!.action
    ).toBe('done');
    expect(
      (await decide([{ ...eatpal, enabled: false }], new Date('2026-11-17T15:00:00Z'), none))[0]!
        .action
    ).toBe('off');
  });

  it('a live tick records a missed day as skipped and emails once', async () => {
    const h = harness(new Date('2026-11-17T23:00:00Z')); // 17:00 CST: gradethread and eatpal missed, platform due
    const s = new Scheduler(h.deps);
    s.launch = () => true; // keep the due track from running
    await s.tick();
    await s.tick();
    const skipped = h.store.posts.filter((p) => p.status === 'skipped');
    expect(skipped.map((p) => [p.track, p.skip_reason]).sort()).toEqual([
      ['eatpal', 'missed window'],
      ['gradethread', 'missed window'],
    ]);
    expect(h.notifier.notices).toHaveLength(2);
  });

  it('a dry-run tick does not record missed days and runs a due track once per day', async () => {
    const h = harness(new Date('2026-11-17T22:40:00Z'), { dryRun: true });
    const s = new Scheduler(h.deps);
    const launched: string[] = [];
    s.launch = (t) => {
      launched.push(t);
      void h.store.claimPost({ track: t, product: 'brikly', runDate: '2026-11-17', dryRun: true });
      return true;
    };
    await s.tick();
    await s.tick();
    expect(launched).toEqual(['platform']);
    expect(h.store.posts.filter((p) => p.status === 'skipped')).toHaveLength(0);
  });
});
