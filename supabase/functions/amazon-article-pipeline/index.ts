import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pipeline-secret',
};

// AWS SigV4 signing for Amazon PA-API
async function signRequest(method: string, url: string, headers: Record<string, string>, body: string) {
  const accessKey = Deno.env.get('AMAZON_ACCESS_KEY');
  const secretKey = Deno.env.get('AMAZON_SECRET_KEY');
  
  const encoder = new TextEncoder();
  const algorithm = 'AWS4-HMAC-SHA256';
  const service = 'ProductAdvertisingAPIv1';
  const region = 'us-east-1';
  
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  
  // Canonical request
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k.toLowerCase()}:${headers[k]}`).join('\n');
  const signedHeaders = Object.keys(headers).sort().map(k => k.toLowerCase()).join(';');
  const hashedPayload = await crypto.subtle.digest('SHA-256', encoder.encode(body));
  const hexPayload = Array.from(new Uint8Array(hashedPayload)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const canonicalRequest = `${method}\n/paapi5/searchitems\n\n${canonicalHeaders}\n\n${signedHeaders}\n${hexPayload}`;
  const hashedCanonical = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));
  const hexCanonical = Array.from(new Uint8Array(hashedCanonical)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // String to sign
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${hexCanonical}`;
  
  // Signing key
  const key = await crypto.subtle.importKey('raw', encoder.encode(`AWS4${secretKey}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const dateKey = await crypto.subtle.sign('HMAC', key, encoder.encode(dateStamp));
  const dateRegionKey = await crypto.subtle.importKey('raw', dateKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const regionKey = await crypto.subtle.sign('HMAC', dateRegionKey, encoder.encode(region));
  const regionServiceKey = await crypto.subtle.importKey('raw', regionKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const serviceKey = await crypto.subtle.sign('HMAC', regionServiceKey, encoder.encode(service));
  const serviceRequestKey = await crypto.subtle.importKey('raw', serviceKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', serviceRequestKey, encoder.encode(stringToSign));
  const hexSignature = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${hexSignature}`;
}

// Fetch Amazon products using PA-API
async function fetchAmazonProducts(niche: string, itemCount: number = 5) {
  const host = 'webservices.amazon.com';
  const body = JSON.stringify({
    Marketplace: 'www.amazon.com',
    PartnerTag: 'your-tag-20', // Will be replaced with settings
    PartnerType: 'Associates',
    Keywords: niche,
    SearchIndex: 'All',
    ItemCount: itemCount,
    Resources: [
      'Images.Primary.Large',
      'ItemInfo.Title',
      'ItemInfo.Features',
      'ItemInfo.ByLineInfo',
      'Offers.Listings.Price',
      'CustomerReviews.StarRating',
      'CustomerReviews.Count'
    ]
  });

  const headers = {
    'host': host,
    'content-type': 'application/json; charset=utf-8',
    'content-encoding': 'amz-1.0',
    'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
    'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'
  };

  const authHeader = await signRequest('POST', `https://${host}/paapi5/searchitems`, headers, body);
  headers['Authorization'] = authHeader;

  const response = await fetch(`https://${host}/paapi5/searchitems`, {
    method: 'POST',
    headers,
    body
  });

  if (!response.ok) {
    throw new Error(`Amazon API error: ${response.status} ${await response.text()}`);
  }

  return await response.json();
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

    // Fetch Amazon products
    await log('info', 'Fetching Amazon products');
    const amazonData = await fetchAmazonProducts(niche, 5);
    
    if (!amazonData.SearchResult?.Items) {
      throw new Error('No products found from Amazon');
    }

    const products = amazonData.SearchResult.Items.map((item: any) => ({
      asin: item.ASIN,
      title: item.ItemInfo?.Title?.DisplayValue || 'Unknown',
      brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || '',
      rating: parseFloat(item.CustomerReviews?.StarRating?.Value || '0'),
      ratingCount: item.CustomerReviews?.Count || 0,
      price: parseFloat(item.Offers?.Listings?.[0]?.Price?.Amount || '0'),
      imageUrl: item.Images?.Primary?.Large?.URL || '',
      bulletPoints: item.ItemInfo?.Features?.DisplayValues || []
    })).filter((p: any) => p.rating >= settings.min_rating && p.price > 0);

    if (products.length === 0) {
      throw new Error('No products met the criteria');
    }

    await log('info', `Found ${products.length} qualifying products`);

    // Store products in DB
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
