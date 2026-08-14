/**
 * Shared reader for the markdown articles in content/.
 *
 * Extracted from generate-article-seed.mjs so the seed generator and the
 * prerenderer parse the files identically. If these two ever disagreed, the
 * HTML crawlers see and the rows the database holds would drift apart, which is
 * the one failure mode this whole content pipeline exists to avoid.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const CONTENT_DIR = 'content/crm';

const REQUIRED_FIELDS = [
  'slug',
  'title',
  'excerpt',
  'category',
  'tags',
  'author',
  'read_time',
  'featured',
  'published',
  'seo_title',
  'seo_description',
  'seo_keywords',
  'target_keyword',
];

/**
 * Splits a frontmatter block into logical entries, keeping bracketed arrays
 * together when they span multiple lines.
 *
 * This matters because Prettier runs over content/ on commit and reflows any
 * array longer than the print width onto separate lines. A naive line-by-line
 * parser silently stops seeing those fields after the first format pass.
 */
function splitEntries(block) {
  const entries = [];
  let current = '';
  let depth = 0;

  for (const line of block.split('\n')) {
    current = current ? `${current} ${line.trim()}` : line;
    depth += (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length;

    // A line ending in ":" is a key whose value Prettier pushed onto the next
    // line, so keep accumulating even though no bracket is open yet.
    if (depth === 0 && !current.trim().endsWith(':')) {
      entries.push(current);
      current = '';
    }
  }
  if (current) entries.push(current);

  return entries;
}

/** Strips one layer of matching single or double quotes. */
const unquote = (value) => value.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');

/**
 * Parses an inline array. Written by hand rather than with JSON.parse because
 * Prettier normalises the quotes to single, which is not valid JSON, and adds
 * trailing commas.
 */
function parseArray(value) {
  const inner = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  const items = [];
  let current = '';
  let quote = null;

  for (const char of inner) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === ',') {
      items.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) items.push(current.trim());

  return items.filter(Boolean);
}

/**
 * Minimal frontmatter parser. Deliberately not a YAML dependency: the format
 * here is `key: value` with inline arrays, and a real parser would be more
 * surface area than the job needs.
 */
export function parseFrontmatter(raw, file) {
  // Git checks these files out with CRLF on Windows, so match on normalized
  // input. Without this the parser reports every file as missing frontmatter,
  // and the generated SQL would carry \r into the article bodies.
  const match = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing frontmatter`);

  const [, block, body] = match;
  const meta = {};

  for (const entry of splitEntries(block)) {
    const kv = entry.match(/^(\w+):\s*([\s\S]*)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    const value = rawValue.trim();

    if (value.startsWith('[')) {
      meta[key] = parseArray(value);
    } else if (value === 'true' || value === 'false') {
      meta[key] = value === 'true';
    } else {
      meta[key] = unquote(value);
    }
  }

  const missing = REQUIRED_FIELDS.filter((field) => meta[field] === undefined);
  if (missing.length) {
    throw new Error(`${file}: missing frontmatter fields: ${missing.join(', ')}`);
  }
  if (!body.trim()) {
    throw new Error(`${file}: empty body`);
  }

  return { meta, body: body.trim() };
}

/** Every article in content/crm, parsed and sorted by slug for stable output. */
export function readArticles() {
  return readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((file) => parseFrontmatter(readFileSync(join(CONTENT_DIR, file), 'utf8'), file));
}

/**
 * Pulls the "Frequently asked questions" section out of an article body as
 * question/answer pairs, for FAQPage schema.
 *
 * The house convention is a bolded question line followed by the answer
 * paragraph, under an h2 whose text starts with "Frequently asked". Articles
 * without that section simply yield no pairs.
 */
export function extractFaqs(body) {
  // No `m` flag anywhere below: with multiline enabled `$` matches the end of
  // every line, so the lazy captures would stop at the first newline and every
  // article would silently yield zero FAQs. Line anchoring is done with an
  // explicit (?:^|\n) instead.
  const section = body.match(/(?:^|\n)##\s+Frequently asked[^\n]*\n([\s\S]*?)(?=\n##\s|\n---\s*\n|$)/i);
  if (!section) return [];

  const faqs = [];
  // A question is a whole line wrapped in **, and the answer is everything up
  // to the next such line.
  const pattern = /(?:^|\n)\*\*(.+?)\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/g;
  let match;

  while ((match = pattern.exec(section[1])) !== null) {
    const question = match[1].trim();
    const answer = match[2].replace(/\s+/g, ' ').trim();
    if (question && answer) faqs.push({ question, answer });
  }

  return faqs;
}
