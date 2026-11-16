import { randomUUID } from 'node:crypto';
import type { Store } from '../store.js';
import type {
  Asset,
  Format,
  Platform,
  Post,
  SourceItem,
  Story,
  Topic,
  Track,
  TrackKey,
  Variant,
  WebhookLogRow,
  WebhookTarget,
} from '../types.js';

/**
 * In-memory Store for tests. It enforces the same two uniqueness rules the
 * database does: one real post per (track, run_date), and one successful send
 * per (post, platform, variant).
 */
export class MemoryStore implements Store {
  tracks: Track[] = [
    {
      key: 'gradethread',
      enabled: true,
      post_time: '08:30:00',
      timezone: 'America/Chicago',
      products: ['gradethread'],
      rotation_index: 0,
    },
    {
      key: 'eatpal',
      enabled: true,
      post_time: '12:15:00',
      timezone: 'America/Chicago',
      products: ['eatpal'],
      rotation_index: 0,
    },
    {
      key: 'platform',
      enabled: true,
      post_time: '16:30:00',
      timezone: 'America/Chicago',
      products: ['brikly', 'printyx', 'agentbio'],
      rotation_index: 0,
    },
  ];
  posts: Post[] = [];
  sourceItems: SourceItem[] = [];
  stories: Story[] = [];
  topics: Topic[] = [];
  assets: Asset[] = [];
  targets: WebhookTarget[] = [];
  log: (WebhookLogRow & { id: string })[] = [];
  /** Clock used for created_at; tests can pin it. */
  now: () => Date = () => new Date();

  async getTracks() {
    return this.tracks.map((t) => ({ ...t }));
  }
  async getTrack(key: TrackKey) {
    const t = this.tracks.find((x) => x.key === key);
    return t ? { ...t } : null;
  }
  async advanceRotation(key: TrackKey) {
    const t = this.tracks.find((x) => x.key === key);
    if (t) t.rotation_index += 1;
  }

  async claimPost(input: { track: TrackKey; product: string; runDate: string; dryRun: boolean }) {
    if (
      !input.dryRun &&
      this.posts.some((p) => !p.dry_run && p.track === input.track && p.run_date === input.runDate)
    ) {
      return null;
    }
    const post: Post = {
      id: randomUUID(),
      track: input.track,
      product: input.product,
      run_date: input.runDate,
      topic_id: null,
      format: null,
      status: 'claimed',
      copy: null,
      slides: null,
      image_urls: [],
      video_url: null,
      skip_reason: null,
      skip_stage: null,
      attempts: 0,
      dry_run: input.dryRun,
      notified_at: null,
      created_at: this.now().toISOString(),
    };
    this.posts.push(post);
    return { ...post };
  }
  async updatePost(id: string, patch: Partial<Omit<Post, 'id' | 'created_at'>>) {
    const p = this.posts.find((x) => x.id === id);
    if (!p) throw new Error(`updatePost: no post ${id}`);
    Object.assign(p, patch);
  }
  async getPost(id: string) {
    const p = this.posts.find((x) => x.id === id);
    return p ? { ...p } : null;
  }
  async findPost(track: TrackKey, runDate: string, dryRun: boolean) {
    const p = [...this.posts]
      .reverse()
      .find((x) => x.track === track && x.run_date === runDate && x.dry_run === dryRun);
    return p ? { ...p } : null;
  }
  async lastFormat(track: TrackKey): Promise<Format | null> {
    const p = [...this.posts].reverse().find((x) => x.track === track && x.format);
    return p?.format ?? null;
  }

  async listSourceItems(product: string) {
    return this.sourceItems.filter((s) => s.product === product).map((s) => ({ ...s }));
  }
  async latestFetch(product: string) {
    const times = this.sourceItems
      .filter((s) => s.product === product)
      .map((s) => s.fetched_at)
      .sort();
    return times.at(-1) ?? null;
  }
  async upsertSourceItem(item: Omit<SourceItem, 'id' | 'fetched_at'>, fetchedAt: string) {
    const existing = this.sourceItems.find((s) => s.product === item.product && s.url === item.url);
    if (existing) {
      if (existing.content_hash === item.content_hash) return false;
      Object.assign(existing, item, { fetched_at: fetchedAt });
      return true;
    }
    this.sourceItems.push({ ...item, id: randomUUID(), fetched_at: fetchedAt });
    return true;
  }
  async touchSourceItems(product: string, fetchedAt: string) {
    for (const s of this.sourceItems) if (s.product === product) s.fetched_at = fetchedAt;
  }

  async listConfirmedStories() {
    return this.stories.filter((s) => s.confirmed).map((s) => ({ ...s }));
  }
  async bumpStories(ids: string[], usedAt: string) {
    for (const s of this.stories) {
      if (ids.includes(s.id)) {
        s.times_used += 1;
        s.last_used_at = usedAt;
      }
    }
  }

  async recentTopics(track: TrackKey, limit: number) {
    return this.topics
      .filter((t) => t.track === track)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  async topicsSince(since: string) {
    return this.topics
      .filter((t) => t.created_at >= since)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async insertTopic(topic: Omit<Topic, 'id' | 'created_at'>) {
    const row: Topic = { ...topic, id: randomUUID(), created_at: this.now().toISOString() };
    this.topics.push(row);
    return { ...row };
  }

  async listAssets() {
    return this.assets.map((a) => ({ ...a }));
  }

  async getWebhookTargets() {
    return this.targets.map((t) => ({ ...t }));
  }
  async hasSuccessfulSend(postId: string, platform: Platform, variant: Variant) {
    return this.log.some(
      (l) => l.post_id === postId && l.platform === platform && l.variant === variant && l.ok
    );
  }
  async insertWebhookLog(row: WebhookLogRow) {
    if (row.ok && (await this.hasSuccessfulSend(row.post_id, row.platform, row.variant))) {
      throw new Error(
        'duplicate key value violates unique constraint "idx_voice_webhook_log_one_success"'
      );
    }
    this.log.push({ ...row, id: randomUUID() });
  }

  // Test conveniences -------------------------------------------------------

  addStory(partial: Partial<Story> & { body: string }): Story {
    const s: Story = {
      id: randomUUID(),
      tracks: [],
      products: [],
      confirmed: true,
      times_used: 0,
      last_used_at: null,
      ...partial,
    };
    this.stories.push(s);
    return s;
  }
  addSourceItem(partial: Partial<SourceItem> & { product: string; url: string }): SourceItem {
    const s: SourceItem = {
      id: randomUUID(),
      title: 'Page',
      body_text: 'Body text for the page.',
      content_hash: 'hash',
      fetched_at: this.now().toISOString(),
      ...partial,
    };
    this.sourceItems.push(s);
    return s;
  }
  addAsset(partial: Partial<Asset> & { kind: Asset['kind'] }): Asset {
    const a: Asset = {
      id: randomUUID(),
      product: null,
      storage_path: `${partial.kind}/x.png`,
      caption: null,
      ...partial,
    };
    this.assets.push(a);
    return a;
  }
}
