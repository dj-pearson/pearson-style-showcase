/**
 * Pure helpers for the daily AI news brief: feed parsing, candidate
 * selection and source-page text extraction.
 *
 * The previous version scraped one site's homepage for any link, picked one at
 * random (often weeks old, sometimes a tag page), and gave the model the first
 * 500 characters. That produced a rewrite of whatever it happened to land on,
 * with no citation and no guarantee it was the day's news. This reads several
 * feeds, keeps only items from the last day and a half, and hands the model
 * enough of the real article to write analysis instead of paraphrase.
 *
 * No Deno globals and no imports beyond ../_shared, so it is unit-testable.
 */

import { normalizeUrl } from '../_shared/content-quality.ts';

export interface FeedItem {
  title: string;
  url: string;
  source: string;
  publishedAt: Date | null;
  summary: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '...',
  mdash: '-',
  ndash: '-',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Tags stripped, entities decoded, whitespace collapsed. */
export function toPlainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function tagText(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? toPlainText(match[1]) : '';
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Hostname without "www.", used as the human-readable source name. */
export function sourceName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Parse RSS 2.0 or Atom. Regex rather than an XML parser: Deno has no DOM,
 * feeds are small, and the only fields needed are title, link, date and
 * summary. Malformed items are skipped, not fatal.
 */
export function parseFeed(xml: string, feedUrl: string): FeedItem[] {
  const items: FeedItem[] = [];
  const source = sourceName(feedUrl);

  for (const [, block] of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const url = tagText(block, 'link') || tagText(block, 'guid');
    const title = tagText(block, 'title');
    if (!title || !/^https?:\/\//.test(url)) continue;
    items.push({
      title,
      url,
      source,
      publishedAt: parseDate(tagText(block, 'pubDate') || tagText(block, 'dc:date')),
      summary: (tagText(block, 'description') || tagText(block, 'content:encoded')).slice(0, 600),
    });
  }

  for (const [, block] of xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)) {
    const link =
      block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ||
      block.match(/<link[^>]*href=["']([^"']+)["']/i);
    const url = link ? decodeEntities(link[1]) : '';
    const title = tagText(block, 'title');
    if (!title || !/^https?:\/\//.test(url)) continue;
    items.push({
      title,
      url,
      source,
      publishedAt: parseDate(tagText(block, 'published') || tagText(block, 'updated')),
      summary: (tagText(block, 'summary') || tagText(block, 'content')).slice(0, 600),
    });
  }

  return items;
}

/** Lowercased word set for a rough "same story, different outlet" check. */
function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

export function similarTitles(a: string, b: string): boolean {
  const wa = titleWords(a);
  const wb = titleWords(b);
  if (!wa.size || !wb.size) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size) >= 0.6;
}

export interface CandidateOptions {
  now: Date;
  maxAgeHours: number;
  /** Normalized URLs already used as a source by an earlier brief. */
  excludeUrls: Set<string>;
  /** Titles published recently, so the same story is not covered twice. */
  recentTitles: string[];
  limit: number;
}

/**
 * Items fresh enough to be "today's news", newest first, with duplicates
 * (same URL, or near-identical headline from a second outlet) dropped.
 * Undated items are kept only if nothing dated survives, since a feed that
 * omits dates cannot prove freshness.
 */
export function selectCandidates(items: FeedItem[], options: CandidateOptions): FeedItem[] {
  const cutoff = options.now.getTime() - options.maxAgeHours * 3600_000;
  const future = options.now.getTime() + 6 * 3600_000;
  const seen = new Set<string>();
  const kept: FeedItem[] = [];

  const sorted = [...items].sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
  );

  for (const item of sorted) {
    const key = normalizeUrl(item.url);
    if (seen.has(key) || options.excludeUrls.has(key)) continue;
    const time = item.publishedAt?.getTime();
    if (time !== undefined && (time < cutoff || time > future)) continue;
    if (options.recentTitles.some((t) => similarTitles(t, item.title))) continue;
    if (kept.some((k) => similarTitles(k.title, item.title))) continue;
    seen.add(key);
    kept.push(item);
  }

  const dated = kept.filter((i) => i.publishedAt);
  return (dated.length ? dated : kept).slice(0, options.limit);
}

/**
 * Readable text from an article page: paragraphs, headings and list items
 * inside <article> (or <main>, or the whole body), with navigation, scripts
 * and boilerplate removed. Capped so a long piece does not blow the prompt.
 */
export function extractArticleText(html: string, maxChars = 12_000): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(
      /<(script|style|noscript|svg|nav|header|footer|aside|form|figure|iframe|button)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi,
      ' '
    );

  const scope =
    cleaned.match(/<article(?:\s[^>]*)?>([\s\S]*?)<\/article>/i)?.[1] ||
    cleaned.match(/<main(?:\s[^>]*)?>([\s\S]*?)<\/main>/i)?.[1] ||
    cleaned.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i)?.[1] ||
    cleaned;

  const blocks: string[] = [];
  for (const [, tag, inner] of scope.matchAll(
    /<(p|h2|h3|li|blockquote)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi
  )) {
    const text = toPlainText(inner);
    if (text.length < 25 && tag.toLowerCase() === 'p') continue;
    if (/^(advertisement|sign up|subscribe|read more|related:)/i.test(text)) continue;
    blocks.push(tag.toLowerCase().startsWith('h') ? `\n${text}\n` : text);
  }

  const text = blocks
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;
}

/** The pipeline-owned citation list appended to every brief. */
export function buildSourcesSection(sources: FeedItem[]): string {
  const lines = sources.map((s) => {
    const date = s.publishedAt ? `, ${s.publishedAt.toISOString().slice(0, 10)}` : '';
    const title = s.title.replace(/[[\]]/g, '');
    return `- [${title}](${s.url}) (${s.source}${date})`;
  });
  return `## Sources\n\n${lines.join('\n')}`;
}
