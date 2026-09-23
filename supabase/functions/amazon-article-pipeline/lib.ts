/**
 * Pure helpers for the Amazon affiliate pipeline: product normalisation,
 * affiliate link construction and link substitution.
 *
 * Split from index.ts so the parts that decide where money goes (which ASIN a
 * "Check price" button points at, and whether it carries the tag) are
 * unit-tested. No Deno globals, no imports.
 */

export interface Product {
  asin: string;
  title: string;
  brand: string;
  rating: number;
  ratingCount: number;
  price: number;
  imageUrl: string;
  bulletPoints: string[];
}

/** The migration default. A post published with it earns nothing. */
export const PLACEHOLDER_TAGS = new Set(['', 'your-tag-20']);

export function isPlaceholderTag(tag: string | null | undefined): boolean {
  return PLACEHOLDER_TAGS.has((tag || '').trim());
}

export function extractASIN(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/,
    /\/gp\/product\/([A-Z0-9]{10})/,
    /\/product\/([A-Z0-9]{10})/,
    /amazon\.com\/([A-Z0-9]{10})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/**
 * SerpAPI's Amazon engine (engine=amazon). Unlike the Google Shopping engine
 * the previous version relied on, it returns the ASIN directly; Google
 * Shopping now links to google.com product pages, so extracting an ASIN from
 * its links found nothing and every run came back empty.
 */
// deno-lint-ignore no-explicit-any
export function normalizeSerpAmazon(data: any): Product[] {
  // deno-lint-ignore no-explicit-any
  const results: any[] = Array.isArray(data?.organic_results) ? data.organic_results : [];
  return results
    .filter((item) => !item?.sponsored)
    .map((item) => {
      const asin =
        typeof item?.asin === 'string' && /^[A-Z0-9]{10}$/.test(item.asin)
          ? item.asin
          : extractASIN(String(item?.link || ''));
      if (!asin) return null;
      return {
        asin,
        title: String(item.title || '').trim(),
        brand: String(item.brand || '').trim(),
        rating: toNumber(item.rating),
        ratingCount: Math.round(toNumber(item.reviews ?? item.ratings_total)),
        price: toNumber(item.extracted_price ?? item.price),
        imageUrl: String(item.thumbnail || ''),
        bulletPoints: Array.isArray(item.extensions) ? item.extensions.map(String) : [],
      } as Product;
    })
    .filter((p): p is Product => p !== null && Boolean(p.title));
}

export interface ProductFilter {
  minRating?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
}

/**
 * Settings-driven filter. A product with no rating or no price passes the
 * corresponding check, because the fallback search sources often omit both
 * and rejecting them would leave nothing to write about.
 */
export function filterProducts(products: Product[], filter: ProductFilter): Product[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    if (!p.asin || seen.has(p.asin)) return false;
    seen.add(p.asin);
    if (filter.minRating && p.rating > 0 && p.rating < filter.minRating) return false;
    if (filter.priceMin && p.price > 0 && p.price < filter.priceMin) return false;
    if (filter.priceMax && p.price > 0 && p.price > filter.priceMax) return false;
    return true;
  });
}

/** Rank by rating weighted by review volume, so 4.9 from 12 reviews loses to 4.6 from 20,000. */
export function rankProducts(products: Product[]): Product[] {
  const score = (p: Product) => (p.rating || 3.5) * Math.log10((p.ratingCount || 0) + 10);
  return [...products].sort((a, b) => score(b) - score(a));
}

export function buildAffiliateUrl(asin: string, tag: string): string {
  const url = new URL(`https://www.amazon.com/dp/${asin}`);
  url.searchParams.set('tag', tag.trim());
  url.searchParams.set('linkCode', 'll1');
  url.searchParams.set('language', 'en_US');
  return url.toString();
}

/**
 * Replace the model's per-product tokens with real URLs.
 *
 *   {{AMAZON:B0XXXXXXXX}}  affiliate link for that ASIN
 *   {{IMAGE:B0XXXXXXXX}}   that product's image URL
 *
 * The old pipeline used a single AMAZON_LINK_PLACEHOLDER and replaced every
 * occurrence with the first product's URL, so every "Check price" button in a
 * five-product guide pointed at product one. Tokens for an ASIN the pipeline
 * did not supply are reported and removed, never guessed.
 */
export function applyProductLinks(
  content: string,
  products: Product[],
  tag: string
): { content: string; unknown: string[]; linked: string[] } {
  const byAsin = new Map(products.map((p) => [p.asin, p]));
  const unknown: string[] = [];
  const linked = new Set<string>();

  let out = content.replace(
    /\{\{\s*(AMAZON|IMAGE)\s*:\s*([A-Z0-9]{10})\s*\}\}/g,
    (_, kind, asin) => {
      const product = byAsin.get(asin);
      if (!product) {
        unknown.push(asin);
        return '';
      }
      if (kind === 'IMAGE') return product.imageUrl;
      linked.add(asin);
      return buildAffiliateUrl(asin, tag);
    }
  );

  // Images whose token resolved to an empty URL, and links left with no target.
  out = out.replace(/!\[[^\]]*\]\(\s*\)/g, '').replace(/\[([^\]]+)\]\(\s*\)/g, '$1');

  // The legacy single placeholder has no ASIN, so it cannot be resolved safely.
  out = out
    .replace(/\[([^\]]+)\]\(AMAZON_LINK_PLACEHOLDER\)/g, '$1')
    .replace(/AMAZON_LINK_PLACEHOLDER/g, '');

  return { content: out, unknown, linked: [...linked] };
}

/**
 * Markdown images the pipeline did not supply are removed. A model asked for a
 * product photo will otherwise invent a plausible Amazon image URL.
 */
export function restrictImages(content: string, allowedSrcs: string[]): string {
  const allowed = new Set(allowedSrcs.filter(Boolean));
  return content.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)[^)]*\)/g, (whole, _alt, src) =>
    allowed.has(src) ? whole : ''
  );
}

export const AFFILIATE_DISCLOSURE =
  '*Disclosure: this guide contains Amazon affiliate links. If you buy through them, this site earns a commission at no extra cost to you. Picks are based on published specifications, ratings and review volume, not hands-on testing. Prices and ratings were checked when this was written and change often.*';
