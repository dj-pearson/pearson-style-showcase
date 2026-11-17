/**
 * Voice engine literals shared by the admin Voice tab.
 *
 * These mirror the CHECK constraints in
 * supabase/migrations/20261116000001_voice_engine.sql and the product map in
 * services/voice-engine. Declared once here so the four sub-tabs agree.
 */

export const VOICE_MEDIA_BUCKET = 'voice-media';

export const VOICE_TRACKS = ['gradethread', 'eatpal', 'platform'] as const;
export type VoiceTrack = (typeof VOICE_TRACKS)[number];

export const VOICE_TRACK_LABELS: Record<VoiceTrack, string> = {
  gradethread: 'GradeThread',
  eatpal: 'EatPal',
  platform: 'Platform',
};

export const VOICE_PRODUCTS = ['gradethread', 'eatpal', 'brikly', 'printyx', 'agentbio'] as const;
export type VoiceProduct = (typeof VOICE_PRODUCTS)[number];

export const VOICE_PRODUCT_LABELS: Record<VoiceProduct, string> = {
  gradethread: 'GradeThread',
  eatpal: 'EatPal',
  brikly: 'Brikly',
  printyx: 'Printyx',
  agentbio: 'AgentBio',
};

export const VOICE_PLATFORMS = [
  'x',
  'linkedin',
  'instagram',
  'facebook',
  'threads',
  'youtube',
] as const;
export type VoicePlatform = (typeof VOICE_PLATFORMS)[number];

export const VOICE_PLATFORM_LABELS: Record<VoicePlatform, string> = {
  x: 'X',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  threads: 'Threads',
  youtube: 'YouTube',
};

export const VOICE_ASSET_KINDS = ['headshot', 'photo', 'screenshot', 'music'] as const;
export type VoiceAssetKind = (typeof VOICE_ASSET_KINDS)[number];

export const VOICE_ASSET_KIND_LABELS: Record<VoiceAssetKind, string> = {
  headshot: 'Headshots',
  photo: 'Photos',
  screenshot: 'Screenshots',
  music: 'Music',
};

/** Statuses a post passes through before it settles. */
export const VOICE_IN_FLIGHT_STATUSES = ['claimed', 'writing', 'rendering', 'dispatching'];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MUSIC_MIME_TYPES = ['audio/mpeg', 'audio/mp3'];

export function labelFor(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

/**
 * Check an upload against the asset rules. Returns a message for the first
 * rule it breaks, or null when the file can be uploaded.
 */
export function validateAssetUpload(
  kind: VoiceAssetKind,
  product: string | null,
  file: { type: string; size: number; name: string } | null
): string | null {
  if (kind === 'screenshot' && !product) {
    return 'Pick the product this screenshot belongs to.';
  }
  if (!file) return 'Choose a file to upload.';
  if (kind === 'music') {
    const isMp3 = MUSIC_MIME_TYPES.includes(file.type) || /\.mp3$/i.test(file.name);
    return isMp3 ? null : 'Music must be an mp3 file.';
  }
  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    return 'Images must be png, jpg or webp.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Images must be 5 MB or smaller.';
  }
  return null;
}

/** Storage path for an asset: {kind}/{product?}/{uuid}.{ext} */
export function assetStoragePath(
  kind: VoiceAssetKind,
  product: string | null,
  fileName: string,
  id: string
): string {
  const ext = (fileName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const parts = [kind, ...(product ? [product] : []), `${id}.${ext || 'bin'}`];
  return parts.join('/');
}
