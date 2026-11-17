import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PACKAGE_ROOT } from '../paths.js';
import { MemoryStore } from '../testing/memory-store.js';
import { extractReadable, parseLlmsTxt, parseSitemap, selectUrls } from './extract.js';
import { PRODUCT_SITES } from './products.js';
import { refreshSources, type FetchText } from './refresh.js';

const fx = (name: string) =>
  readFileSync(join(PACKAGE_ROOT, 'test/fixtures/sources', name), 'utf8');
const article = fx('article.html');
const thin = fx('thin.html');
const sitemap = fx('sitemap.xml');
const llms = fx('llms.txt');

/** A fake site: eatpal answers from fixtures, every other host is down. No network. */
function fakeSite(overrides: Record<string, string | null> = {}): {
  fetcher: FetchText;
  requested: string[];
} {
  const requested: string[] = [];
  const pages: Record<string, string | null> = {
    'https://tryeatpal.com/llms.txt': llms,
    'https://tryeatpal.com/sitemap.xml': sitemap,
    'https://tryeatpal.com/': article.replace('Building a safe foods list', 'EatPal home'),
    'https://tryeatpal.com/features/food-chaining': article.replace(
      /safe foods list/g,
      'food chain'
    ),
    'https://tryeatpal.com/features/grocery-lists': article.replace(
      /safe foods list/g,
      'grocery list'
    ),
    'https://tryeatpal.com/blog/safe-foods-list': article,
    'https://tryeatpal.com/blog/thin-page': thin,
    'https://tryeatpal.com/about': article.replace(/safe foods list/g, 'about page'),
    ...overrides,
  };
  const fetcher: FetchText = async (url) => {
    requested.push(url);
    if (!url.startsWith('https://tryeatpal.com')) throw new Error('getaddrinfo ENOTFOUND');
    const body = pages[url];
    if (body == null) return { status: 404, text: 'not found', contentType: 'text/plain' };
    return { status: 200, text: body, contentType: 'text/html' };
  };
  return { fetcher, requested };
}

describe('product sites', () => {
  it('maps each product to its public site', () => {
    expect(PRODUCT_SITES).toEqual({
      gradethread: 'https://gradethread.com',
      eatpal: 'https://tryeatpal.com',
      brikly: 'https://brikly.net',
      printyx: 'https://printyx.net',
      agentbio: 'https://agentbio.net',
    });
  });
});

describe('extractReadable', () => {
  it('keeps the article and drops scripts, styles, nav and footer', () => {
    const { title, bodyText } = extractReadable(article);
    expect(title).toBe('Building a safe foods list');
    expect(bodyText).toContain(
      'A safe foods list is every food your child will eat without a fight'
    );
    expect(bodyText).toContain('Why texture comes first');
    expect(bodyText).toContain('Crunchy and dry');
    expect(bodyText).not.toContain('do-not-extract');
    expect(bodyText).not.toContain('Log in');
    expect(bodyText).not.toContain('Copyright');
    expect(bodyText).not.toContain('color:red');
  });

  it('returns almost nothing for an empty app shell', () => {
    expect(extractReadable(thin).bodyText.length).toBeLessThan(20);
  });
});

describe('url discovery', () => {
  it('reads sitemap locs and llms.txt links', () => {
    expect(parseSitemap(sitemap).urls).toHaveLength(10);
    expect(parseLlmsTxt(llms)).toEqual([
      'https://tryeatpal.com/features/food-chaining',
      'https://tryeatpal.com/features/grocery-lists',
      'https://tryeatpal.com/about',
    ]);
  });

  it('puts blog and feature pages first and drops legal, auth, pricing, assets and other hosts', () => {
    const urls = selectUrls(
      [...parseLlmsTxt(llms), ...parseSitemap(sitemap).urls],
      'https://tryeatpal.com'
    );
    expect(urls).toEqual([
      'https://tryeatpal.com/blog/safe-foods-list',
      'https://tryeatpal.com/blog/thin-page',
      'https://tryeatpal.com/features/food-chaining',
      'https://tryeatpal.com/features/grocery-lists',
      'https://tryeatpal.com/',
      'https://tryeatpal.com/about',
    ]);
  });

  it('caps the list at the limit', () => {
    const many = Array.from({ length: 80 }, (_, i) => `https://tryeatpal.com/blog/post-${i}`);
    expect(selectUrls(many, 'https://tryeatpal.com', 40)).toHaveLength(40);
  });
});

describe('refreshSources', () => {
  const now = new Date('2026-11-17T12:00:00Z');

  it('caches the readable pages plus llms.txt and skips the empty shell', async () => {
    const store = new MemoryStore();
    const { fetcher } = fakeSite();
    const [r] = await refreshSources(store, { products: ['eatpal'], fetcher, now });
    expect(r).toMatchObject({ outcome: 'refreshed', written: 6, tooShort: 1, unchanged: 0 });
    const urls = (await store.listSourceItems('eatpal')).map((s) => s.url).sort();
    expect(urls).toContain('https://tryeatpal.com/llms.txt');
    expect(urls).toContain('https://tryeatpal.com/blog/safe-foods-list');
    expect(urls).not.toContain('https://tryeatpal.com/blog/thin-page');
    expect(urls).not.toContain('https://tryeatpal.com/pricing');
  });

  it('does not fetch again inside 24 hours', async () => {
    const store = new MemoryStore();
    const first = fakeSite();
    await refreshSources(store, { products: ['eatpal'], fetcher: first.fetcher, now });
    const second = fakeSite();
    const later = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const [r] = await refreshSources(store, {
      products: ['eatpal'],
      fetcher: second.fetcher,
      now: later,
    });
    expect(r!.outcome).toBe('fresh');
    expect(second.requested).toEqual([]);
  });

  it('after 24 hours rewrites only the page whose text changed', async () => {
    const store = new MemoryStore();
    await refreshSources(store, { products: ['eatpal'], fetcher: fakeSite().fetcher, now });
    const before = await store.listSourceItems('eatpal');
    const changed = fakeSite({
      'https://tryeatpal.com/about': article.replace(
        /safe foods list/g,
        'about page, now with a new paragraph'
      ),
    });
    const later = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const [r] = await refreshSources(store, {
      products: ['eatpal'],
      fetcher: changed.fetcher,
      now: later,
    });
    expect(r).toMatchObject({ outcome: 'refreshed', written: 1, unchanged: 5 });
    const after = await store.listSourceItems('eatpal');
    const hashChanged = after.filter(
      (a) => before.find((b) => b.url === a.url)!.content_hash !== a.content_hash
    );
    expect(hashChanged.map((a) => a.url)).toEqual(['https://tryeatpal.com/about']);
  });

  it('keeps going when one product is unreachable', async () => {
    const store = new MemoryStore();
    const { fetcher } = fakeSite();
    const results = await refreshSources(store, {
      products: ['gradethread', 'eatpal'],
      fetcher,
      now,
    });
    expect(results.map((r) => [r.product, r.outcome])).toEqual([
      ['gradethread', 'failed'],
      ['eatpal', 'refreshed'],
    ]);
    expect(await store.listSourceItems('eatpal')).not.toHaveLength(0);
    expect(await store.listSourceItems('gradethread')).toHaveLength(0);
  });

  it('keeps going when the store throws for one product', async () => {
    const store = new MemoryStore();
    const real = store.latestFetch.bind(store);
    store.latestFetch = async (p) => {
      if (p === 'gradethread') throw new Error('db down');
      return real(p);
    };
    const results = await refreshSources(store, {
      products: ['gradethread', 'eatpal'],
      fetcher: fakeSite().fetcher,
      now,
    });
    expect(results[0]).toMatchObject({ outcome: 'failed', error: 'db down' });
    expect(results[1]!.outcome).toBe('refreshed');
  });
});
