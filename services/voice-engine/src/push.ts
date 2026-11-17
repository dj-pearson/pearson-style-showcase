import { dispatch, type DispatchResult } from './dispatch.js';
import type { Store } from './store.js';
import type { Post, PostStatus } from './types.js';

/**
 * Push an existing post to the webhooks for real (Admin > Voice > Activity >
 * Push to webhooks). For a dry run Dan wants out after all, or a run whose
 * dispatch failed or only partly went out. It uses the same dispatcher as a
 * scheduled run, so a platform that already took this post is skipped, a
 * failure is retried once and every attempt is logged.
 */

const IN_FLIGHT: readonly PostStatus[] = ['claimed', 'writing', 'rendering', 'dispatching'];

export interface PushDeps {
  store: Store;
  webhookSecret: string;
  /** The service's VOICE_DRY_RUN. While it is on, nothing is posted for real, a push included. */
  dryRun: boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  log?: (line: string) => void;
}

export type PushCheck =
  | { ok: true; post: Post }
  | { ok: false; status: 404 | 409; error: string };

/** Whether a post can be pushed now, and why not when it cannot. Reads only. */
export async function checkPushable(deps: PushDeps, postId: string): Promise<PushCheck> {
  if (deps.dryRun) {
    return {
      ok: false,
      status: 409,
      error:
        'The voice engine is running with VOICE_DRY_RUN=true, so nothing can be posted for real. Set it to false on danpearson-voice-engine and redeploy.',
    };
  }
  const post = await deps.store.getPost(postId);
  if (!post) return { ok: false, status: 404, error: 'no such post' };
  if (IN_FLIGHT.includes(post.status)) {
    return { ok: false, status: 409, error: `this post is still running (${post.status})` };
  }
  if (!post.copy || post.image_urls.length === 0) {
    return {
      ok: false,
      status: 409,
      error: `this post has no finished copy and images to send (it was ${post.status}${post.skip_stage ? ` at ${post.skip_stage}` : ''})`,
    };
  }
  return { ok: true, post };
}

/**
 * Send a checked post. Sets it to dispatching, then to the dispatch result.
 * A dry-run post that went out stops being marked dry run, unless a real post
 * for that track and day already exists (only one real post per track a day).
 */
export async function pushPost(deps: PushDeps, post: Post): Promise<DispatchResult> {
  const log = deps.log ?? ((line: string) => console.log(line));
  await deps.store.updatePost(post.id, { status: 'dispatching' });
  let result: DispatchResult;
  try {
    result = await dispatch(
      { store: deps.store, webhookSecret: deps.webhookSecret, dryRun: false, sleep: deps.sleep, now: deps.now },
      post
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await deps.store.updatePost(post.id, { status: 'failed', skip_reason: `push: ${reason}`, skip_stage: 'dispatch' });
    log(`[voice] push ${post.id} failed: ${reason}`);
    throw err;
  }

  const patch: Partial<Omit<Post, 'id' | 'created_at'>> = { status: result.status };
  if (result.status === 'failed') {
    patch.skip_reason = `push: no platform accepted the post (${result.failed.join(', ') || 'no enabled targets'})`;
    patch.skip_stage = 'dispatch';
  } else {
    patch.skip_reason = null;
    patch.skip_stage = null;
  }
  if (post.dry_run && result.status !== 'failed') {
    const realToday = await deps.store.findPost(post.track, post.run_date, false);
    if (!realToday) patch.dry_run = false;
  }
  await deps.store.updatePost(post.id, patch);
  log(
    `[voice] push ${post.track} ${post.run_date} ${result.status}: sent ${result.sent.join(', ') || 'nothing'}${result.failed.length ? `; failed ${result.failed.join(', ')}` : ''}${result.skippedAlreadySent.length ? `; already sent ${result.skippedAlreadySent.join(', ')}` : ''}`
  );
  return result;
}
