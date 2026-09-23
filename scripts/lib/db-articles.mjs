/**
 * Published articles that live only in the database, shaped like the markdown
 * articles in content/ so the prerenderer can treat both the same way.
 *
 * Why: the daily AI news brief and the Amazon buying guides are written
 * straight into Supabase. Before this, the build never saw them, so each one
 * shipped as an empty <div id="root"> with no sitemap entry and no RSS item.
 * The AI crawlers that matter for citation (GPTBot, ClaudeBot, PerplexityBot)
 * do not run JavaScript, so to them those posts did not exist.
 *
 * The fetch uses the public anon key and the same RLS-filtered read the site
 * itself makes, so it can see nothing a visitor cannot. A failed fetch warns
 * and returns [] rather than failing the build: a deploy with yesterday's
 * static pages is better than no deploy.
 */

import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const COLUMNS = [
  'slug',
  'title',
  'excerpt',
  'content',
  'category',
  'tags',
  'author',
  'read_time',
  'featured',
  'seo_title',
  'seo_description',
  'seo_keywords',
  'target_keyword',
  'image_url',
  'created_at',
  'updated_at',
].join(',');

const toDate = (value) => (value ? String(value).slice(0, 10) : undefined);

/** Maps a Supabase row onto the { meta, body } shape readArticles() returns. */
export function toContentArticle(row) {
  const published = toDate(row.created_at) || new Date().toISOString().slice(0, 10);
  const updated = toDate(row.updated_at);
  return {
    meta: {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt || '',
      category: row.category || 'News',
      tags: Array.isArray(row.tags) ? row.tags : [],
      author: row.author || 'Dan Pearson',
      read_time: row.read_time || '',
      featured: Boolean(row.featured),
      published: true,
      published_at: published,
      // A lastmod earlier than the publish date is always a data error.
      updated_at: updated && updated > published ? updated : undefined,
      published_iso: row.created_at || `${published}T12:00:00Z`,
      seo_title: row.seo_title || row.title,
      seo_description: row.seo_description || row.excerpt || '',
      seo_keywords: Array.isArray(row.seo_keywords) ? row.seo_keywords : [],
      target_keyword: row.target_keyword || '',
      image_url: row.image_url || '',
      source: 'database',
    },
    body: String(row.content || '').trim(),
  };
}

export async function fetchDbArticles({
  url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  fetchImpl = globalThis.fetch,
  timeoutMs = 20_000,
  limit = 1000,
} = {}) {
  if (!url || !key) {
    console.warn(
      'prerender: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set; database articles skipped'
    );
    return [];
  }

  const endpoint =
    `${url.replace(/\/+$/, '')}/rest/v1/articles` +
    `?select=${COLUMNS}&published=eq.true&order=created_at.desc&limit=${limit}`;

  try {
    const response = await fetchImpl(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.warn(
        `prerender: articles fetch returned ${response.status}; database articles skipped`
      );
      return [];
    }
    const rows = await response.json();
    return Array.isArray(rows)
      ? rows
          // The slug becomes a file path under dist/, so nothing but the
          // characters slugify produces gets through.
          .filter(
            (row) => /^[a-z0-9][a-z0-9-]*$/i.test(row?.slug || '') && row?.title && row?.content
          )
          .map(toContentArticle)
      : [];
  } catch (error) {
    console.warn(`prerender: articles fetch failed (${error.message}); database articles skipped`);
    return [];
  }
}

let purifier;

/**
 * Sanitizes rendered article HTML before it is written into a static page.
 * The React page already runs DOMPurify on the same content; the static copy
 * needs the same treatment because it is served before any of that runs.
 * Older Amazon posts are raw HTML, and every body here came from a model.
 */
export function sanitizeArticleHtml(html) {
  if (!purifier) purifier = DOMPurify(new JSDOM('').window);
  return purifier.sanitize(html, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['style'],
    ALLOW_DATA_ATTR: false,
  });
}

/** Marks outbound Amazon links as paid, as Google's link-spam policy requires. */
export function markAffiliateLinks(html) {
  return html.replace(
    /<a\s([^>]*href="https?:\/\/(?:www\.)?(?:amazon\.[a-z.]+|amzn\.to)[^"]*"[^>]*)>/gi,
    (tag, attrs) =>
      /\srel=/.test(` ${attrs}`) ? tag : `<a ${attrs} rel="sponsored nofollow noopener">`
  );
}
