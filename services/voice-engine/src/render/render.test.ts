import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Slide } from '../types.js';
import {
  CAROUSEL,
  OverflowError,
  SlideRenderer,
  VERTICAL,
  pngSize,
  type SlideContext,
} from './slides.js';
import { buildVideo, probe, slideDurations, videoLength } from './video.js';

/** A 2x2 PNG, enough to stand in for a screenshot or headshot without a network. */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==';

const ctx: SlideContext = {
  handle: '@danpearson',
  headshotUrl: TINY_PNG,
  photoUrl: null,
  screenshotUrls: { 'shot-1': TINY_PNG },
};

const FIXTURE: Record<string, Slide> = {
  hook: { role: 'hook', headline: 'Your safe foods list has a pattern' },
  point: {
    role: 'point',
    headline: 'Sort it by texture',
    body: 'Crunchy and dry. Smooth and cold. The next food sits one step out.',
  },
  close: { role: 'close', headline: 'Texture first. The list does the rest.' },
  single: { role: 'single', headline: 'A list that lives in your head is not a list.' },
  screen: {
    role: 'screen',
    headline: 'The safe foods list, sorted by texture',
    asset_id: 'shot-1',
  },
};

const renderer = new SlideRenderer();
afterAll(() => renderer.close());

describe('slide renderer', () => {
  for (const [name, slide] of Object.entries(FIXTURE)) {
    it(`renders the ${name} template at 1080x1350 and 1080x1920`, async () => {
      const [carousel] = await renderer.render([slide], ctx, CAROUSEL);
      const [vertical] = await renderer.render([slide], ctx, VERTICAL);
      expect(pngSize(carousel!)).toEqual({ width: 1080, height: 1350 });
      expect(pngSize(vertical!)).toEqual({ width: 1080, height: 1920 });
    });
  }

  it('shrinks a long headline to fit instead of failing', async () => {
    const long: Slide = {
      role: 'point',
      headline: 'Sort the list by texture before you try anything new at dinner tonight',
      body: 'Crunchy and dry. Smooth and cold. Soft and warm. The next food to try is the one closest to a texture already on the list.',
    };
    const [png] = await renderer.render([long], ctx, CAROUSEL);
    expect(pngSize(png!).width).toBe(1080);
  });

  it('fails the stage when text cannot fit even at the minimum size', async () => {
    const huge: Slide = { role: 'hook', headline: 'word '.repeat(400).trim() };
    await expect(renderer.render([huge], ctx, CAROUSEL)).rejects.toBeInstanceOf(OverflowError);
  });
});

describe('video', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'voice-video-test-'));
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it('times slides at 3s for the hook and 2.5s after, with 0.4s crossfades, inside 8 to 45 seconds', () => {
    expect(slideDurations(6)).toEqual([3, 2.5, 2.5, 2.5, 2.5, 2.5]);
    expect(videoLength(slideDurations(6))).toBeCloseTo(13.5);
    expect(videoLength(slideDurations(3))).toBeCloseTo(8);
    expect(videoLength(slideDurations(30))).toBeCloseTo(45);
  });

  it('builds a 1080x1920 H.264/AAC MP4 of the expected length from three frames', async () => {
    const frames = await renderer.render(
      [FIXTURE.hook!, FIXTURE.point!, FIXTURE.close!],
      ctx,
      VERTICAL
    );
    const mp4 = await buildVideo({ frames, music: null });
    const file = join(dir, 'out.mp4');
    await writeFile(file, mp4);
    const p = await probe(file);
    expect(p).toMatchObject({ width: 1080, height: 1920, videoCodec: 'h264', audioCodec: 'aac' });
    expect(p.fps).toBeCloseTo(30);
    expect(p.duration).toBeGreaterThan(7.8);
    expect(p.duration).toBeLessThan(8.3);
  });
});
