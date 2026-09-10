#!/usr/bin/env node
/**
 * Checks that every article the site prerenders also exists, published, in the
 * database the running app queries.
 *
 * Why this exists: the markdown in content/crm is prerendered into dist and
 * listed in sitemap.xml and rss.xml at build time, but the React app fetches
 * article bodies from Supabase by slug. Those are two independent sources, and
 * nothing connected them. When the seed migrations under supabase/migrations
 * have not been applied, every one of those URLs serves perfect prerendered
 * HTML to a crawler and then, the moment React mounts, replaces it with
 * "Article Not Found" for the human reading it. That failure is invisible to
 * the test suite, to the build, and to anything that does not execute
 * JavaScript against production.
 *
 *   npm run verify:content
 *
 * Credentials come from SUPABASE_URL/SUPABASE_ANON_KEY, or the VITE_ variants,
 * or wrangler.toml - the anon key is public by design and read-only under RLS.
 * Exits non-zero when an article is missing or unpublished.
 */

import { readFileSync, existsSync } from 'node:fs';
import { readArticles } from './lib/content.mjs';

/**
 * Compares the slugs the site publishes against the rows the database holds.
 * Kept pure and exported so it can be unit tested without a network.
 */
export function diffArticles(expectedSlugs, rows) {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const missing = expectedSlugs.filter((slug) => !bySlug.has(slug));
  const unpublished = expectedSlugs.filter((slug) => bySlug.get(slug)?.published === false);
  return { missing, unpublished, ok: missing.length === 0 && unpublished.length === 0 };
}

function readCredentials() {
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if ((!url || !key) && existsSync('wrangler.toml')) {
    const toml = readFileSync('wrangler.toml', 'utf8');
    url = url || toml.match(/VITE_SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
    key = key || toml.match(/VITE_SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)?.[1];
  }

  return { url, key };
}

async function fetchArticles(url, key, slugs) {
  const filter = `in.(${slugs.map((slug) => `"${slug}"`).join(',')})`;
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/articles?select=slug,published&slug=${encodeURIComponent(filter)}`;
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${url}`);
  }
  return response.json();
}

// Running as a script rather than being imported by a test.
if (process.argv[1] && process.argv[1].endsWith('verify-content.mjs')) {
  const articles = readArticles().filter(({ meta }) => meta.published);
  const slugs = articles.map(({ meta }) => meta.slug);
  const { url, key } = readCredentials();

  if (!url || !key) {
    console.error('verify:content: no Supabase URL/anon key found in env or wrangler.toml');
    process.exit(2);
  }

  let rows;
  try {
    rows = await fetchArticles(url, key, slugs);
  } catch (error) {
    console.error(`verify:content: could not reach the database - ${error.message}`);
    process.exit(2);
  }

  const { missing, unpublished, ok } = diffArticles(slugs, rows);

  if (ok) {
    console.log(`verify:content: all ${slugs.length} prerendered articles are live in the database`);
    process.exit(0);
  }

  console.error(
    `verify:content: ${missing.length + unpublished.length} of ${slugs.length} prerendered articles are not readable in the app.\n` +
      'Every URL below serves prerendered HTML to a crawler and then renders "Article Not Found" once React mounts.\n'
  );
  for (const slug of missing) console.error(`  missing from the database  /news/${slug}`);
  for (const slug of unpublished) console.error(`  present but unpublished   /news/${slug}`);
  console.error(
    '\nFix: apply the seed migrations in supabase/migrations (20260811000002_seed_crm_pillar_articles.sql,\n' +
      '20260814000000_seed_crm_commercial_articles.sql, 20260814000003_seed_crm_industry_articles.sql)\n' +
      'against the database, or regenerate one with `node scripts/generate-article-seed.mjs`.'
  );
  process.exit(1);
}
