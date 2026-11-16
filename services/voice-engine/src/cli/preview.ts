/**
 * Render sample slides locally for visual review. No database, no Claude.
 *
 *   npm run preview -- --fixture carousel   (also: single, product, all)
 *
 * Writes PNGs (and the carousel's MP4) to services/voice-engine/out/preview/<fixture>/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PACKAGE_ROOT } from '../paths.js';
import { CAROUSEL, SlideRenderer, VERTICAL, type SlideContext } from '../render/slides.js';
import { buildVideo } from '../render/video.js';
import type { Slide } from '../types.js';
import { parseArgs } from './args.js';

/** A plain grey "screenshot" so the device frame has something to hold. */
const PLACEHOLDER_SCREEN = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1170" height="2532"><rect width="100%" height="100%" fill="#f8f8f6"/><rect x="60" y="180" width="1050" height="120" rx="24" fill="#e5e2da"/><rect x="60" y="360" width="700" height="60" rx="16" fill="#e5e2da"/><rect x="60" y="460" width="1050" height="360" rx="32" fill="#efece4"/><rect x="60" y="880" width="1050" height="360" rx="32" fill="#efece4"/></svg>'
).toString('base64')}`;

export const FIXTURES: Record<string, Slide[]> = {
  carousel: [
    { role: 'hook', headline: 'Your safe foods list already has a pattern in it' },
    {
      role: 'point',
      headline: 'Write every safe food down',
      body: 'One place, not your memory. The list is the tool.',
    },
    {
      role: 'point',
      headline: 'Sort it by texture',
      body: 'Crunchy and dry. Smooth and cold. Most kids live in one or two bands.',
    },
    {
      role: 'point',
      headline: 'Look one step out',
      body: 'The next food to try is the one closest to a texture already on the list.',
    },
    {
      role: 'point',
      headline: 'Keep the step small',
      body: 'Same texture, new flavor beats new texture, same flavor.',
    },
    { role: 'close', headline: 'Texture first. The list does the rest.' },
  ],
  single: [{ role: 'single', headline: 'A list that lives in your head is not a list.' }],
  product: [
    { role: 'hook', headline: 'What the grading screen is actually for' },
    {
      role: 'screen',
      headline: 'Grade first. The grade sets the price ceiling.',
      asset_id: 'placeholder',
    },
    {
      role: 'point',
      headline: 'Flaws go on the record',
      body: 'A buyer who sees the flaw before it ships does not open a return.',
    },
    { role: 'screen', headline: 'The listing pulls the grade in for you', asset_id: 'placeholder' },
    { role: 'close', headline: 'Price after you grade, never before.' },
  ],
};

async function main(): Promise<void> {
  const { values } = parseArgs(process.argv.slice(2));
  const name = values.get('fixture') ?? 'all';
  const names = name === 'all' ? Object.keys(FIXTURES) : [name];
  for (const n of names)
    if (!FIXTURES[n])
      throw new Error(`unknown fixture "${n}"; use ${Object.keys(FIXTURES).join(', ')} or all`);

  const ctx: SlideContext = {
    handle: process.env.VOICE_HANDLE || '@danpearson',
    headshotUrl: null,
    photoUrl: null,
    screenshotUrls: { placeholder: PLACEHOLDER_SCREEN },
  };
  const renderer = new SlideRenderer();
  try {
    for (const n of names) {
      const dir = join(PACKAGE_ROOT, 'out', 'preview', n);
      await mkdir(dir, { recursive: true });
      const slides = FIXTURES[n]!;
      const pngs = await renderer.render(slides, ctx, CAROUSEL);
      for (let i = 0; i < pngs.length; i++)
        await writeFile(join(dir, `slide-${i + 1}.png`), pngs[i]!);
      if (slides.length > 1) {
        const frames = await renderer.render(slides, ctx, VERTICAL);
        await writeFile(join(dir, 'video.mp4'), await buildVideo({ frames, music: null }));
      }
      console.log(`${n}: ${dir}`);
    }
  } finally {
    await renderer.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
