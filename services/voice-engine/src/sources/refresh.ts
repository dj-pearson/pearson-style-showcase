import type { Store } from '../store.js';
import { PRODUCTS, type Product } from '../types.js';
import {
  MIN_BODY_CHARS,
  contentHash,
  extractReadable,
  parseLlmsTxt,
  parseSitemap,
  selectUrls,
} from './extract.js';
import { PRODUCT_SITES } from './products.js';

export const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_URLS = 40;
/** Generic on purpose: no name, email or project in outbound requests. */
const USER_AGENT = 'Mozilla/5.0 (compatible; content-fetcher/1.0)';

export type FetchText = (
  url: string
) => Promise<{ status: number; text: string; contentType: string }>;

export const fetchText: FetchText = async (url) => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,text/plain,application/xml;q=0.9,*/*;q=0.5',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });
  return {
    status: res.status,
    text: await res.text(),
    contentType: res.headers.get('content-type') ?? '',
  };
};

export interface ProductRefresh {
  product: Product;
  /** 'fresh' means the 24h gate held and nothing was fetched. */
  outcome: 'refreshed' | 'fresh' | 'failed';
  fetched: number;
  written: number;
  unchanged: number;
  tooShort: number;
  error?: string;
}

async function tryText(fetcher: FetchText, url: string): Promise<string | null> {
  try {
    const res = await fetcher(url);
    return res.status >= 200 && res.status < 300 ? res.text : null;
  } catch {
    return null;
  }
}

async function refreshProduct(
  store: Store,
  product: Product,
  fetcher: FetchText,
  now: Date
): Promise<ProductRefresh> {
  const result: ProductRefresh = {
    product,
    outcome: 'refreshed',
    fetched: 0,
    written: 0,
    unchanged: 0,
    tooShort: 0,
  };
  const base = PRODUCT_SITES[product];
  const stamp = now.toISOString();

  const candidates: string[] = [];
  const llms = await tryText(fetcher, `${base}/llms.txt`);
  // A 200 that is really the app's HTML shell is not an llms.txt.
  const llmsIsText = llms !== null && !/^\s*<(!doctype|html)/i.test(llms);
  if (llmsIsText) candidates.push(...parseLlmsTxt(llms));

  const sitemap = await tryText(fetcher, `${base}/sitemap.xml`);
  if (sitemap !== null) {
    const parsed = parseSitemap(sitemap);
    candidates.push(...parsed.urls);
    // One level of sitemap index is enough for sites this size.
    for (const child of parsed.sitemaps.slice(0, 5)) {
      const xml = await tryText(fetcher, child);
      if (xml !== null) candidates.push(...parseSitemap(xml).urls);
    }
  }

  if (llms === null && sitemap === null) {
    // Neither index answered. Fall back to the home page alone; if that fails too the product failed.
    candidates.push(`${base}/`);
  }

  // llms.txt is itself the densest plain-language description of the product.
  if (llmsIsText && llms.trim().length >= MIN_BODY_CHARS) {
    const body = llms.trim();
    const wrote = await store.upsertSourceItem(
      {
        product,
        url: `${base}/llms.txt`,
        title: `${product} llms.txt`,
        body_text: body,
        content_hash: contentHash(body),
      },
      stamp
    );
    result.fetched += 1;
    if (wrote) result.written += 1;
    else result.unchanged += 1;
  }

  let anyPageAnswered = false;
  for (const url of selectUrls(candidates, base, MAX_URLS)) {
    const html = await tryText(fetcher, url);
    if (html === null) continue;
    anyPageAnswered = true;
    result.fetched += 1;
    const { title, bodyText } = extractReadable(html);
    if (bodyText.length < MIN_BODY_CHARS) {
      result.tooShort += 1;
      continue;
    }
    const wrote = await store.upsertSourceItem(
      { product, url, title, body_text: bodyText, content_hash: contentHash(bodyText) },
      stamp
    );
    if (wrote) result.written += 1;
    else result.unchanged += 1;
  }

  if (!anyPageAnswered && !llmsIsText) {
    return { ...result, outcome: 'failed', error: 'no page on the site answered' };
  }
  // Stamp unchanged rows too, so the next run within 24h does not refetch.
  await store.touchSourceItems(product, stamp);
  return result;
}

/**
 * Refresh the cached pages for the given products (all five by default), at
 * most once per 24h each. One product failing never stops the others.
 */
export async function refreshSources(
  store: Store,
  opts: { products?: readonly Product[]; fetcher?: FetchText; now?: Date } = {}
): Promise<ProductRefresh[]> {
  const now = opts.now ?? new Date();
  const fetcher = opts.fetcher ?? fetchText;
  const results: ProductRefresh[] = [];
  for (const product of opts.products ?? PRODUCTS) {
    try {
      const last = await store.latestFetch(product);
      if (last && now.getTime() - new Date(last).getTime() < REFRESH_INTERVAL_MS) {
        results.push({
          product,
          outcome: 'fresh',
          fetched: 0,
          written: 0,
          unchanged: 0,
          tooShort: 0,
        });
        continue;
      }
      results.push(await refreshProduct(store, product, fetcher, now));
    } catch (err) {
      results.push({
        product,
        outcome: 'failed',
        fetched: 0,
        written: 0,
        unchanged: 0,
        tooShort: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
