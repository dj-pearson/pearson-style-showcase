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

/**
 * Minimal frontmatter parser. Deliberately not a YAML dependency: the format
 * here is `key: value` with JSON arrays, and a real parser would be more
 * surface area than the job needs.
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('missing frontmatter');

  const [, block, body] = match;
  const meta = {};

  for (const line of block.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    let value = rawValue.trim();

    if (value.startsWith('[')) {
      value = JSON.parse(value);
    } else if (value === 'true' || value === 'false') {
      value = value === 'true';
    } else {
      value = value.replace(/^['"]|['"]$/g, '');
    }
    meta[key] = value;
  }

  return { meta, body: body.trim() };
}

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;
const sqlArray = (values) => `ARRAY[${values.map(sqlString).join(', ')}]::text[]`;

const files = readdirSync(CONTENT_DIR)
  .filter((name) => name.endsWith('.md'))
  .sort();

const rows = files.map((file) => {
  const { meta, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, file), 'utf8'));

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

process.stdout.write(`-- Seed the AI CRM automation pillar articles.
--
-- Generated from content/crm/*.md by scripts/generate-article-seed.mjs. Edit the
-- markdown and regenerate rather than editing this file; the markdown is what a
-- human reviews. Idempotent on slug, so re-running will not duplicate rows or
-- overwrite edits made in the admin afterwards.
--
-- Both articles carry category 'CRM' and CRM tags, so /topics/ai-crm-automation
-- picks them up with no further wiring, and the guide's slug is the
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
