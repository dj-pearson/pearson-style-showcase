import { createHmac } from 'node:crypto';
import type { Store } from './store.js';
import type { Copy, Platform, Post, Variant, WebhookTarget } from './types.js';

export const SEND_TIMEOUT_MS = 15_000;
export const RETRY_DELAY_MS = 30_000;
const X_MAX_IMAGES = 4;

export type MediaType = 'image' | 'carousel' | 'video';

export interface WebhookPayload {
  event: 'social.published';
  platform: Platform;
  timestamp: string;
  /** Present (true) on Test fire only. Real sends omit it: the Make scenarios drop any run where it exists. */
  test?: true;
  data: {
    id: string;
    body: string;
    hashtags: string[];
    cta_url: null;
    product_focus: string;
    track: string;
    title?: string;
    image_url: string;
    media_type: MediaType;
    image_urls?: string[];
    video_url?: string;
  };
}

export interface Delivery {
  platform: Platform;
  variant: Variant;
  payload: WebhookPayload;
}

function bodyFor(
  platform: Platform,
  copy: Copy
): { body: string; hashtags: string[]; title?: string } {
  switch (platform) {
    case 'x':
      return { body: copy.x, hashtags: [] };
    case 'threads':
      return { body: copy.threads, hashtags: [] };
    case 'linkedin':
      return { body: copy.linkedin, hashtags: [] };
    case 'instagram':
      return { body: copy.instagram.caption, hashtags: copy.instagram.hashtags };
    case 'facebook':
      return { body: copy.facebook, hashtags: [] };
    case 'youtube':
      return { body: copy.youtube.description, hashtags: [], title: copy.youtube.title };
  }
}

/**
 * The payloads one post produces, per enabled target with a URL. Media rules:
 * instagram, facebook and linkedin get the carousel (or the image); x gets the
 * image or the first four slides; threads gets slide 1; youtube gets the video
 * and is left out when there is none; instagram also gets the video as a reel
 * when its target has reels on.
 */
export function buildDeliveries(post: Post, targets: WebhookTarget[], now: Date): Delivery[] {
  if (!post.copy) throw new Error('post has no copy');
  const images = post.image_urls;
  if (images.length === 0) throw new Error('post has no images');
  const out: Delivery[] = [];
  for (const target of targets) {
    if (!target.enabled || !target.url.trim()) continue;
    const { body, hashtags, title } = bodyFor(target.platform, post.copy);
    const base = {
      id: post.id,
      body,
      hashtags,
      cta_url: null,
      product_focus: post.product,
      track: post.track,
      ...(title ? { title } : {}),
      image_url: images[0]!,
    };
    const make = (variant: Variant, data: WebhookPayload['data']): Delivery => ({
      platform: target.platform,
      variant,
      payload: {
        event: 'social.published',
        platform: target.platform,
        timestamp: now.toISOString(),
        data,
      },
    });
    const carousel = images.length > 1;
    switch (target.platform) {
      case 'instagram':
      case 'facebook':
      case 'linkedin':
        out.push(
          make(
            'post',
            carousel
              ? { ...base, media_type: 'carousel', image_urls: images }
              : { ...base, media_type: 'image' }
          )
        );
        if (target.platform === 'instagram' && target.reels && post.video_url) {
          out.push(make('reel', { ...base, media_type: 'video', video_url: post.video_url }));
        }
        break;
      case 'x':
        out.push(
          make(
            'post',
            carousel
              ? { ...base, media_type: 'carousel', image_urls: images.slice(0, X_MAX_IMAGES) }
              : { ...base, media_type: 'image' }
          )
        );
        break;
      case 'threads':
        out.push(make('post', { ...base, media_type: 'image' }));
        break;
      case 'youtube':
        if (post.video_url)
          out.push(make('post', { ...base, media_type: 'video', video_url: post.video_url }));
        break;
    }
  }
  return out;
}

export function sign(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function idempotencyKey(postId: string, platform: Platform, variant: Variant): string {
  return variant === 'reel' ? `${postId}:${platform}:reel` : `${postId}:${platform}`;
}

export interface DispatchDeps {
  store: Store;
  webhookSecret: string;
  dryRun: boolean;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export interface DispatchResult {
  /** 'dry_run' when nothing was sent on purpose. */
  status: 'posted' | 'partial' | 'failed' | 'dry_run';
  sent: string[];
  failed: string[];
  skippedAlreadySent: string[];
}

async function sendOnce(
  url: string,
  raw: string,
  headers: Record<string, string>,
  fetcher: typeof fetch,
  timeoutMs: number
): Promise<{ status: number | null; ok: boolean; excerpt: string }> {
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers,
      body: raw,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, ok: res.ok, excerpt: text.slice(0, 500) };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.name === 'TimeoutError'
          ? `timed out after ${timeoutMs / 1000}s`
          : err.message
        : String(err);
    return { status: null, ok: false, excerpt: msg.slice(0, 500) };
  }
}

/**
 * Send a finished post to every enabled platform. A platform with a recorded
 * success for this post is never sent again. A failure is retried once after
 * 30 seconds. Every attempt is logged.
 */
export async function dispatch(deps: DispatchDeps, post: Post): Promise<DispatchResult> {
  const fetcher = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = (deps.now ?? (() => new Date()))();
  const targets = await deps.store.getWebhookTargets();
  const deliveries = buildDeliveries(post, targets, now);
  const result: DispatchResult = { status: 'failed', sent: [], failed: [], skippedAlreadySent: [] };
  const label = (d: Delivery) => (d.variant === 'reel' ? `${d.platform}:reel` : d.platform);

  if (deps.dryRun) {
    for (const d of deliveries) {
      await deps.store.insertWebhookLog({
        post_id: post.id,
        platform: d.platform,
        variant: d.variant,
        attempt: 0,
        http_status: null,
        ok: false,
        response_excerpt: 'dry run: not sent',
        payload: d.payload,
      });
    }
    return { ...result, status: 'dry_run' };
  }

  for (const d of deliveries) {
    if (await deps.store.hasSuccessfulSend(post.id, d.platform, d.variant)) {
      result.skippedAlreadySent.push(label(d));
      continue;
    }
    const target = targets.find((t) => t.platform === d.platform)!;
    const raw = JSON.stringify(d.payload);
    const headers = {
      'Content-Type': 'application/json',
      'X-Content-Signature': sign(raw, deps.webhookSecret),
      'X-Idempotency-Key': idempotencyKey(post.id, d.platform, d.variant),
    };
    let ok = false;
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      if (attempt === 2) await sleep(deps.retryDelayMs ?? RETRY_DELAY_MS);
      const r = await sendOnce(
        target.url,
        raw,
        headers,
        fetcher,
        deps.timeoutMs ?? SEND_TIMEOUT_MS
      );
      ok = r.ok;
      await deps.store.insertWebhookLog({
        post_id: post.id,
        platform: d.platform,
        variant: d.variant,
        attempt,
        http_status: r.status,
        ok: r.ok,
        response_excerpt: r.excerpt || null,
      });
    }
    (ok ? result.sent : result.failed).push(label(d));
  }

  const succeeded = result.sent.length + result.skippedAlreadySent.length;
  result.status =
    result.failed.length === 0 && succeeded > 0 ? 'posted' : succeeded > 0 ? 'partial' : 'failed';
  return result;
}
