import type { Media } from '../media.js';
import type { Asset, Format, Slide } from '../types.js';
import { CAROUSEL, SlideRenderer, VERTICAL, type SlideContext } from './slides.js';
import { buildVideo } from './video.js';

export interface RenderedPost {
  imageUrls: string[];
  videoUrl: string | null;
}

export interface RenderDeps {
  renderer: SlideRenderer;
  media: Media;
  handle: string;
  /** Pick from a list; injected so tests are deterministic. */
  pick?: <T>(items: T[]) => T | undefined;
}

const randomPick = <T>(items: T[]): T | undefined =>
  items[Math.floor(Math.random() * items.length)];

async function asDataUri(media: Media, asset: Asset): Promise<string> {
  // Inlined so Chromium never fetches from the network mid-render.
  const bytes = await media.read(asset.storage_path);
  const ext = asset.storage_path.split('.').pop()?.toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${type};base64,${bytes.toString('base64')}`;
}

/**
 * Render a post's slides to 4:5 PNGs, upload them, and for carousels build and
 * upload the 9:16 video too. Single images get no video.
 */
export async function renderPost(
  deps: RenderDeps,
  post: { id: string; product: string; format: Format; slides: Slide[] },
  assets: Asset[]
): Promise<RenderedPost> {
  const pick = deps.pick ?? randomPick;
  const headshot = assets.filter((a) => a.kind === 'headshot').at(-1);
  const photo =
    post.format === 'single_image' ? pick(assets.filter((a) => a.kind === 'photo')) : undefined;
  const screenshotUrls: Record<string, string> = {};
  for (const s of post.slides) {
    if (s.role !== 'screen' || !s.asset_id) continue;
    const shot = assets.find(
      (a) => a.id === s.asset_id && a.kind === 'screenshot' && a.product === post.product
    );
    if (!shot)
      throw new Error(
        `screen slide references asset ${s.asset_id}, which is not a ${post.product} screenshot`
      );
    screenshotUrls[s.asset_id] = await asDataUri(deps.media, shot);
  }
  const ctx: SlideContext = {
    handle: deps.handle,
    headshotUrl: headshot ? await asDataUri(deps.media, headshot) : null,
    photoUrl: photo ? await asDataUri(deps.media, photo) : null,
    screenshotUrls,
  };

  const pngs = await deps.renderer.render(post.slides, ctx, CAROUSEL);
  const imageUrls: string[] = [];
  for (let i = 0; i < pngs.length; i++) {
    imageUrls.push(
      await deps.media.upload(
        `posts/${post.id}/slide-${String(i + 1).padStart(2, '0')}.png`,
        pngs[i]!,
        'image/png'
      )
    );
  }

  let videoUrl: string | null = null;
  if (post.format !== 'single_image') {
    const frames = await deps.renderer.render(post.slides, ctx, VERTICAL);
    const track = pick(assets.filter((a) => a.kind === 'music'));
    const music = track ? await deps.media.read(track.storage_path) : null;
    const mp4 = await buildVideo({ frames, music });
    videoUrl = await deps.media.upload(`posts/${post.id}/video.mp4`, mp4, 'video/mp4');
  }
  return { imageUrls, videoUrl };
}
