import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { normalizedErrorResponse, classifyError } from '../_shared/error-normalizer.ts';
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitResponse,
  type RateLimitConfig,
} from '../_shared/rate-limiter.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import {
  getAIConfigs,
  callAIWithConfig,
  parseJSONResponse,
  type AIConfig,
} from '../_shared/ai-helper.ts';
import { invokeFunctionAndForget } from '../_shared/invoke-function.ts';
import { triggerSiteRebuild } from '../_shared/site-publish.ts';
import {
  checkArticle,
  readTime,
  restrictLinks,
  slugify,
  stripInvisible,
} from '../_shared/content-quality.ts';
import {
  AFFILIATE_DISCLOSURE,
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

/**
 * Daily Amazon buying guide.
 *
 * Picks an unused search term, finds well-reviewed products for it, and writes
 * a research-based buying guide with a working affiliate link per product.
 * Runs once a day from maintenance-runner ("Daily Amazon Product Guide"); an
 * admin can also run it from the Amazon Pipeline tab.
 *
 * Body (all optional): { force, cacheOnly }
 */

// Manual runs only; the scheduler authenticates with the service-role key and
// is bounded by daily_post_count instead.
const PIPELINE_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 2,
  burstAllowance: 0,
  keyPrefix: 'amazon-pipeline',
};

const SITE = 'https://danpearson.net';
const MIN_PRODUCTS = 3;
const MAX_PRODUCTS = 5;

type Log = (level: string, message: string, ctx?: Record<string, unknown>) => Promise<void>;

async function fetchViaSerpAmazon(niche: string): Promise<Product[]> {
  const key = Deno.env.get('SERPAPI_KEY');
  if (!key) throw new Error('SERPAPI_KEY not configured');

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'amazon');
  url.searchParams.set('amazon_domain', 'amazon.com');
  url.searchParams.set('k', niche);
  url.searchParams.set('api_key', key);

  const response = await fetch(url.toString());
  if (!response.ok)
    throw new Error(`SerpAPI amazon ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return normalizeSerpAmazon(await response.json());
}

/** Fallback when SerpAPI is out of credit: Google Custom Search restricted to amazon.com. */
async function fetchViaGoogleSearch(niche: string): Promise<Product[]> {
  const key = Deno.env.get('GOOGLE_SEARCH_API_KEY');
  const cx = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
  if (!key || !cx)
    throw new Error('GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_ENGINE_ID not configured');

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', key);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', `best ${niche} site:amazon.com`);
  url.searchParams.set('num', '10');

  const response = await fetch(url.toString());
  if (!response.ok)
    throw new Error(`Google Search ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();

  // deno-lint-ignore no-explicit-any
  return (data.items || []).flatMap((item: any) => {
    const asin = extractASIN(item.link || '');
    if (!asin) return [];
    return [
      {
        asin,
        title: String(item.title || '')
          .replace(/^Amazon\.com:\s*/i, '')
          .replace(/\s*:\s*[^:]*$/, ''),
        brand: '',
        rating: 0,
        ratingCount: 0,
        price: 0,
        imageUrl: item.pagemap?.cse_image?.[0]?.src || '',
        bulletPoints: item.snippet ? [String(item.snippet)] : [],
      } as Product,
    ];
  });
}

async function fetchProducts(niche: string, log: Log): Promise<Product[]> {
  try {
    const products = await fetchViaSerpAmazon(niche);
    await log('info', `SerpAPI amazon returned ${products.length} products`);
    if (products.length) return products;
  } catch (error) {
    await log('warn', 'SerpAPI failed, trying Google Custom Search', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const products = await fetchViaGoogleSearch(niche);
  await log('info', `Google Custom Search returned ${products.length} products`);
  return products;
}

// deno-lint-ignore no-explicit-any
function fromCache(rows: any[]): Product[] {
  return rows.map((c) => ({
    asin: c.asin,
    title: c.title,
    brand: c.brand || '',
    rating: Number(c.rating) || 0,
    ratingCount: Number(c.rating_count) || 0,
    price: Number(c.price) || 0,
    imageUrl: c.image_url || '',
    bulletPoints: Array.isArray(c.bullet_points) ? c.bullet_points : [],
  }));
}

async function cachedProducts(supabase: SupabaseClient, niche: string, maxAgeDays: number) {
  const since = new Date(Date.now() - maxAgeDays * 86400_000).toISOString();
  const { data } = await supabase
    .from('amazon_products')
    .select('asin, title, brand, rating, rating_count, price, image_url, bullet_points')
    .eq('niche', niche)
    .gte('last_seen_at', since)
    .order('rating', { ascending: false })
    .limit(10);
  return fromCache(data || []);
}

interface GeneratedGuide {
  title: string;
  excerpt: string;
  content: string;
  seo_title: string;
  seo_description: string;
  target_keyword: string;
  seo_keywords: string[];
  products: {
    asin: string;
    summary: string;
    pros: string[];
    cons: string[];
    specs: Record<string, string>;
    best_for: string;
  }[];
}

async function generateGuide(
  products: Product[],
  niche: string,
  wordCount: number,
  minRating: number,
  aiConfigs: AIConfig[]
): Promise<{ guide: GeneratedGuide; model: string }> {
  const productList = products
    .map(
      (p, i) => `${i + 1}. ASIN ${p.asin}
   Title: ${p.title}
   ${p.brand ? `Brand/seller: ${p.brand}` : ''}
   ${p.price > 0 ? `Price at time of writing: $${p.price.toFixed(2)}` : 'Price: not available'}
   ${p.rating > 0 ? `Rating: ${p.rating}/5 from ${p.ratingCount.toLocaleString('en-US')} ratings` : 'Rating: not available'}
   ${p.imageUrl ? 'Image: available' : 'Image: none'}
   ${p.bulletPoints.length ? `Listed details: ${p.bulletPoints.slice(0, 6).join('; ')}` : ''}`
    )
    .join('\n\n');

  const prompt = `Write a buying guide for "${niche}" for danpearson.net.

PRODUCTS (the only products you may recommend; the only facts you may state about them):
${productList}

HOW THEY WERE CHOSEN (state this honestly in the article): searched Amazon for "${niche}", kept products rated ${minRating} or higher where a rating was available, and ranked by rating weighted by number of ratings. Nobody tested these products by hand. Never claim or imply hands-on testing ("we tried", "in our tests", "after a week of use").

LINK AND IMAGE TOKENS (the system replaces them; never write a real Amazon URL):
- Link to a product with {{AMAZON:<ASIN>}}, for example [Check price on Amazon]({{AMAZON:${products[0].asin}}})
- Show a product image with ![<product name>]({{IMAGE:<ASIN>}}) only when "Image: available"

STRUCTURE (markdown, in this order, no H1):
1. Opening paragraph. First sentence is bold and names the best pick for most people and why, in plain words. Two to four sentences total.
2. "## Quick picks": a markdown table with columns Pick, Product, Price, Rating, Best for. One row per product. Use "n/a" when a value is not available.
3. "## How we chose": two or three sentences stating the method above.
4. "## What to look for in ${niche}": the 3 to 5 things that actually separate good from bad in this category, and the common mistake buyers make. General category knowledge is fine here; do not attribute it to a specific product.
5. "## The picks": one "### " subsection per product, in ranked order. Each has: the image (if available), a paragraph on why it made the list, "**Good:**" and "**Watch out for:**" lines drawn only from the listed details, rating and price, "**Best for:**" one sentence, and a [Check price on Amazon]({{AMAZON:<ASIN>}}) link.
6. "## Which one should you buy": match each product to a type of buyer in one or two sentences each.
7. "## Frequently asked questions": 3 to 5 questions people search about ${niche}. Each question is its own bold line ending in "?", followed by a 2 to 4 sentence answer.

FACTS
- Do not invent specifications, dimensions, battery life, materials, warranty terms or awards. If a detail is not in the listed data, do not state it.
- Refer to prices as "about $X at the time of writing".

STYLE
- About ${wordCount} words. State the point first. Plain, specific, conversational. Use contractions.
- Never use: delve, dive into, unlock, elevate, empower, streamline, game-changing, cutting-edge, innovative, transformative, seamless, must-have, top-notch, moreover, furthermore, additionally, "In today's...", "When it comes to", "Look no further".
- At most one em dash. Straight quotes only.

Return ONLY this JSON object:
{
  "title": "Under 65 characters, includes '${niche}' and the year ${new Date().getUTCFullYear()}",
  "seo_title": "Under 60 characters, keyword first",
  "seo_description": "140 to 160 characters: the top pick and who it suits",
  "excerpt": "One or two sentences under 220 characters, answer first",
  "target_keyword": "${niche}",
  "seo_keywords": ["5 search phrases including one question"],
  "content": "the markdown guide",
  "products": [{"asin": "", "summary": "2 sentences", "pros": [""], "cons": [""], "specs": {"Price": "", "Rating": ""}, "best_for": ""}]
}`;

  const { response, usedConfig } = await callAIWithConfig(
    aiConfigs,
    'You write honest, research-based product buying guides. You never invent product facts and never claim hands-on testing. You return only valid JSON.',
    prompt,
    { temperature: 0.6, maxTokens: 12000, jsonMode: true }
  );
  return {
    guide: parseJSONResponse(response) as GeneratedGuide,
    model: `${usedConfig.provider} - ${usedConfig.model_name}`,
  };
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Spends SerpAPI and AI credits and publishes articles. Admins from the
  // dashboard, or maintenance-runner with the service-role key. Before
  // allowServiceRole was added here, the daily schedule had no way in.
  const auth = await requireAdmin(req, corsHeaders, { allowServiceRole: true });
  if (!auth.ok) return auth.response!;

  if (!auth.internal) {
    const rateLimitResult = checkRateLimit(getClientIdentifier(req), PIPELINE_RATE_LIMIT);
    if (!rateLimitResult.allowed) return createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => ({}));
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let runId: string | null = null;

  try {
    const aiConfigs = await getAIConfigs(supabase, 'normal', 'article_generation');

    const { data: settingsRow } = await supabase
      .from('amazon_pipeline_settings')
      .select('*')
      .maybeSingle();

    const settings = settingsRow || {
      id: null,
      niches: ['home office', 'travel gear', 'fitness'],
      daily_post_count: 1,
      min_rating: 4.0,
      price_min: null,
      price_max: null,
      review_required: false,
      word_count_target: 1500,
      amazon_tag: '',
      cache_only_mode: false,
    };

    // Daily quota and in-flight guard, replacing the old 10-second window
    // that let a slow run and a retry both publish.
    const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
    const { data: todaysRuns } = await supabase
      .from('amazon_pipeline_runs')
      .select('id, status, started_at')
      .gte('started_at', todayStart);

    const successes = (todaysRuns || []).filter(
      (r: { status: string }) => r.status === 'success'
    ).length;
    const inFlight = (todaysRuns || []).some(
      (r: { status: string; started_at: string }) =>
        r.status === 'running' && Date.now() - new Date(r.started_at).getTime() < 20 * 60_000
    );
    if (inFlight) {
      return json(
        { success: true, skipped: true, reason: 'a run is in progress' },
        200,
        corsHeaders
      );
    }
    if (!body.force && successes >= (settings.daily_post_count || 1)) {
      return json(
        {
          success: true,
          skipped: true,
          reason: `daily quota of ${settings.daily_post_count || 1} reached`,
        },
        200,
        corsHeaders
      );
    }

    const { data: run, error: runError } = await supabase
      .from('amazon_pipeline_runs')
      .insert({ status: 'running' })
      .select('id')
      .single();
    if (runError) throw runError;
    runId = run.id;

    const log: Log = async (level, message, ctx) => {
      await supabase
        .from('amazon_pipeline_logs')
        .insert({ run_id: runId, level, message, ctx: ctx || {} });
      console.log(`[amazon:${level}] ${message}`, ctx || '');
    };

    const cacheOnly = Boolean(settings.cache_only_mode) || Boolean(body.cacheOnly);
    await log('info', 'Pipeline started', {
      trigger: auth.internal ? 'scheduler' : 'admin',
      cache_only: cacheOnly,
    });

    // Seed search terms from the CSV in storage the first time.
    const { count } = await supabase
      .from('amazon_search_terms')
      .select('*', { count: 'exact', head: true });

    if (count === 0) {
      const { data: csvData, error: csvError } = await supabase.storage
        .from('admin-uploads')
        .download('amazon_ideas.csv');
      if (csvError) {
        await log('warn', 'amazon_ideas.csv not in admin-uploads; using settings niches', {
          error: csvError.message,
        });
      } else {
        const terms = (await csvData.text())
          .split('\n')
          .slice(1)
          .map((line) => {
            const [search_term, category] = line.split(',');
            return { search_term: search_term?.trim(), category: category?.trim() };
          })
          .filter((t) => t.search_term && t.category);
        for (let i = 0; i < terms.length; i += 100) {
          await supabase.from('amazon_search_terms').insert(terms.slice(i, i + 100));
        }
        await log('info', `Seeded ${terms.length} search terms from CSV`);
      }
    }

    // Try up to five unused terms until one yields enough products.
    let niche = '';
    let searchTermId = '';
    let products: Product[] = [];
    const filter = {
      minRating: settings.min_rating,
      priceMin: settings.price_min,
      priceMax: settings.price_max,
    };

    for (let attempt = 1; attempt <= 5 && products.length < MIN_PRODUCTS; attempt++) {
      const { data: unused } = await supabase
        .from('amazon_search_terms')
        .select('id, search_term, category')
        .is('used_at', null)
        .limit(50);

      if (unused && unused.length) {
        const term = unused[Math.floor(Math.random() * unused.length)];
        niche = term.search_term;
        searchTermId = term.id;
      } else {
        const niches = (settings.niches as string[]) || [];
        niche = niches[Math.floor(Math.random() * niches.length)] || 'home office';
        searchTermId = '';
      }
      await log('info', `Attempt ${attempt}: "${niche}"`);

      products = filterProducts(await cachedProducts(supabase, niche, 1), filter);

      if (products.length < MIN_PRODUCTS && !cacheOnly) {
        try {
          const fresh = filterProducts(await fetchProducts(niche, log), filter);
          for (const p of fresh) {
            await supabase.from('amazon_products').upsert(
              {
                asin: p.asin,
                title: p.title,
                brand: p.brand,
                rating: p.rating,
                rating_count: p.ratingCount,
                price: p.price,
                image_url: p.imageUrl,
                niche,
                bullet_points: p.bulletPoints,
                last_seen_at: new Date().toISOString(),
              },
              { onConflict: 'asin' }
            );
          }
          products = fresh;
        } catch (error) {
          await log('error', 'Product search failed; trying the 7-day cache', {
            error: error instanceof Error ? error.message : String(error),
          });
          products = filterProducts(await cachedProducts(supabase, niche, 7), filter);
        }
      }

      if (products.length < MIN_PRODUCTS) {
        await log('warn', `Only ${products.length} products for "${niche}"`);
        // Park a term that cannot produce a guide so it is not retried daily.
        if (searchTermId && !cacheOnly) {
          await supabase
            .from('amazon_search_terms')
            .update({ used_at: new Date().toISOString(), product_count: products.length })
            .eq('id', searchTermId);
        }
      }
    }

    if (products.length < MIN_PRODUCTS) {
      const message = cacheOnly
        ? 'No cached products for the available search terms. Disable cache-only mode or seed products.'
        : 'No search term produced at least three products after five attempts.';
      await supabase
        .from('amazon_pipeline_runs')
        .update({
          status: 'partial',
          finished_at: new Date().toISOString(),
          posts_created: 0,
          note: message,
        })
        .eq('id', runId);
      return json({ success: false, message, runId }, 503, corsHeaders);
    }

    products = rankProducts(products).slice(0, MAX_PRODUCTS);
    await log('info', `Writing guide for "${niche}" with ${products.length} products`);

    const { guide, model } = await generateGuide(
      products,
      niche,
      settings.word_count_target || 1500,
      settings.min_rating || 4,
      aiConfigs
    );
    if (!guide?.title || !guide?.content) throw new Error('Model returned no title or content');

    // The pipeline owns every URL: affiliate links from tokens, images only
    // from the product data, and no other outbound links.
    const tag = String(settings.amazon_tag || '');
    const linked = applyProductLinks(stripInvisible(guide.content), products, tag);
    const imaged = restrictImages(
      linked.content,
      products.map((p) => p.imageUrl)
    );
    const { content: restricted, removed } = restrictLinks(
      imaged,
      products.map((p) => buildAffiliateUrl(p.asin, tag)),
      []
    );
    const content = `${AFFILIATE_DISCLOSURE}\n\n${restricted}`;

    const title = stripInvisible(guide.title).trim();
    const excerpt = stripInvisible(guide.excerpt || guide.seo_description || '').trim();
    const report = checkArticle(
      {
        title,
        content,
        excerpt,
        seoTitle: guide.seo_title || title,
        seoDescription: guide.seo_description || excerpt,
      },
      {
        minWords: Math.min(900, Math.round((settings.word_count_target || 1500) * 0.6)),
        maxWords: Math.round((settings.word_count_target || 1500) * 2),
        requiredHeadings: ['Quick picks', 'How we chose', 'The picks', 'Frequently asked'],
        minFaqs: 3,
      }
    );
    const missingLinks = products.filter((p) => !linked.linked.includes(p.asin)).map((p) => p.asin);
    if (missingLinks.length) {
      report.issues.push({
        code: 'missing_affiliate_link',
        message: `No affiliate link for ${missingLinks.join(', ')}`,
        blocking: missingLinks.length === products.length,
      });
    }
    if (linked.unknown.length || removed.length) {
      report.issues.push({
        code: 'links_removed',
        message: `Removed links the pipeline did not supply: ${[...linked.unknown, ...removed].slice(0, 5).join(', ')}`,
        blocking: false,
      });
    }
    if (isPlaceholderTag(tag)) {
      report.issues.push({
        code: 'placeholder_tag',
        message:
          'Amazon Associates tag is not set (Amazon Pipeline > Settings), so links would earn nothing',
        blocking: true,
      });
    }
    report.ok = !report.issues.some((i) => i.blocking);

    const publish = report.ok && !settings.review_required;
    let slug = slugify(title);
    const { data: clash } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (clash) slug = `${slug}-${new Date().toISOString().slice(0, 10)}`;

    const { data: article, error: articleError } = await supabase
      .from('articles')
      .insert({
        title,
        slug,
        excerpt,
        content,
        category: 'Product Reviews',
        published: publish,
        author: 'Dan Pearson',
        seo_title: stripInvisible(guide.seo_title || title),
        seo_description: stripInvisible(guide.seo_description || excerpt),
        target_keyword: guide.target_keyword || niche,
        seo_keywords: Array.isArray(guide.seo_keywords) ? guide.seo_keywords.slice(0, 8) : [niche],
        tags: ['Amazon', 'Buying Guide', niche],
        read_time: readTime(content),
      })
      .select('id, title, slug, published')
      .single();
    if (articleError) throw articleError;

    if (searchTermId) {
      await supabase
        .from('amazon_search_terms')
        .update({
          used_at: new Date().toISOString(),
          article_id: article.id,
          product_count: products.length,
        })
        .eq('id', searchTermId);
    }

    const details = new Map((guide.products || []).map((p) => [p.asin, p]));
    for (const product of products) {
      const detail = details.get(product.asin);
      await supabase.from('article_products').insert({
        article_id: article.id,
        asin: product.asin,
        summary: detail?.summary || null,
        pros: detail?.pros || [],
        cons: detail?.cons || [],
        specs: detail?.specs || {},
        best_for: detail?.best_for || null,
        affiliate_url: buildAffiliateUrl(product.asin, tag),
      });
    }

    let rebuild = null;
    if (article.published) {
      await invokeFunctionAndForget('send-article-webhook', {
        articleId: article.id,
        isTest: false,
      });
      rebuild = await triggerSiteRebuild(`Amazon guide ${article.slug}`);
    }

    const note = publish
      ? `Published: ${article.title}`
      : `Saved as draft: ${
          settings.review_required
            ? 'review required'
            : report.issues
                .filter((i) => i.blocking)
                .map((i) => i.message)
                .join('; ')
        }`;

    await supabase
      .from('amazon_pipeline_runs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        posts_created: 1,
        posts_published: publish ? 1 : 0,
        note,
        errors: { quality: report.issues, wordCount: report.wordCount, model },
      })
      .eq('id', runId);

    if (settings.id) {
      await supabase
        .from('amazon_pipeline_settings')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', settings.id);
    }
    await log('info', note, { issues: report.issues.length });

    return json(
      {
        success: true,
        published: publish,
        article: {
          id: article.id,
          title: article.title,
          slug: article.slug,
          url: `${SITE}/news/${article.slug}`,
          published: publish,
        },
        products: products.length,
        quality: report,
        rebuild,
        runId,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    if (runId) {
      await supabase
        .from('amazon_pipeline_runs')
        .update({
          status: 'fail',
          finished_at: new Date().toISOString(),
          note: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
        })
        .eq('id', runId);
    }
    return normalizedErrorResponse(classifyError(error), error, corsHeaders);
  }
};
