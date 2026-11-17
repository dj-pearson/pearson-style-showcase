/**
 * The vocabulary of the voice engine, declared once. The SQL CHECK constraints
 * in supabase/migrations/20261116000001_voice_engine.sql and the admin UI's
 * constants repeat these lists; change all three together.
 */

export const TRACKS = ['gradethread', 'eatpal', 'platform'] as const;
export type TrackKey = (typeof TRACKS)[number];

export const PRODUCTS = ['gradethread', 'eatpal', 'brikly', 'printyx', 'agentbio'] as const;
export type Product = (typeof PRODUCTS)[number];

export const PLATFORMS = ['x', 'linkedin', 'instagram', 'facebook', 'threads', 'youtube'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const FORMATS = ['text_carousel', 'single_image', 'product_carousel'] as const;
export type Format = (typeof FORMATS)[number];

export const SLIDE_ROLES = ['hook', 'point', 'close', 'screen', 'single'] as const;
export type SlideRole = (typeof SLIDE_ROLES)[number];

export type PostStatus =
  | 'claimed'
  | 'writing'
  | 'rendering'
  | 'dispatching'
  | 'posted'
  | 'partial'
  | 'skipped'
  | 'failed'
  | 'dry_run';

export type Variant = 'post' | 'reel';

export interface Track {
  key: TrackKey;
  enabled: boolean;
  /** 'HH:MM' or 'HH:MM:SS', local to `timezone`. */
  post_time: string;
  timezone: string;
  products: string[];
  rotation_index: number;
}

export interface Story {
  id: string;
  body: string;
  tracks: string[];
  products: string[];
  confirmed: boolean;
  times_used: number;
  last_used_at: string | null;
}

export interface SourceItem {
  id: string;
  product: string;
  url: string;
  title: string | null;
  body_text: string;
  content_hash: string;
  fetched_at: string;
}

export type AssetKind = 'headshot' | 'photo' | 'screenshot' | 'music';

export interface Asset {
  id: string;
  kind: AssetKind;
  product: string | null;
  storage_path: string;
  caption: string | null;
}

export interface Topic {
  id: string;
  track: TrackKey;
  product: string;
  topic: string;
  angle: string;
  is_feature: boolean;
  source_item_ids: string[];
  story_ids: string[];
  created_at: string;
}

export interface Slide {
  role: SlideRole;
  headline: string;
  body?: string;
  asset_id?: string;
}

export interface Copy {
  x: string;
  threads: string;
  linkedin: string;
  instagram: { caption: string; hashtags: string[] };
  facebook: string;
  youtube: { title: string; description: string };
}

export interface Claim {
  text: string;
  source_item_id: string | null;
  story_id: string | null;
}

export interface Draft {
  copy: Copy;
  slides: Slide[];
  claims: Claim[];
}

export interface Post {
  id: string;
  track: TrackKey;
  product: string;
  run_date: string;
  topic_id: string | null;
  format: Format | null;
  status: PostStatus;
  copy: Copy | null;
  slides: Slide[] | null;
  image_urls: string[];
  video_url: string | null;
  skip_reason: string | null;
  skip_stage: string | null;
  attempts: number;
  dry_run: boolean;
  notified_at: string | null;
  created_at: string;
}

export interface WebhookTarget {
  platform: Platform;
  url: string;
  enabled: boolean;
  reels: boolean;
}

export interface WebhookLogRow {
  post_id: string;
  platform: Platform;
  variant: Variant;
  attempt: number;
  http_status: number | null;
  ok: boolean;
  response_excerpt: string | null;
  payload?: unknown;
}

/** Every text field of a draft, labelled, for the scans that read all of it. */
export function draftTexts(
  draft: Pick<Draft, 'copy' | 'slides'>
): { where: string; text: string }[] {
  const c = draft.copy;
  const out = [
    { where: 'copy.x', text: c.x },
    { where: 'copy.threads', text: c.threads },
    { where: 'copy.linkedin', text: c.linkedin },
    { where: 'copy.instagram.caption', text: c.instagram.caption },
    { where: 'copy.instagram.hashtags', text: c.instagram.hashtags.join(' ') },
    { where: 'copy.facebook', text: c.facebook },
    { where: 'copy.youtube.title', text: c.youtube.title },
    { where: 'copy.youtube.description', text: c.youtube.description },
  ];
  draft.slides.forEach((s, i) => {
    out.push({ where: `slides[${i}].headline`, text: s.headline });
    if (s.body) out.push({ where: `slides[${i}].body`, text: s.body });
  });
  return out;
}
