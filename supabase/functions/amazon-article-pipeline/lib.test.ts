import { assertEquals, assert } from '../_shared/test-asserts.ts';
import {
  applyProductLinks,
  buildAffiliateUrl,
  extractASIN,
  filterProducts,
  isPlaceholderTag,
  normalizeSerpAmazon,
  rankProducts,
  restrictImages,
  type Product,
} from './lib.ts';

const product = (asin: string, overrides: Partial<Product> = {}): Product => ({
  asin,
  title: `Product ${asin}`,
  brand: '',
  rating: 4.5,
  ratingCount: 1000,
  price: 50,
  imageUrl: `https://m.media-amazon.com/images/I/${asin}.jpg`,
  bulletPoints: [],
  ...overrides,
});

Deno.test('extractASIN reads dp, gp/product and bare forms', () => {
  assertEquals(extractASIN('https://www.amazon.com/Some-Thing/dp/B08N5WRWNW/ref=x'), 'B08N5WRWNW');
  assertEquals(extractASIN('https://www.amazon.com/gp/product/B08N5WRWNW'), 'B08N5WRWNW');
  assertEquals(extractASIN('https://www.google.com/shopping/product/123'), null);
});

Deno.test('normalizeSerpAmazon takes the ASIN field, skips sponsored and unusable results', () => {
  const products = normalizeSerpAmazon({
    organic_results: [
      {
        asin: 'B000000001',
        title: 'Desk lamp',
        rating: 4.6,
        reviews: 12873,
        extracted_price: 39.99,
        thumbnail: 'https://m.media-amazon.com/a.jpg',
      },
      { asin: 'B000000002', title: 'Sponsored lamp', sponsored: true },
      { title: 'No ASIN anywhere', link: 'https://www.amazon.com/s?k=x' },
      {
        link: 'https://www.amazon.com/dp/B000000003',
        title: 'Lamp from link',
        price: '$19.50',
        reviews: '1,204',
      },
    ],
  });
  assertEquals(
    products.map((p) => p.asin),
    ['B000000001', 'B000000003']
  );
  assertEquals(products[0].ratingCount, 12873);
  assertEquals(products[1].price, 19.5);
  assertEquals(products[1].ratingCount, 1204);
  assertEquals(normalizeSerpAmazon({}), []);
});

Deno.test('filterProducts applies rating and price limits but lets missing values through', () => {
  const kept = filterProducts(
    [
      product('B000000001', { rating: 3.9 }),
      product('B000000002', { price: 500 }),
      product('B000000003', { rating: 0, price: 0 }),
      product('B000000004'),
      product('B000000004'),
    ],
    { minRating: 4, priceMax: 200 }
  );
  assertEquals(
    kept.map((p) => p.asin),
    ['B000000003', 'B000000004']
  );
});

Deno.test('rankProducts weighs review volume, so a few perfect ratings lose', () => {
  const ranked = rankProducts([
    product('B000000001', { rating: 4.9, ratingCount: 12 }),
    product('B000000002', { rating: 4.6, ratingCount: 20000 }),
  ]);
  assertEquals(ranked[0].asin, 'B000000002');
});

Deno.test('buildAffiliateUrl carries the tag', () => {
  const url = new URL(buildAffiliateUrl('B000000001', 'dan-20'));
  assertEquals(url.pathname, '/dp/B000000001');
  assertEquals(url.searchParams.get('tag'), 'dan-20');
});

Deno.test(
  'applyProductLinks gives each product its own link, which the old placeholder did not',
  () => {
    const products = [product('B000000001'), product('B000000002')];
    const { content, unknown, linked } = applyProductLinks(
      '![One]({{IMAGE:B000000001}}) [Buy one]({{AMAZON:B000000001}}) [Buy two]({{ AMAZON : B000000002 }})',
      products,
      'dan-20'
    );
    assert(content.includes('https://m.media-amazon.com/images/I/B000000001.jpg'));
    assert(content.includes('/dp/B000000001?tag=dan-20'));
    assert(content.includes('/dp/B000000002?tag=dan-20'));
    assertEquals(unknown, []);
    assertEquals(linked.sort(), ['B000000001', 'B000000002']);
  }
);

Deno.test('applyProductLinks unlinks tokens for unknown ASINs and the legacy placeholder', () => {
  const { content, unknown } = applyProductLinks(
    '![x]({{IMAGE:B999999999}}) [Buy]({{AMAZON:B999999999}}) [Old](AMAZON_LINK_PLACEHOLDER)',
    [product('B000000001')],
    'dan-20'
  );
  assertEquals(content, ' Buy Old');
  assertEquals(unknown, ['B999999999', 'B999999999']);
});

Deno.test('restrictImages drops images the pipeline did not supply', () => {
  const out = restrictImages(
    '![a](https://m.media-amazon.com/ok.jpg) ![b](https://m.media-amazon.com/invented.jpg)',
    ['https://m.media-amazon.com/ok.jpg']
  );
  assertEquals(out, '![a](https://m.media-amazon.com/ok.jpg) ');
});

Deno.test('isPlaceholderTag catches the migration default and blanks', () => {
  assert(isPlaceholderTag('your-tag-20'));
  assert(isPlaceholderTag(''));
  assert(isPlaceholderTag(null));
  assert(!isPlaceholderTag('danpearson-20'));
});
