#!/usr/bin/env node
/**
 * Generates a migration that pushes edited content/crm markdown into existing
 * `articles` rows, plus its rollback.
 *
 * Why: the seed migrations only INSERT slugs that are missing, so editing the
 * markdown and regenerating a seed never reaches a database that already has
 * the rows, and production serves the row whenever one exists. This writes
 * guarded UPDATEs instead: a row changes only if its content, excerpt,
 * seo_title and seo_description still match a version some seed migration
 * inserted. A row the owner has edited in the admin matches none of them and
 * is left alone; the migration names it in a NOTICE.
 *
 *   node scripts/generate-article-content-update.mjs migration > supabase/migrations/<ts>_update_crm_article_content.sql
 *   node scripts/generate-article-content-update.mjs rollback  > supabase/migrations/rollbacks/<ts>_update_crm_article_content.sql
 *
 * The "new" values come from content/crm via scripts/lib/content.mjs, the same
 * reader the seed generator uses, so they are byte-for-byte what the current
 * seed would insert. The "old" values come from SNAPSHOT, a committed record of
 * every row the seed migrations have ever inserted. It is committed rather than
 * read from git at generation time because CI checks out one commit deep and
 * the old seed versions only exist in history. Rebuild it with:
 *
 *   node scripts/generate-article-content-update.mjs snapshot
 *
 * scripts/__tests__/article-content-update.test.ts asserts the committed
 * migration and rollback match this generator's output.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readArticles } from './lib/content.mjs';

const SNAPSHOT = join('scripts', 'data', 'crm-seeded-articles.json');
const MIGRATION_NAME = '20261116000300_update_crm_article_content.sql';

/** The columns commit f1601bf changed. title, tags and the rest did not move. */
const FIELDS = ['content', 'excerpt', 'seo_title', 'seo_description'];

/**
 * Every version of a seed migration that has existed in git. Earlier seeds
 * insert first, so a slug's production row came from the earliest seed that
 * carries it, and two of these files were regenerated in place after they may
 * already have been applied. Any of them can be what a database holds.
 */
const SEED_SOURCES = [
  { commit: 'c12372b', path: 'supabase/migrations/20260811000002_seed_crm_pillar_articles.sql' },
  {
    commit: 'af481e9',
    path: 'supabase/migrations/20260814000000_seed_crm_commercial_articles.sql',
  },
  {
    commit: '67aaffb',
    path: 'supabase/migrations/20260814000000_seed_crm_commercial_articles.sql',
  },
  { commit: '78e213d', path: 'supabase/migrations/20260814000003_seed_crm_industry_articles.sql' },
];

/** What the rollback restores: the industry seed as it stood before f1601bf. */
const RESTORE_SOURCE = SEED_SOURCES.at(-1);

/** The column order every seed generator has emitted. */
const SEED_COLUMNS = [
  'slug',
  'title',
  'excerpt',
  'content',
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

/** Dollar-quote tags. Checked against every value before use. */
const BODY_TAG = '$crm_md$';
const DO_TAG = '$crm_update$';

const md5 = (value) => createHash('md5').update(value, 'utf8').digest('hex');

/**
 * One string per row version, matching the SQL expression ROW_FINGERPRINT.
 * Postgres md5() hashes the UTF-8 bytes of the text, as Node does here.
 */
const fingerprint = (row) => FIELDS.map((field) => md5(row[field])).join(':');
const ROW_FINGERPRINT = FIELDS.map((field) => `md5(a.${field})`).join(" || ':' || ");

// ---------------------------------------------------------------------------
// Snapshot: parse the VALUES rows out of historical seed migrations.
// ---------------------------------------------------------------------------

/**
 * Reads the values of a generated seed migration. The format is fixed by the
 * seed generator: '...' strings with '' escapes, ARRAY['..']::text[] and bare
 * booleans, 14 per row. Anything else is an error rather than a guess.
 */
function parseSeedRows(sql, label) {
  const header = `INSERT INTO articles (\n  ${SEED_COLUMNS.slice(0, 8).join(', ')},\n  ${SEED_COLUMNS.slice(8).join(', ')}\n)`;
  if (!sql.replace(/\r\n/g, '\n').includes(header)) {
    throw new Error(`${label}: unexpected INSERT column list`);
  }
  const start = sql.indexOf('(VALUES');
  const end = sql.indexOf(') AS seed(');
  if (start < 0 || end < 0) throw new Error(`${label}: no VALUES block`);
  const block = sql.slice(start + '(VALUES'.length, end);

  const values = [];
  let i = 0;
  const readString = () => {
    let out = '';
    i += 1;
    for (;;) {
      if (i >= block.length) throw new Error(`${label}: unterminated string`);
      if (block[i] === "'") {
        if (block[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        i += 1;
        return out;
      }
      out += block[i];
      i += 1;
    }
  };

  while (i < block.length) {
    const rest = block.slice(i);
    if (block[i] === "'") {
      values.push(readString());
    } else if (rest.startsWith('ARRAY[')) {
      i += 'ARRAY['.length;
      const items = [];
      while (block[i] !== ']') {
        if (block[i] === "'") items.push(readString());
        else if (block[i] === ',' || block[i] === ' ') i += 1;
        else throw new Error(`${label}: unexpected "${block[i]}" in array`);
      }
      if (!block.startsWith(']::text[]', i)) throw new Error(`${label}: untyped array`);
      i += ']::text[]'.length;
      values.push(items);
    } else if (/^(true|false)\b/.test(rest)) {
      const word = rest.startsWith('true') ? 'true' : 'false';
      values.push(word === 'true');
      i += word.length;
    } else if (/[\s(),]/.test(block[i])) {
      i += 1;
    } else {
      throw new Error(`${label}: unexpected "${block[i]}" at offset ${i}`);
    }
  }

  if (values.length % SEED_COLUMNS.length !== 0) {
    throw new Error(`${label}: ${values.length} values is not a whole number of rows`);
  }
  const rows = [];
  for (let r = 0; r < values.length; r += SEED_COLUMNS.length) {
    rows.push(Object.fromEntries(SEED_COLUMNS.map((col, c) => [col, values[r + c]])));
  }
  return rows;
}

function buildSnapshot() {
  const articles = {};
  for (const source of SEED_SOURCES) {
    const label = `${source.commit}:${source.path}`;
    const sql = execFileSync('git', ['show', label], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    for (const row of parseSeedRows(sql, label)) {
      const entry = (articles[row.slug] ??= { seeded: [], restore: null });
      const fp = fingerprint(row);
      const seen = entry.seeded.find((s) => s.fingerprint === fp);
      if (seen) seen.sources.push(label);
      else entry.seeded.push({ fingerprint: fp, sources: [label] });
      if (source === RESTORE_SOURCE) {
        entry.restore = Object.fromEntries(FIELDS.map((f) => [f, row[f]]));
      }
    }
  }
  for (const [slug, entry] of Object.entries(articles)) {
    if (!entry.restore) throw new Error(`${slug}: missing from ${RESTORE_SOURCE.commit}`);
  }
  const sorted = Object.fromEntries(
    Object.keys(articles)
      .sort()
      .map((slug) => [slug, articles[slug]])
  );
  writeFileSync(
    SNAPSHOT,
    `${JSON.stringify({ fields: FIELDS, sources: SEED_SOURCES, articles: sorted }, null, 2)}\n`
  );
  process.stderr.write(`wrote ${SNAPSHOT} (${Object.keys(sorted).length} slugs)\n`);
}

// ---------------------------------------------------------------------------
// Migration and rollback.
// ---------------------------------------------------------------------------

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;

function dollar(value) {
  if (value.includes(BODY_TAG) || value.includes(DO_TAG)) {
    throw new Error(`value contains a dollar-quote tag: ${value.slice(0, 60)}`);
  }
  return `${BODY_TAG}${value}${BODY_TAG}`;
}

function loadPlan() {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  const current = readArticles();

  const slugs = current.map(({ meta }) => meta.slug);
  const missing = slugs.filter((slug) => !snapshot.articles[slug]);
  const extra = Object.keys(snapshot.articles).filter((slug) => !slugs.includes(slug));
  if (missing.length || extra.length) {
    throw new Error(`snapshot and content/crm disagree: missing ${missing}, extra ${extra}`);
  }

  return current.map(({ meta, body }) => {
    const entry = snapshot.articles[meta.slug];
    const next = {
      content: body,
      excerpt: meta.excerpt,
      seo_title: meta.seo_title,
      seo_description: meta.seo_description,
    };
    return {
      slug: meta.slug,
      next,
      nextFingerprint: fingerprint(next),
      restore: entry.restore,
      restoreFingerprint: fingerprint(entry.restore),
      seededFingerprints: entry.seeded.map((s) => s.fingerprint),
    };
  });
}

/**
 * One guarded UPDATE per slug, driven by a VALUES list so the bookkeeping is
 * written once. A row is updated only when its fingerprint is one of `from`;
 * otherwise it is counted as already current, edited since seeding, or absent.
 */
function render({ header, rows }) {
  const valueRows = rows.map(
    (r) => `      (
        ${sqlString(r.slug)},
${FIELDS.map((f) => `        ${dollar(r.to[f])},`).join('\n')}
        ${sqlString(r.toFingerprint)},
        ARRAY[${r.from.map(sqlString).join(', ')}]::text[]
      )`
  );

  return `${header}

DO ${DO_TAG}
DECLARE
  r record;
  n integer;
  changed text[] := '{}';
  already text[] := '{}';
  skipped text[] := '{}';
  absent text[] := '{}';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
${valueRows.join(',\n')}
    ) AS v(slug, ${FIELDS.join(', ')}, to_fingerprint, from_fingerprints)
    ORDER BY slug
  LOOP
    UPDATE articles a
       SET ${FIELDS.map((f) => `${f} = r.${f}`).join(',\n           ')}
     WHERE a.slug = r.slug
       AND ${ROW_FINGERPRINT} = ANY (r.from_fingerprints);
    GET DIAGNOSTICS n = ROW_COUNT;

    IF n > 0 THEN
      changed := changed || r.slug;
    ELSIF EXISTS (
      SELECT 1 FROM articles a
       WHERE a.slug = r.slug AND ${ROW_FINGERPRINT} = r.to_fingerprint
    ) THEN
      already := already || r.slug;
    ELSIF EXISTS (SELECT 1 FROM articles a WHERE a.slug = r.slug) THEN
      skipped := skipped || r.slug;
    ELSE
      absent := absent || r.slug;
    END IF;
  END LOOP;

  -- Bump updated_at on the rows that changed, where the column exists.
  IF cardinality(changed) > 0 AND EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'articles'::regclass AND attname = 'updated_at' AND NOT attisdropped
  ) THEN
    EXECUTE 'UPDATE articles SET updated_at = now() WHERE slug = ANY ($1)' USING changed;
  END IF;

  RAISE NOTICE 'CRM articles updated: % (%)', cardinality(changed), array_to_string(changed, ', ');
  IF cardinality(already) > 0 THEN
    RAISE NOTICE 'CRM articles already current: %', array_to_string(already, ', ');
  END IF;
  IF cardinality(skipped) > 0 THEN
    RAISE NOTICE 'CRM articles skipped, edited since seeding: %', array_to_string(skipped, ', ');
  END IF;
  IF cardinality(absent) > 0 THEN
    RAISE NOTICE 'CRM articles not in the table: %', array_to_string(absent, ', ');
  END IF;
END
${DO_TAG};
`;
}

function migration(plan) {
  return render({
    header: `-- Push the f1601bf edits to the CRM articles into existing rows.
--
-- Generated by scripts/generate-article-content-update.mjs from content/crm/*.md
-- and scripts/data/crm-seeded-articles.json. Regenerate rather than editing.
--
-- The seed migrations only insert missing slugs, so rows already in the table
-- kept the old copy when content/crm was edited. This updates content,
-- excerpt, seo_title and seo_description on each row whose current values
-- still match a version a seed migration inserted. Rows edited in the admin since seeding match none and are left
-- alone; the NOTICE output names them. Safe to re-run.
--
-- Rollback: supabase/migrations/rollbacks/${MIGRATION_NAME}`,
    rows: plan.map((p) => ({
      slug: p.slug,
      to: p.next,
      toFingerprint: p.nextFingerprint,
      from: p.seededFingerprints,
    })),
  });
}

function rollback(plan) {
  return render({
    header: `-- Rollback for ${MIGRATION_NAME}
--
-- Generated by scripts/generate-article-content-update.mjs. Restores the copy
-- the industry seed carried at ${RESTORE_SOURCE.commit}, on rows that still hold exactly
-- what the forward migration wrote. Rows edited since are left alone and named in a
-- NOTICE. Where a row first came from an earlier seed version with slightly
-- different text, this restores the ${RESTORE_SOURCE.commit} text, not that earlier one.`,
    rows: plan.map((p) => ({
      slug: p.slug,
      to: p.restore,
      toFingerprint: p.restoreFingerprint,
      from: [p.nextFingerprint],
    })),
  });
}

const mode = process.argv[2];
if (mode === 'snapshot') {
  buildSnapshot();
} else if (mode === 'migration' || mode === 'rollback') {
  const plan = loadPlan();
  process.stdout.write(mode === 'migration' ? migration(plan) : rollback(plan));
} else {
  process.stderr.write(
    'usage: generate-article-content-update.mjs <migration|rollback|snapshot>\n'
  );
  process.exit(2);
}
