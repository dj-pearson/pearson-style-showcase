import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Asset,
  Format,
  Post,
  SourceItem,
  Story,
  Topic,
  Track,
  TrackKey,
  Variant,
  WebhookLogRow,
  WebhookTarget,
  Platform,
} from './types.js';

/**
 * Everything the engine reads or writes in the database, as one interface.
 * SupabaseStore talks to the DanPearson Supabase with the service-role key;
 * the tests use MemoryStore (src/testing/memory-store.ts).
 */
export interface Store {
  getTracks(): Promise<Track[]>;
  getTrack(key: TrackKey): Promise<Track | null>;
  advanceRotation(key: TrackKey): Promise<void>;

  /**
   * Take ownership of a track's day by inserting its post row. Returns null
   * when a real (non dry-run) post already exists for (track, runDate): another
   * run owns it. Dry runs never conflict.
   */
  claimPost(input: {
    track: TrackKey;
    product: string;
    runDate: string;
    dryRun: boolean;
  }): Promise<Post | null>;
  updatePost(id: string, patch: Partial<Omit<Post, 'id' | 'created_at'>>): Promise<void>;
  getPost(id: string): Promise<Post | null>;
  /** The post for a track's day in the given mode, if any. */
  findPost(track: TrackKey, runDate: string, dryRun: boolean): Promise<Post | null>;
  /** Format of the track's most recent post that got as far as choosing one. */
  lastFormat(track: TrackKey): Promise<Format | null>;

  listSourceItems(product: string): Promise<SourceItem[]>;
  latestFetch(product: string): Promise<string | null>;
  /** Insert or update by (product, url). Returns false when the hash was unchanged and nothing was written. */
  upsertSourceItem(
    item: Omit<SourceItem, 'id' | 'fetched_at'>,
    fetchedAt: string
  ): Promise<boolean>;
  /** Record that a product was checked, even if no page changed, so the 24h gate holds. */
  touchSourceItems(product: string, fetchedAt: string): Promise<void>;

  listConfirmedStories(): Promise<Story[]>;
  bumpStories(ids: string[], usedAt: string): Promise<void>;

  /** Topics for a track, newest first. */
  recentTopics(track: TrackKey, limit: number): Promise<Topic[]>;
  /** Topics created at or after `since`, any track. */
  topicsSince(since: string): Promise<Topic[]>;
  insertTopic(topic: Omit<Topic, 'id' | 'created_at'>): Promise<Topic>;

  listAssets(): Promise<Asset[]>;

  getWebhookTargets(): Promise<WebhookTarget[]>;
  hasSuccessfulSend(postId: string, platform: Platform, variant: Variant): Promise<boolean>;
  insertWebhookLog(row: WebhookLogRow): Promise<void>;
}

/** PostgREST unique-violation code. */
const UNIQUE_VIOLATION = '23505';

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

export class SupabaseStore implements Store {
  constructor(private readonly db: SupabaseClient) {}

  static connect(url: string, serviceRoleKey: string): SupabaseStore {
    return new SupabaseStore(
      createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    );
  }

  get client(): SupabaseClient {
    return this.db;
  }

  async getTracks(): Promise<Track[]> {
    return must(
      await this.db.from('voice_tracks').select('*').order('post_time'),
      'getTracks'
    ) as Track[];
  }

  async getTrack(key: TrackKey): Promise<Track | null> {
    return must(
      await this.db.from('voice_tracks').select('*').eq('key', key).maybeSingle(),
      'getTrack'
    ) as Track | null;
  }

  async advanceRotation(key: TrackKey): Promise<void> {
    const track = await this.getTrack(key);
    if (!track) return;
    must(
      await this.db
        .from('voice_tracks')
        .update({ rotation_index: track.rotation_index + 1 })
        .eq('key', key)
        // Compare-and-set: two finishing runs cannot both advance from the same index.
        .eq('rotation_index', track.rotation_index)
        .select('key'),
      'advanceRotation'
    );
  }

  async claimPost(input: {
    track: TrackKey;
    product: string;
    runDate: string;
    dryRun: boolean;
  }): Promise<Post | null> {
    const res = await this.db
      .from('voice_posts')
      .insert({
        track: input.track,
        product: input.product,
        run_date: input.runDate,
        dry_run: input.dryRun,
        status: 'claimed',
      })
      .select('*')
      .single();
    if (res.error) {
      if (res.error.code === UNIQUE_VIOLATION) return null;
      throw new Error(`claimPost: ${res.error.message}`);
    }
    return res.data as Post;
  }

  async updatePost(id: string, patch: Partial<Omit<Post, 'id' | 'created_at'>>): Promise<void> {
    must(await this.db.from('voice_posts').update(patch).eq('id', id).select('id'), 'updatePost');
  }

  async getPost(id: string): Promise<Post | null> {
    return must(
      await this.db.from('voice_posts').select('*').eq('id', id).maybeSingle(),
      'getPost'
    ) as Post | null;
  }

  async findPost(track: TrackKey, runDate: string, dryRun: boolean): Promise<Post | null> {
    const rows = must(
      await this.db
        .from('voice_posts')
        .select('*')
        .eq('track', track)
        .eq('run_date', runDate)
        .eq('dry_run', dryRun)
        .order('created_at', { ascending: false })
        .limit(1),
      'findPost'
    ) as Post[];
    return rows[0] ?? null;
  }

  async lastFormat(track: TrackKey): Promise<Format | null> {
    const rows = must(
      await this.db
        .from('voice_posts')
        .select('format')
        .eq('track', track)
        .not('format', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1),
      'lastFormat'
    ) as { format: Format }[];
    return rows[0]?.format ?? null;
  }

  async listSourceItems(product: string): Promise<SourceItem[]> {
    return must(
      await this.db.from('voice_source_items').select('*').eq('product', product).order('url'),
      'listSourceItems'
    ) as SourceItem[];
  }

  async latestFetch(product: string): Promise<string | null> {
    const rows = must(
      await this.db
        .from('voice_source_items')
        .select('fetched_at')
        .eq('product', product)
        .order('fetched_at', { ascending: false })
        .limit(1),
      'latestFetch'
    ) as { fetched_at: string }[];
    return rows[0]?.fetched_at ?? null;
  }

  async upsertSourceItem(
    item: Omit<SourceItem, 'id' | 'fetched_at'>,
    fetchedAt: string
  ): Promise<boolean> {
    const existing = must(
      await this.db
        .from('voice_source_items')
        .select('id, content_hash')
        .eq('product', item.product)
        .eq('url', item.url)
        .maybeSingle(),
      'upsertSourceItem lookup'
    ) as { id: string; content_hash: string } | null;
    if (existing && existing.content_hash === item.content_hash) return false;
    must(
      await this.db
        .from('voice_source_items')
        .upsert({ ...item, fetched_at: fetchedAt }, { onConflict: 'product,url' })
        .select('id'),
      'upsertSourceItem'
    );
    return true;
  }

  async touchSourceItems(product: string, fetchedAt: string): Promise<void> {
    must(
      await this.db
        .from('voice_source_items')
        .update({ fetched_at: fetchedAt })
        .eq('product', product)
        .select('id'),
      'touchSourceItems'
    );
  }

  async listConfirmedStories(): Promise<Story[]> {
    return must(
      await this.db.from('voice_stories').select('*').eq('confirmed', true).order('created_at'),
      'listConfirmedStories'
    ) as Story[];
  }

  async bumpStories(ids: string[], usedAt: string): Promise<void> {
    if (ids.length === 0) return;
    const rows = must(
      await this.db.from('voice_stories').select('id, times_used').in('id', ids),
      'bumpStories lookup'
    ) as { id: string; times_used: number }[];
    for (const row of rows) {
      must(
        await this.db
          .from('voice_stories')
          .update({ times_used: row.times_used + 1, last_used_at: usedAt })
          .eq('id', row.id)
          .select('id'),
        'bumpStories'
      );
    }
  }

  async recentTopics(track: TrackKey, limit: number): Promise<Topic[]> {
    return must(
      await this.db
        .from('voice_topics')
        .select('*')
        .eq('track', track)
        .order('created_at', { ascending: false })
        .limit(limit),
      'recentTopics'
    ) as Topic[];
  }

  async topicsSince(since: string): Promise<Topic[]> {
    return must(
      await this.db
        .from('voice_topics')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      'topicsSince'
    ) as Topic[];
  }

  async insertTopic(topic: Omit<Topic, 'id' | 'created_at'>): Promise<Topic> {
    return must(
      await this.db.from('voice_topics').insert(topic).select('*').single(),
      'insertTopic'
    ) as Topic;
  }

  async listAssets(): Promise<Asset[]> {
    return must(
      await this.db.from('voice_assets').select('*').order('created_at'),
      'listAssets'
    ) as Asset[];
  }

  async getWebhookTargets(): Promise<WebhookTarget[]> {
    return must(
      await this.db.from('voice_webhook_targets').select('*').order('platform'),
      'getWebhookTargets'
    ) as WebhookTarget[];
  }

  async hasSuccessfulSend(postId: string, platform: Platform, variant: Variant): Promise<boolean> {
    const rows = must(
      await this.db
        .from('voice_webhook_log')
        .select('id')
        .eq('post_id', postId)
        .eq('platform', platform)
        .eq('variant', variant)
        .eq('ok', true)
        .limit(1),
      'hasSuccessfulSend'
    ) as { id: string }[];
    return rows.length > 0;
  }

  async insertWebhookLog(row: WebhookLogRow): Promise<void> {
    must(
      await this.db
        .from('voice_webhook_log')
        .insert({ ...row, response_excerpt: row.response_excerpt?.slice(0, 500) ?? null })
        .select('id'),
      'insertWebhookLog'
    );
  }
}
