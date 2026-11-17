import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { localParts } from './clock.js';
import { PACKAGE_ROOT } from './paths.js';
import type { Store } from './store.js';
import { TRACKS, type TrackKey } from './types.js';

export const RUN_LIMIT_PER_HOUR = 6;
const MAX_BODY = 4096;

export const VERSION: string = (() => {
  try {
    return (
      JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }
    ).version;
  } catch {
    return 'unknown';
  }
})();

/** Constant-time comparison of a presented secret with the expected one. */
export function secretMatches(presented: string | undefined, expected: string): boolean {
  if (!presented) return false;
  // Hash both so the comparison length never depends on the input.
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Sliding one-hour window over accepted /run calls. */
export class RunLimiter {
  private readonly times: number[] = [];
  constructor(
    private readonly limit = RUN_LIMIT_PER_HOUR,
    private readonly now: () => number = Date.now
  ) {}
  take(): boolean {
    const t = this.now();
    while (this.times.length && t - this.times[0]! >= 3_600_000) this.times.shift();
    if (this.times.length >= this.limit) return false;
    this.times.push(t);
    return true;
  }
}

export interface ServerDeps {
  store: Store;
  runSecret: string;
  dryRun: boolean;
  /** Start a track in the background. False when it is already running here. */
  launch: (track: TrackKey, opts: { dryRun: boolean; force: boolean }) => boolean;
  /**
   * Push an existing post to the webhooks for real. Resolves once the post is
   * checked; the sending itself carries on in the background.
   */
  push?: (postId: string) => Promise<{ ok: true } | { ok: false; status: number; error: string }>;
  limiter?: RunLimiter;
  now?: () => Date;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res
    .writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    .end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error('body too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * GET /health, POST /run (the admin's "Post now") and POST /push (the admin's
 * "Push to webhooks" on an existing post). Nothing else. Both POSTs answer 202
 * as soon as the work starts; progress shows in the admin's Activity tab.
 */
export function createApp(deps: ServerDeps): Server {
  const limiter = deps.limiter ?? new RunLimiter();
  return createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    try {
      if (req.method === 'GET' && path === '/health') {
        return send(res, 200, { ok: true, version: VERSION, dryRun: deps.dryRun });
      }
      if (path === '/run') {
        if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
        const header = req.headers['x-run-secret'];
        if (!secretMatches(Array.isArray(header) ? header[0] : header, deps.runSecret)) {
          return send(res, 401, { error: 'unauthorized' });
        }
        let body: { track?: unknown; dryRun?: unknown };
        try {
          body = JSON.parse((await readBody(req)) || '{}');
        } catch {
          return send(res, 400, { error: 'invalid JSON body' });
        }
        const track = body.track;
        if (typeof track !== 'string' || !(TRACKS as readonly string[]).includes(track)) {
          return send(res, 400, { error: `track must be one of ${TRACKS.join(', ')}` });
        }
        if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean')
          return send(res, 400, { error: 'dryRun must be a boolean' });
        const dryRun = deps.dryRun || body.dryRun === true;
        if (!limiter.take())
          return send(res, 429, { error: `at most ${RUN_LIMIT_PER_HOUR} runs per hour` });

        const t = await deps.store.getTrack(track as TrackKey);
        if (!t) return send(res, 404, { error: 'no such track' });
        if (!dryRun) {
          const today = localParts((deps.now ?? (() => new Date()))(), t.timezone).date;
          if (await deps.store.findPost(track as TrackKey, today, false)) {
            return send(res, 409, { error: `${track} already has a post today` });
          }
        }
        // Post now runs even a track that is switched off: Dan asked for it.
        if (!deps.launch(track as TrackKey, { dryRun, force: true })) {
          return send(res, 409, { error: `${track} is already running` });
        }
        return send(res, 202, { accepted: true, track, dryRun });
      }
      if (path === '/push') {
        if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
        const header = req.headers['x-run-secret'];
        if (!secretMatches(Array.isArray(header) ? header[0] : header, deps.runSecret)) {
          return send(res, 401, { error: 'unauthorized' });
        }
        if (!deps.push) return send(res, 404, { error: 'not found' });
        let body: { postId?: unknown };
        try {
          body = JSON.parse((await readBody(req)) || '{}');
        } catch {
          return send(res, 400, { error: 'invalid JSON body' });
        }
        const postId = body.postId;
        if (typeof postId !== 'string' || !/^[0-9a-f-]{36}$/i.test(postId)) {
          return send(res, 400, { error: 'postId must be a post id' });
        }
        if (!limiter.take())
          return send(res, 429, { error: `at most ${RUN_LIMIT_PER_HOUR} runs per hour` });
        const checked = await deps.push(postId);
        if (!checked.ok) return send(res, checked.status, { error: checked.error });
        return send(res, 202, { accepted: true, postId });
      }
      return send(res, 404, { error: 'not found' });
    } catch (err) {
      console.error('[voice] request failed', err instanceof Error ? err.message : String(err));
      return send(res, 500, { error: 'internal error' });
    }
  });
}

async function main(): Promise<void> {
  const { loadConfig, ConfigError } = await import('./config.js');
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
  const { buildRuntime } = await import('./runtime.js');
  const rt = buildRuntime(config);
  rt.scheduler.start();
  const app = createApp({
    store: rt.deps.store,
    runSecret: config.runSecret,
    dryRun: config.dryRun,
    launch: (track, opts) => rt.scheduler.launch(track, opts),
    push: async (postId) => {
      const { checkPushable, pushPost } = await import('./push.js');
      const pushDeps = { store: rt.deps.store, webhookSecret: config.webhookSecret, dryRun: config.dryRun };
      const checked = await checkPushable(pushDeps, postId);
      if (!checked.ok) return checked;
      void pushPost(pushDeps, checked.post).catch((err) =>
        console.error('[voice] push failed', err instanceof Error ? err.message : String(err))
      );
      return { ok: true };
    },
  });
  app.listen(config.port, () =>
    console.log(
      `[voice] listening on :${config.port} (dry run: ${config.dryRun}, model: ${config.model})`
    )
  );
  const shutdown = async () => {
    rt.scheduler.stop();
    app.close();
    await rt.deps.renderer.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main();
