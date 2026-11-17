import { checkWithRewrite } from './checker.js';
import { localParts } from './clock.js';
import { dispatch } from './dispatch.js';
import { SkipError } from './errors.js';
import { chooseFormat } from './format.js';
import type { Llm } from './llm.js';
import type { Media } from './media.js';
import type { Notifier } from './notify.js';
import { renderPost } from './render/index.js';
import type { SlideRenderer } from './render/slides.js';
import { refreshSources, type FetchText } from './sources/refresh.js';
import { isProduct } from './sources/products.js';
import type { Store } from './store.js';
import { pickTopic } from './topics.js';
import type { Draft, Post, PostStatus, Topic, Track, TrackKey } from './types.js';
import type { Voice } from './voice.js';
import { write } from './writer.js';

export interface PipelineDeps {
  store: Store;
  llm: Llm;
  voice: Voice;
  media: Media;
  renderer: SlideRenderer;
  notifier: Notifier;
  webhookSecret: string;
  handle: string;
  denyTerms: string[];
  /** Service-wide dry run. A dry run is never turned into a real one by a caller. */
  dryRun: boolean;
  now?: () => Date;
  fetcher?: FetchText;
  /** Passed to dispatch; tests shorten the 30s retry delay. */
  sleep?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
  /** Stand-in for renderPost in tests; the real one is covered by render.test.ts. */
  render?: typeof renderPost;
}

export type RunOutcome =
  | { outcome: 'conflict'; track: TrackKey; runDate: string }
  | { outcome: 'disabled'; track: TrackKey }
  | { outcome: 'done'; post: Post };

/** The product a track covers on its next post. The platform track rotates. */
export function productFor(track: Track): string {
  if (track.products.length === 0) throw new Error(`track ${track.key} has no products`);
  return track.products[track.rotation_index % track.products.length]!;
}

class StageFailed extends Error {
  constructor(
    public readonly stage: string,
    public readonly reason: string
  ) {
    super(`${stage}: ${reason}`);
  }
}

const describe = (err: unknown) =>
  (err instanceof Error ? err.message : String(err)).slice(0, 1000);

/**
 * Run one track for one day: claim the day, then sources, topic, write and
 * check, render, dispatch. Each stage is retried once on error; a stage that
 * still fails, or decides there is nothing honest to post, marks the post
 * skipped with its reason and tells Dan.
 */
export async function runTrack(
  deps: PipelineDeps,
  trackKey: TrackKey,
  opts: { runDate?: string; dryRun?: boolean; force?: boolean } = {}
): Promise<RunOutcome> {
  const log = deps.log ?? ((m: string) => console.log(m));
  const now = deps.now ?? (() => new Date());
  const dryRun = deps.dryRun || opts.dryRun === true;
  const track = await deps.store.getTrack(trackKey);
  if (!track) throw new Error(`no track ${trackKey}`);
  if (!track.enabled && !opts.force) return { outcome: 'disabled', track: trackKey };
  const runDate = opts.runDate ?? localParts(now(), track.timezone).date;
  const product = productFor(track);

  const claimed = await deps.store.claimPost({ track: trackKey, product, runDate, dryRun });
  if (!claimed) return { outcome: 'conflict', track: trackKey, runDate };
  const post: Post = { ...claimed };
  let attempts = 0;

  const set = async (patch: Partial<Post>) => {
    Object.assign(post, patch);
    await deps.store.updatePost(post.id, patch);
  };

  async function stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
    let last: unknown;
    for (let i = 0; i < 2; i++) {
      attempts += 1;
      try {
        return await fn();
      } catch (err) {
        if (err instanceof SkipError) throw new StageFailed(name, err.reason);
        last = err;
        log(
          `[voice] ${trackKey} ${runDate} stage ${name} attempt ${i + 1} failed: ${describe(err)}`
        );
      }
    }
    throw new StageFailed(name, describe(last));
  }

  try {
    await stage('sources', async () => {
      if (isProduct(product))
        await refreshSources(deps.store, {
          products: [product],
          fetcher: deps.fetcher,
          now: now(),
        });
    });

    const topic: Topic = await stage('topic', () =>
      pickTopic({ store: deps.store, llm: deps.llm, voice: deps.voice, now }, trackKey, product)
    );
    await set({ topic_id: topic.id, status: 'writing', attempts });

    const sourceItems = (await deps.store.listSourceItems(product)).filter((s) =>
      topic.source_item_ids.includes(s.id)
    );
    const stories = (await deps.store.listConfirmedStories()).filter((s) =>
      topic.story_ids.includes(s.id)
    );
    const assets = await deps.store.listAssets();
    const screenshots = assets.filter((a) => a.kind === 'screenshot' && a.product === product);
    const format = chooseFormat(
      trackKey,
      product,
      screenshots.length > 0,
      topic.is_feature,
      await deps.store.lastFormat(trackKey)
    );
    const writeInput = {
      track: trackKey,
      product,
      topic,
      sourceItems,
      stories,
      format,
      screenshots,
    };
    const ctx = { track: trackKey, sourceItems, stories };

    const draft: Draft = await stage('write', async () => {
      const first = await write({ llm: deps.llm, voice: deps.voice }, writeInput);
      const checked = await checkWithRewrite(
        { llm: deps.llm, voice: deps.voice, denyTerms: deps.denyTerms },
        first,
        ctx,
        (findings) => write({ llm: deps.llm, voice: deps.voice }, { ...writeInput, findings })
      );
      if (!checked.ok) throw new SkipError(`checker: ${checked.reasons.slice(0, 5).join('; ')}`);
      return checked.draft;
    }).catch((err: unknown) => {
      // The check is its own stage in the history, even though it runs inside write's retry.
      if (err instanceof StageFailed && err.reason.startsWith('checker: '))
        throw new StageFailed('check', err.reason.slice(9));
      throw err;
    });
    await set({ format, copy: draft.copy, slides: draft.slides, status: 'rendering', attempts });

    const render = deps.render ?? renderPost;
    const rendered = await stage('render', () =>
      render(
        { renderer: deps.renderer, media: deps.media, handle: deps.handle },
        { id: post.id, product, format, slides: draft.slides },
        assets
      )
    );
    await set({
      image_urls: rendered.imageUrls,
      video_url: rendered.videoUrl,
      status: 'dispatching',
      attempts,
    });

    const result = await stage('dispatch', async () => {
      const r = await dispatch(
        { store: deps.store, webhookSecret: deps.webhookSecret, dryRun, sleep: deps.sleep, now },
        post
      );
      if (r.status === 'failed')
        throw new Error(
          `no platform accepted the post (${r.failed.join(', ') || 'no enabled targets'})`
        );
      return r;
    });
    const status: PostStatus = result.status;
    await set({ status, attempts });
    if (!dryRun && (status === 'posted' || status === 'partial'))
      await deps.store.advanceRotation(trackKey);
    log(
      `[voice] ${trackKey} ${runDate} ${status}: sent ${result.sent.join(', ') || 'nothing'}${result.failed.length ? `; failed ${result.failed.join(', ')}` : ''}`
    );
  } catch (err) {
    const failed = err instanceof StageFailed ? err : new StageFailed('unknown', describe(err));
    // A dispatch that reached no platform is a failure; everything earlier is a skip.
    const status: PostStatus = failed.stage === 'dispatch' ? 'failed' : 'skipped';
    await set({ status, skip_reason: failed.reason, skip_stage: failed.stage, attempts });
    log(`[voice] ${trackKey} ${runDate} ${status} at ${failed.stage}: ${failed.reason}`);
    await deps.notifier.skipped({ post, stage: failed.stage, reason: failed.reason });
  }
  return { outcome: 'done', post: { ...post } };
}

/** Record a day the service missed entirely, without posting late. */
export async function recordMissed(
  deps: Pick<PipelineDeps, 'store' | 'notifier'>,
  track: Track,
  runDate: string
): Promise<Post | null> {
  const post = await deps.store.claimPost({
    track: track.key,
    product: productFor(track),
    runDate,
    dryRun: false,
  });
  if (!post) return null;
  const reason = 'missed window';
  await deps.store.updatePost(post.id, {
    status: 'skipped',
    skip_reason: reason,
    skip_stage: 'schedule',
  });
  await deps.notifier.skipped({ post, stage: 'schedule', reason });
  return { ...post, status: 'skipped', skip_reason: reason, skip_stage: 'schedule' };
}
