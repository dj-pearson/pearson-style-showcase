import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { FONTS_DIR, TEMPLATES_DIR } from '../paths.js';
import type { Slide } from '../types.js';

export const CAROUSEL = { width: 1080, height: 1350 } as const;
export const VERTICAL = { width: 1080, height: 1920 } as const;
export type FrameSize = { width: number; height: number };

const FONT_FILES = {
  font_display_700: 'bricolage-grotesque-latin-700-normal.woff2',
  font_display_800: 'bricolage-grotesque-latin-800-normal.woff2',
  font_body_400: 'inter-latin-400-normal.woff2',
  font_body_600: 'inter-latin-600-normal.woff2',
} as const;

let fontCache: Record<string, string> | null = null;
/** Fonts inlined as data URIs: the page never asks the network for a font. */
function fontUris(): Record<string, string> {
  if (!fontCache) {
    fontCache = Object.fromEntries(
      Object.entries(FONT_FILES).map(([k, f]) => [
        k,
        `data:font/woff2;base64,${readFileSync(join(FONTS_DIR, f)).toString('base64')}`,
      ])
    );
  }
  return fontCache;
}

const tplCache = new Map<string, string>();
function tpl(name: string): string {
  let t = tplCache.get(name);
  if (t === undefined) {
    t = readFileSync(join(TEMPLATES_DIR, name), 'utf8');
    tplCache.set(name, t);
  }
  return t;
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([a-z_0-9]+)\}\}/g, (_, k: string) => {
    if (!(k in vars)) throw new Error(`slide template: no value for {{${k}}}`);
    return vars[k]!;
  });
}

export interface SlideContext {
  handle: string;
  /** Public URL (or data URI) of Dan's headshot, when one is uploaded. */
  headshotUrl: string | null;
  /** Public URL of a photo for a single_image post, when one is chosen. */
  photoUrl: string | null;
  /** asset_id -> image URL, for screen slides. */
  screenshotUrls: Record<string, string>;
}

/** The full HTML document for one slide at one size. Exported for tests and preview. */
export function slideHtml(
  slide: Slide,
  index: number,
  total: number,
  ctx: SlideContext,
  size: FrameSize
): string {
  const byline = `<div class="byline">${ctx.headshotUrl ? `<img src="${esc(ctx.headshotUrl)}" alt="" />` : ''}<div><div>Dan Pearson</div><div class="handle">${esc(ctx.handle)}</div></div></div>`;
  const bodyBlock = slide.body ? `<p class="body">${esc(slide.body)}</p>` : '';
  const counter = total > 1 ? `${index + 1} / ${total}` : '';
  // Point slides are numbered from 1, counting only the points.
  const vars: Record<string, string> = {
    headline: esc(slide.headline),
    body_block: bodyBlock,
    counter,
    byline,
    number: String(index).padStart(2, '0'),
  };

  let name: string;
  switch (slide.role) {
    case 'hook':
      name = 'hook.html';
      break;
    case 'point':
      name = 'point.html';
      break;
    case 'close':
      name = 'close.html';
      break;
    case 'single':
      name = 'single.html';
      vars.photo_block = ctx.photoUrl
        ? `<img class="photo" src="${esc(ctx.photoUrl)}" alt="" /><div class="scrim"></div>`
        : '';
      break;
    case 'screen': {
      name = 'screen.html';
      const url = slide.asset_id ? ctx.screenshotUrls[slide.asset_id] : undefined;
      if (!url) throw new Error(`screen slide ${index + 1} has no screenshot`);
      vars.screenshot = esc(url);
      break;
    }
  }
  let body = fill(tpl(name), vars);
  if (slide.role === 'single' && ctx.photoUrl)
    body = body.replace('class="slide single"', 'class="slide single has-photo"');

  const css = fill(tpl('base.css'), fontUris());
  const frame = `:root { --frame-w: ${size.width}px; --frame-h: ${size.height}px; }`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${tpl('tokens.css')}\n${frame}\n${css}</style></head><body>${body}</body></html>`;
}

export class OverflowError extends Error {
  constructor(public readonly slideIndex: number) {
    super(`slide ${slideIndex + 1}: text does not fit even at the minimum size`);
    this.name = 'OverflowError';
  }
}

/**
 * Shrinks each .fit box's text in 4% steps until it fits, never below the
 * box's data-min font size. Returns false if something still overflows.
 */
const FIT_SCRIPT = `(() => {
  let ok = true;
  for (const box of document.querySelectorAll('.fit')) {
    const min = Number(box.dataset.min || 32);
    const texts = [...box.querySelectorAll('.headline, .body')];
    const fits = () => box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1;
    let guard = 0;
    while (!fits() && guard++ < 60) {
      let changed = false;
      for (const el of texts) {
        const size = parseFloat(getComputedStyle(el).fontSize);
        const floor = el.classList.contains('body') ? Math.min(min, 30) * 0.75 : min;
        if (size > floor) {
          el.style.fontSize = Math.max(floor, size * 0.96) + 'px';
          changed = true;
        }
      }
      if (!changed) break;
    }
    if (!fits()) ok = false;
  }
  return ok;
})()`;

/** One Chromium per run; every slide of every size goes through it. */
export class SlideRenderer {
  private browser: Browser | null = null;

  async open(): Promise<void> {
    // The Docker image ships the Chromium that matches the pinned Playwright.
    // CHROMIUM_PATH is for machines whose browser build does not match.
    if (!this.browser)
      this.browser = await chromium.launch(
        process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
      );
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }

  async render(slides: Slide[], ctx: SlideContext, size: FrameSize): Promise<Buffer[]> {
    await this.open();
    const page = await this.browser!.newPage({ viewport: size, deviceScaleFactor: 1 });
    try {
      const out: Buffer[] = [];
      for (let i = 0; i < slides.length; i++) {
        await page.setContent(slideHtml(slides[i]!, i, slides.length, ctx, size), {
          waitUntil: 'load',
        });
        await page.evaluate('document.fonts.ready');
        const fits = (await page.evaluate(FIT_SCRIPT)) as boolean;
        if (!fits) throw new OverflowError(i);
        out.push(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, ...size } }));
      }
      return out;
    } finally {
      await page.close();
    }
  }
}

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(buf: Buffer): FrameSize {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
