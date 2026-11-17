import type { Post } from './types.js';

export interface SkipNotice {
  post: Pick<Post, 'id' | 'track' | 'product' | 'run_date' | 'dry_run'>;
  stage: string;
  reason: string;
}

/**
 * Tells Dan a day's post did not go out. Implementations must never throw:
 * a broken notifier cannot be allowed to break the pipeline.
 */
export interface Notifier {
  skipped(notice: SkipNotice): Promise<void>;
}

type Log = (msg: string) => void;

export class ConsoleNotifier implements Notifier {
  constructor(private readonly log: Log = (m) => console.warn(m)) {}

  async skipped(n: SkipNotice): Promise<void> {
    this.log(
      `[voice] ${n.post.track}/${n.post.product} ${n.post.run_date} did not post (stage ${n.stage}): ${n.reason}`
    );
  }
}

/**
 * Emails Dan through the voice-notify edge function. That function holds the
 * SMTP settings and enforces one email per track per day; dry runs are never
 * sent to it.
 */
export class EdgeNotifier implements Notifier {
  constructor(
    private readonly functionsUrl: string,
    private readonly serviceRoleKey: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly log: Log = (m) => console.warn(m)
  ) {}

  async skipped(n: SkipNotice): Promise<void> {
    if (n.post.dry_run) return;
    try {
      const res = await this.fetcher(`${this.functionsUrl}/voice-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceRoleKey}`,
        },
        body: JSON.stringify({ post_id: n.post.id, stage: n.stage, reason: n.reason }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) this.log(`[voice] notify failed for ${n.post.id}: HTTP ${res.status}`);
    } catch (err) {
      this.log(
        `[voice] notify failed for ${n.post.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
