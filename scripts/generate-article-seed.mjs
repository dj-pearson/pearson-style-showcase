#!/usr/bin/env node
/**
 * Generates a Supabase seed migration from the markdown articles in content/.
 *
 * The markdown files are the editable source of truth — write and review them
 * there, then regenerate. Seeding is idempotent on `slug`, so re-running never
 * duplicates a row and never clobbers edits made afterwards in the admin.
 *
 *   node scripts/generate-article-seed.mjs > supabase/migrations/<ts>_seed_crm_pillars.sql
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CONTENT_DIR = 'content/crm';

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
function parseFrontmatter(raw, file) {
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

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;
const sqlArray = (values) => `ARRAY[${values.map(sqlString).join(', ')}]::text[]`;

const files = readdirSync(CONTENT_DIR)
  .filter((name) => name.endsWith('.md'))
  .sort();

const rows = files.map((file) => {
  const { meta, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, file), 'utf8'), file);

  return `  (
    ${sqlString(meta.slug)},
    ${sqlString(meta.title)},
    ${sqlString(meta.excerpt)},
    ${sqlString(body)},
    ${sqlString(meta.category)},
    ${sqlArray(meta.tags)},
    ${sqlString(meta.author)},
    ${sqlString(meta.read_time)},
    ${meta.featured},
    ${meta.published},
    ${sqlString(meta.seo_title)},
    ${sqlString(meta.seo_description)},
    ${sqlArray(meta.seo_keywords)},
    ${sqlString(meta.target_keyword)}
  )`;
});

process.stdout.write(`-- Seed the AI CRM automation articles.
--
-- Generated from content/crm/*.md by scripts/generate-article-seed.mjs. Edit the
-- markdown and regenerate rather than editing this file; the markdown is what a
-- human reviews. Idempotent on slug, so re-running will not duplicate rows or
-- overwrite edits made in the admin afterwards.
--
-- Every article carries category 'CRM' and CRM tags, so /topics/ai-crm-automation
-- picks them up with no further wiring, and the complete guide's slug is the
-- \`pillarContent\` target configured in src/pages/TopicHub.tsx.

INSERT INTO articles (
  slug, title, excerpt, content, category, tags, author, read_time,
  featured, published, seo_title, seo_description, seo_keywords, target_keyword
)
SELECT * FROM (VALUES
${rows.join(',\n')}
) AS seed(
  slug, title, excerpt, content, category, tags, author, read_time,
  featured, published, seo_title, seo_description, seo_keywords, target_keyword
)
WHERE NOT EXISTS (
  SELECT 1 FROM articles a WHERE a.slug = seed.slug
);
`);
