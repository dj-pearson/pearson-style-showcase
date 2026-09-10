import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build script, no types
import { renderModule, renderIndexModule } from '../generate-article-fallback.mjs';
// @ts-expect-error - plain .mjs helper shared with the build scripts, no types
import { readArticles } from '../lib/content.mjs';
import { readFileSync } from 'node:fs';
import { CRM_ARTICLES, findStaticArticle } from '../../src/content/crm-articles.generated';

/**
 * The generated module is committed so dev and test runs need no build step,
 * which means it can go stale against the markdown. A stale fallback is worse
 * than none: the page would render copy nobody reviewed. Fail here instead.
 */
describe('crm-articles.generated.ts', () => {
  it('is up to date with content/crm', () => {
    const onDisk = readFileSync('src/content/crm-articles.generated.ts', 'utf8');
    expect(onDisk).toBe(renderModule(readArticles()));
  });

  it('keeps the bodyless index in step with the markdown too', () => {
    const onDisk = readFileSync('src/content/crm-article-index.generated.ts', 'utf8');
    expect(onDisk).toBe(renderIndexModule(readArticles()));
  });

  it('keeps article bodies out of the index module', () => {
    const onDisk = readFileSync('src/content/crm-article-index.generated.ts', 'utf8');
    expect(onDisk).not.toContain('"content"');
  });

  it('carries every published article', () => {
    const published = readArticles().filter(
      (a: { meta: { published: boolean } }) => a.meta.published
    );
    expect(CRM_ARTICLES).toHaveLength(published.length);
  });

  it('finds an article by slug and misses cleanly', () => {
    const first = CRM_ARTICLES[0];
    expect(findStaticArticle(first.slug)?.title).toBe(first.title);
    expect(findStaticArticle('no-such-article')).toBeUndefined();
  });

  it('gives every entry a body and a date', () => {
    for (const article of CRM_ARTICLES) {
      expect(article.content.length).toBeGreaterThan(500);
      expect(article.published_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
