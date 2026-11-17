import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';

/** Pages shorter than this are navigation shells or empty app mounts, not material. */
export const MIN_BODY_CHARS = 200;

const NOISE =
  'script, style, noscript, template, svg, iframe, nav, header, footer, aside, form, [role="navigation"], [aria-hidden="true"]';

export interface Extracted {
  title: string | null;
  bodyText: string;
}

/** Readable text of an HTML page: the main or article content with chrome stripped. */
export function extractReadable(html: string): Extracted {
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    null;
  $(NOISE).remove();
  const root = $('main').first().length
    ? $('main').first()
    : $('article').first().length
      ? $('article').first()
      : $('body');
  // Block elements become line breaks so headings and paragraphs do not run together.
  root.find('p, h1, h2, h3, h4, h5, h6, li, br, div, section, tr, blockquote').each((_, el) => {
    $(el).append('\n');
  });
  const bodyText = root
    .text()
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return { title, bodyText };
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** <loc> values from a sitemap or sitemap index. */
export function parseSitemap(xml: string): { urls: string[]; sitemaps: string[] } {
  const $ = cheerio.load(xml, { xml: true });
  const urls = $('url > loc')
    .map((_, el) => $(el).text().trim())
    .get();
  const sitemaps = $('sitemap > loc')
    .map((_, el) => $(el).text().trim())
    .get();
  return { urls, sitemaps };
}

/** Links in an llms.txt file: markdown links and bare URLs. */
export function parseLlmsTxt(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) found.add(m[1]!);
  for (const m of text.matchAll(/(?:^|\s)(https?:\/\/[^\s)>\]]+)/g))
    found.add(m[1]!.replace(/[.,;]+$/, ''));
  return [...found];
}

const SKIP =
  /\/(legal|privacy|terms|tos|cookies?|login|log-in|signin|sign-in|signup|sign-up|register|auth|account|cart|checkout|admin|dashboard|api|pricing)(\/|$|\?)/i;
const SKIP_EXT = /\.(png|jpe?g|gif|webp|svg|pdf|zip|xml|json|ico|css|js|mp4|mp3)(\?|$)/i;

/** Lower is better. Blog and feature pages first, then everything else. */
function rank(pathname: string): number {
  if (/\/(blog|articles?|guides?|learn|news)\//i.test(pathname)) return 0;
  if (/\/(features?|how-it-works|tools?|use-cases?|solutions?|product)(\/|$)/i.test(pathname))
    return 1;
  if (/\/(blog|articles?|guides?|learn|news)$/i.test(pathname)) return 2;
  if (pathname === '/' || pathname === '') return 3;
  if (/\/(about|faq|help|docs)(\/|$)/i.test(pathname)) return 4;
  return 5;
}

/**
 * Up to `limit` page URLs worth reading, same-origin only. Legal, auth, cart
 * and pricing pages are dropped (posts carry no prices, so there is no reason
 * to feed the writer any).
 */
export function selectUrls(candidates: string[], baseUrl: string, limit = 40): string[] {
  const origin = new URL(baseUrl).origin;
  const seen = new Set<string>();
  const kept: { url: string; rank: number; order: number }[] = [];
  candidates.forEach((raw, order) => {
    let u: URL;
    try {
      u = new URL(raw, baseUrl);
    } catch {
      return;
    }
    if (u.origin !== origin) return;
    u.hash = '';
    u.search = '';
    const path = u.pathname.replace(/\/+$/, '') || '/';
    if (SKIP.test(path + '/') || SKIP_EXT.test(path)) return;
    const url = `${origin}${path === '/' ? '/' : path}`;
    if (seen.has(url)) return;
    seen.add(url);
    kept.push({ url, rank: rank(path), order });
  });
  return kept
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, limit)
    .map((k) => k.url);
}
