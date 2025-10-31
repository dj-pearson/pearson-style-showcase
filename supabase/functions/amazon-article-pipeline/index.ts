import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AWSSignerV4 } from "https://deno.land/x/aws_sign_v4@1.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pipeline-secret',
};

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Fetch Amazon products using PA-API with proper AWS SigV4 signing
async function fetchAmazonProducts(niche: string, itemCount: number = 5, partnerTag: string) {
  const accessKey = Deno.env.get('AMAZON_ACCESS_KEY');
  const secretKey = Deno.env.get('AMAZON_SECRET_KEY');
  
  if (!accessKey || !secretKey) {
    throw new Error('Amazon API credentials not configured');
  }

  const host = 'webservices.amazon.com';
  const region = 'us-east-1';
  const service = 'ProductAdvertisingAPI';
  const method = 'POST';
  const path = '/paapi5/searchitems';
  const url = `https://${host}${path}`;

  const body = JSON.stringify({
    Marketplace: 'www.amazon.com',
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Keywords: niche,
    SearchIndex: 'All',
    ItemCount: itemCount,
    Resources: [
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'ItemInfo.Features',
      'ItemInfo.ByLineInfo',
      'Offers.Listings.Price'
    ]
  });

  const signer = new AWSSignerV4(region, {
    awsAccessKeyId: accessKey,
    awsSecretKey: secretKey,
  });

  // Initial jitter to avoid bursting at exact second
  await sleep(Math.floor(1300 + Math.random() * 700));

  // Retry with exponential backoff on 429/5xx
  const maxAttempts = 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Recreate and sign request each attempt to refresh date headers/signature
    const req = new Request(url, {
      method,
      headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-encoding': 'amz-1.0',
      'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
      },
      body,
    });

    const signed = await signer.sign(service, req);
    const response = await fetch(signed);

    if (response.ok) {
      return await response.json();
    }

    const errorText = await response.text();
    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      // Exponential backoff with jitter (500–800ms base per PRD, doubled each retry)
      const base = 700 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 300) + 100;
      await new Promise((res) => setTimeout(res, base + jitter));
      continue;
    }

    throw new Error(`Amazon API error: ${response.status} ${errorText}`);
  }

  throw new Error('Amazon API throttled: exceeded retry attempts');
}


// Fetch SEO data from DataForSEO
async function fetchSEOData(keyword: string) {
  const login = Deno.env.get('DATAFORSEO_API_LOGIN');
  const password = Deno.env.get('DATAFORSEO_API_PASSWORD');
  const auth = btoa(`${login}:${password}`);

  const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google/search_volume/live', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([{
      keywords: [keyword],
      language_code: 'en',
      location_code: 2840 // United States
    }])
  });

  if (!response.ok) {
    throw new Error(`DataForSEO API error: ${response.status}`);
  }

  return await response.json();
}

// Generate article content using Lovable AI
async function generateArticleContent(products: any[], niche: string, seoData: any, wordCount: number) {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  const prompt = `Create a comprehensive, SEO-optimized product review article about "${niche}" products. 

TARGET: ${wordCount} words

PRODUCTS TO REVIEW:
${products.map((p, i) => `${i + 1}. ${p.title} - $${p.price} - Rating: ${p.rating}/5 (${p.ratingCount} reviews)`).join('\n')}

REQUIREMENTS:
- Write in a natural, conversational, human tone (avoid AI-sounding language)
- Create a compelling hook that addresses buyer pain points
- Include a "Who This Is For" section
- Add a detailed buyer's guide section with key features to look for
- Review each product with:
  * Engaging summary
  * 3-4 genuine pros
  * 2-3 honest cons
  * Key specifications
  * "Best for" recommendation
- Add comparison insights where relevant
- Include 4-6 frequently asked questions with detailed answers
- Write a strong closing with clear next steps
- Use the keyword "${niche}" naturally throughout (in title, first 100 words, H1, one H2, and closing)
- Structure with clear H2 and H3 headings
- Make it genuinely helpful and informative, not promotional

Return ONLY valid JSON in this exact format:
{
  "title": "SEO-optimized title (max 60 chars)",
  "excerpt": "Compelling excerpt (max 160 chars)",
  "content": "Full HTML article content with proper heading tags",
  "seo_title": "Meta title (max 60 chars)",
  "seo_description": "Meta description (max 160 chars)",
  "target_keyword": "${niche}",
  "seo_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "products": [
    {
      "asin": "product ASIN",
      "summary": "Product summary",
      "pros": ["pro1", "pro2", "pro3"],
      "cons": ["con1", "con2"],
      "specs": {"spec1": "value1", "spec2": "value2"},
      "best_for": "Best for description"
    }
  ]
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are an expert product reviewer and SEO content writer. Always return valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI generation failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Extract JSON from markdown code blocks if present
  let jsonContent = content;
  if (content.includes('```json')) {
    jsonContent = content.split('```json')[1].split('```')[0].trim();
  } else if (content.includes('```')) {
    jsonContent = content.split('```')[1].split('```')[0].trim();
  }
  
  return JSON.parse(jsonContent);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Simple concurrency guard: if a run started in the last 10s and is still running, skip
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const { data: running } = await supabase
      .from('amazon_pipeline_runs')
      .select('id, started_at')
      .eq('status', 'running')
      .gte('started_at', tenSecondsAgo)
      .limit(1);

    if (running && running.length) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Pipeline busy. Try again shortly.'
      }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create run record
    const { data: run, error: runError } = await supabase
      .from('amazon_pipeline_runs')
      .insert({ status: 'running' })
      .select()
      .single();

    if (runError) throw runError;

    const runId = run.id;
    
    const log = async (level: string, message: string, ctx?: any) => {
      await supabase.from('amazon_pipeline_logs').insert({
        run_id: runId,
        level,
        message,
        ctx: ctx || {}
      });
      console.log(`[${level.toUpperCase()}] ${message}`, ctx || '');
    };

    await log('info', 'Pipeline started');

    // Fetch settings
    const { data: settings } = await supabase
      .from('amazon_pipeline_settings')
      .select('*')
      .single();

    if (!settings) {
      throw new Error('Pipeline settings not configured');
    }

    await log('info', 'Settings loaded', { niches: settings.niches });

    // Pick random niche
    const niches = settings.niches as string[];
    const niche = niches[Math.floor(Math.random() * niches.length)];
    
    await log('info', `Selected niche: ${niche}`);

    // Try cached products first (24h window)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cached, error: cacheError } = await supabase
      .from('amazon_products')
      .select('asin, title, brand, rating, rating_count, price, image_url, bullet_points')
      .eq('niche', niche)
      .gte('last_seen_at', twentyFourHoursAgo)
      .order('rating', { ascending: false })
      .limit(5);

    let products: any[] = [];

    if (cacheError) {
      await log('warn', 'Cache query failed', { error: cacheError.message });
    }

    if (cached && cached.length) {
      products = (cached as any[]).map((c) => ({
        asin: c.asin,
        title: c.title,
        brand: c.brand,
        rating: c.rating || 0,
        ratingCount: c.rating_count || 0,
        price: c.price || 0,
        imageUrl: c.image_url || '',
        bulletPoints: c.bullet_points || []
      }));

      products = products.filter((p) => (
        p.rating >= (settings.min_rating || 0) &&
        p.price > 0 &&
        (settings.price_min ? p.price >= settings.price_min : true) &&
        (settings.price_max ? p.price <= settings.price_max : true)
      ));

      if (products.length >= 3) {
        await log('info', `Using ${products.length} cached products`);
      } else {
        products = [];
      }
    }

    if (products.length < 3) {
      // Only call Amazon API if cache_only_mode is false
      if (!settings.cache_only_mode) {
        // Fetch Amazon products (reduced payload + backoff)
        await log('info', 'Fetching Amazon products');
        const amazonData = await fetchAmazonProducts(niche, 3, settings.amazon_tag);
      
        if (!amazonData.SearchResult?.Items) {
          throw new Error('No products found from Amazon');
        }

        products = amazonData.SearchResult.Items.map((item: any) => ({
          asin: item.ASIN,
          title: item.ItemInfo?.Title?.DisplayValue || 'Unknown',
          brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || '',
          rating: parseFloat(item.CustomerReviews?.StarRating?.Value || '0'),
          ratingCount: item.CustomerReviews?.Count || 0,
          price: parseFloat(item.Offers?.Listings?.[0]?.Price?.Amount || '0'),
          imageUrl: item.Images?.Primary?.Large?.URL || item.Images?.Primary?.Medium?.URL || '',
          bulletPoints: item.ItemInfo?.Features?.DisplayValues || []
        })).filter((p: any) => (
          p.rating >= (settings.min_rating || 0) &&
          p.price > 0 &&
          (settings.price_min ? p.price >= settings.price_min : true) &&
          (settings.price_max ? p.price <= settings.price_max : true)
        ));

        if (products.length === 0) {
          // Fallback to older cache (7 days)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: oldCache } = await supabase
            .from('amazon_products')
            .select('asin, title, brand, rating, rating_count, price, image_url, bullet_points')
            .eq('niche', niche)
            .gte('last_seen_at', sevenDaysAgo)
            .order('rating', { ascending: false })
            .limit(5);

          if (oldCache && oldCache.length) {
            products = (oldCache as any[]).map((c) => ({
              asin: c.asin,
              title: c.title,
              brand: c.brand,
              rating: c.rating || 0,
              ratingCount: c.rating_count || 0,
              price: c.price || 0,
              imageUrl: c.image_url || '',
              bulletPoints: c.bullet_points || []
            })).filter((p: any) => (
              p.rating >= (settings.min_rating || 0) &&
              p.price > 0 &&
              (settings.price_min ? p.price >= settings.price_min : true) &&
              (settings.price_max ? p.price <= settings.price_max : true)
            ));

            await log('info', `Using fallback cache: ${products.length} products`);
          }
        }

        // Store newly fetched products in DB
        if (products.length > 0) {
          for (const product of products) {
            await supabase.from('amazon_products').upsert({
              asin: product.asin,
              title: product.title,
              brand: product.brand,
              rating: product.rating,
              rating_count: product.ratingCount,
              price: product.price,
              image_url: product.imageUrl,
              niche: niche,
              bullet_points: product.bulletPoints,
              last_seen_at: new Date().toISOString()
            }, { onConflict: 'asin' });
          }
        }
      } else {
        await log('info', 'Cache-only mode enabled; skipping Amazon API');
      }
    }

    if (products.length === 0) {
      const message = settings.cache_only_mode 
        ? 'No cached products for this niche. Disable cache-only mode or seed products first.'
        : 'Amazon throttled; no products available and cache empty';

      await supabase
        .from('amazon_pipeline_runs')
        .update({
          status: 'partial',
          finished_at: new Date().toISOString(),
          posts_created: 0,
          posts_published: 0,
          note: message
        })
        .eq('id', runId);

      return new Response(JSON.stringify({
        success: false,
        message,
        runId
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 });
    }

    await log('info', `Using ${products.length} products`);

    // Fetch SEO data
    await log('info', 'Fetching SEO data');
    const seoData = await fetchSEOData(niche);

    // Generate article
    await log('info', 'Generating article content');
    const articleData = await generateArticleContent(
      products,
      niche,
      seoData,
      settings.word_count_target
    );

    // Create slug
    const slug = articleData.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Insert article
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .insert({
        title: articleData.title,
        slug: slug,
        excerpt: articleData.excerpt,
        content: articleData.content,
        category: 'Product Reviews',
        published: true,
        author: 'Build Desk Team',
        seo_title: articleData.seo_title,
        seo_description: articleData.seo_description,
        target_keyword: articleData.target_keyword,
        seo_keywords: articleData.seo_keywords,
        tags: ['Amazon', 'Product Review', niche],
        read_time: `${Math.ceil(settings.word_count_target / 200)} min read`
      })
      .select()
      .single();

    if (articleError) throw articleError;

    await log('info', `Article created: ${article.title}`);

    // Link products to article
    for (const productData of articleData.products) {
      const affiliateUrl = `https://www.amazon.com/dp/${productData.asin}/?tag=${settings.amazon_tag}`;
      
      await supabase.from('article_products').insert({
        article_id: article.id,
        asin: productData.asin,
        summary: productData.summary,
        pros: productData.pros,
        cons: productData.cons,
        specs: productData.specs,
        best_for: productData.best_for,
        affiliate_url: affiliateUrl
      });
    }

    // Update run status
    await supabase
      .from('amazon_pipeline_runs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        posts_created: 1,
        posts_published: 1,
        note: `Successfully created article: ${article.title}`
      })
      .eq('id', runId);

    // Update settings last run
    await supabase
      .from('amazon_pipeline_settings')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', settings.id);

    await log('info', 'Pipeline completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        article: {
          id: article.id,
          title: article.title,
          slug: article.slug,
          url: `https://yourdomain.com/news/${article.slug}`,
          published: true
        },
        products: products.length,
        runId: runId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pipeline error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
