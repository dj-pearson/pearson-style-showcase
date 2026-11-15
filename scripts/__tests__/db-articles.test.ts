import { describe, it, expect, vi } from 'vitest';
// @ts-expect-error - plain .mjs helper shared with the build scripts, no types
import {
  fetchDbArticles,
  toContentArticle,
  sanitizeArticleHtml,
  markAffiliateLinks,
  DbArticlesError,
} from '../lib/db-articles.mjs';

const row = {
  slug: 'openai-halves-batch-prices',
  title: 'OpenAI halves batch API prices',
  excerpt: 'Batch jobs got cheaper.',
  content: '**Lead.**\n\n## Key takeaways\n\n- One',
  category: 'AI News',
  tags: ['AI News', 'OpenAI'],
  author: 'Dan Pearson',
  read_time: '5 min read',
  featured: false,
  seo_title: null,
  seo_description: 'Batch jobs got cheaper for small teams.',
  seo_keywords: null,
  target_keyword: 'openai batch pricing',
  image_url: null,
  created_at: '2026-09-23T12:04:00+00:00',
  updated_at: '2026-09-23T12:04:00+00:00',
};

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('toContentArticle', () => {
  it('maps a row onto the markdown article shape the prerenderer expects', () => {
    const { meta, body } = toContentArticle(row);
    expect(meta.published_at).toBe('2026-09-23');
    expect(meta.published_iso).toBe('2026-09-23T12:04:00+00:00');
    expect(meta.seo_title).toBe(row.title);
    expect(meta.seo_keywords).toEqual([]);
    expect(meta.source).toBe('database');
    expect(body.startsWith('**Lead.**')).toBe(true);
  });

  it('drops an updated_at that is not after the publish date', () => {
    expect(toContentArticle(row).meta.updated_at).toBeUndefined();
    expect(toContentArticle({ ...row, updated_at: '2026-09-25T00:00:00Z' }).meta.updated_at).toBe(
      '2026-09-25'
    );
  });
});

describe('fetchDbArticles', () => {
  it('reads published articles with the anon key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse([row]));
    const articles = await fetchDbArticles({
      url: 'https://api.example.com/',
      key: 'anon',
      fetchImpl,
    });

    expect(articles).toHaveLength(1);
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint).toContain('https://api.example.com/rest/v1/articles?select=');
    expect(endpoint).toContain('published=eq.true');
    expect(init.headers.apikey).toBe('anon');
  });

  it('skips rows whose slug could escape dist/ or that have no body', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        okResponse([
          { ...row, slug: '../../etc/passwd' },
          { ...row, slug: 'nested/path' },
          { ...row, slug: 'empty', content: '' },
          row,
        ])
      );
    const articles = await fetchDbArticles({ url: 'https://x', key: 'k', fetchImpl });
    expect(articles.map((a: { meta: { slug: string } }) => a.meta.slug)).toEqual([row.slug]);
  });

  it('skips the database without failing when no credentials are set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = vi.fn();
    expect(await fetchDbArticles({ url: '', key: '', fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('throws when credentials are set and the request errors', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      fetchDbArticles({ url: 'https://x', key: 'k', fetchImpl: failing })
    ).rejects.toThrow(DbArticlesError);
    await expect(
      fetchDbArticles({ url: 'https://x', key: 'k', fetchImpl: failing })
    ).rejects.toThrow(/ECONNREFUSED/);
  });

  it('throws on a non-OK response', async () => {
    const denied = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(
      fetchDbArticles({ url: 'https://x', key: 'k', fetchImpl: denied })
    ).rejects.toThrow(/HTTP 401/);
  });

  it('throws when the body is not a JSON array', async () => {
    const notArray = vi.fn().mockResolvedValue(okResponse({ message: 'nope' }));
    await expect(
      fetchDbArticles({ url: 'https://x', key: 'k', fetchImpl: notArray })
    ).rejects.toThrow(DbArticlesError);

    const badJson = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    await expect(
      fetchDbArticles({ url: 'https://x', key: 'k', fetchImpl: badJson })
    ).rejects.toThrow(/not JSON/);
  });
});

describe('sanitizeArticleHtml', () => {
  it('removes scripts, event handlers and javascript: links from model-written HTML', () => {
    const html = sanitizeArticleHtml(
      '<p onclick="steal()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><iframe src="https://evil"></iframe><img src="https://m.media-amazon.com/a.jpg" alt="a">'
    );
    expect(html).not.toMatch(/script|onclick|javascript:|iframe/);
    expect(html).toContain('<p>Hi</p>');
    expect(html).toContain('src="https://m.media-amazon.com/a.jpg"');
  });
});

describe('markAffiliateLinks', () => {
  it('marks Amazon links as sponsored and leaves others alone', () => {
    const html = markAffiliateLinks(
      '<a href="https://www.amazon.com/dp/B000000001?tag=dan-20">Buy</a> <a href="https://techcrunch.com/x">Read</a>'
    );
    expect(html).toContain(
      '<a href="https://www.amazon.com/dp/B000000001?tag=dan-20" rel="sponsored nofollow noopener">Buy</a>'
    );
    expect(html).toContain('<a href="https://techcrunch.com/x">Read</a>');
  });
});
