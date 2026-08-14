#!/usr/bin/env node
/**
 * Generates a Supabase seed migration from the markdown articles in content/.
 *
 * The markdown files are the editable source of truth - write and review them
 * there, then regenerate. Seeding is idempotent on `slug`, so re-running never
 * duplicates a row and never clobbers edits made afterwards in the admin.
 *
 *   node scripts/generate-article-seed.mjs > supabase/migrations/<ts>_seed_crm_pillars.sql
 *
 * The frontmatter parser lives in scripts/lib/content.mjs, shared with the
 * prerenderer so the seeded rows and the prerendered HTML cannot drift.
 */

import { readArticles } from './lib/content.mjs';

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;
const sqlArray = (values) => `ARRAY[${values.map(sqlString).join(', ')}]::text[]`;

const rows = readArticles().map(
  ({ meta, body }) => `  (
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
  )`
);

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
