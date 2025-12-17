import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Extract ASIN from Amazon URL
function extractASIN(url: string): string | null {
  // Match patterns like:
  // https://www.amazon.com/dp/B08N5WRWNW
  // https://www.amazon.com/product-name/dp/B08N5WRWNW
  // /gp/product/B08N5WRWNW
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/,
    /\/gp\/product\/([A-Z0-9]{10})/,
    /\/product\/([A-Z0-9]{10})/,
    /amazon\.com\/([A-Z0-9]{10})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// Fetch products using SerpAPI (Primary method)
async function fetchProductsViaSerpAPI(niche: string, itemCount: number = 5): Promise<any[]> {
  const serpApiKey = Deno.env.get('SERPAPI_KEY');

  if (!serpApiKey) {
    throw new Error('SERPAPI_KEY not configured');
  }

  // Build search query optimized for finding top-rated Amazon products
  const searchQuery = `best ${niche} amazon`;

  const url = new URL('https://serpapi.com/search');
  url.searchParams.append('api_key', serpApiKey);
  url.searchParams.append('engine', 'google_shopping');
  url.searchParams.append('q', searchQuery);
  url.searchParams.append('location', 'United States');
  url.searchParams.append('hl', 'en');
  url.searchParams.append('gl', 'us');
  url.searchParams.append('num', String(itemCount * 2)); // Get more to filter later

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`SerpAPI error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  if (!data.shopping_results || data.shopping_results.length === 0) {
    throw new Error('No shopping results found from SerpAPI');
  }

  // Filter for Amazon products and extract data
  const products = data.shopping_results
    .filter((item: any) => {
      const source = item.source?.toLowerCase() || '';
      const link = item.link?.toLowerCase() || '';
      return source.includes('amazon') || link.includes('amazon.com');
    })
    .map((item: any) => {
      const asin = extractASIN(item.link || '');
      if (!asin) return null;

      // Extract price
      let price = 0;
      if (item.extracted_price) {
        price = parseFloat(item.extracted_price);
      } else if (item.price) {
        price = parseFloat(item.price.replace(/[^0-9.]/g, ''));
      }

      // Extract rating
      let rating = 0;
      let ratingCount = 0;
      if (item.rating) {
        rating = parseFloat(item.rating);
      }
      if (item.reviews) {
        ratingCount = parseInt(item.reviews.toString().replace(/[^0-9]/g, '')) || 0;
      }

      return {
        asin,
        title: item.title || 'Unknown Product',
        brand: item.source || '',
        rating,
        ratingCount,
        price,
        imageUrl: item.thumbnail || '',
        bulletPoints: item.extensions || []
      };
    })
    .filter((p: any) => p !== null && p.asin)
    .slice(0, itemCount);

  return products;
}

// Fallback: Fetch products using Google Custom Search API
async function fetchProductsViaGoogleSearch(niche: string, itemCount: number = 5): Promise<any[]> {
  const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
  const searchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');

  if (!googleApiKey || !searchEngineId) {
    throw new Error('Google Search API not configured (GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_ENGINE_ID missing)');
  }

  // Search specifically on Amazon.com for products
  const searchQuery = `best ${niche} site:amazon.com`;

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.append('key', googleApiKey);
  url.searchParams.append('cx', searchEngineId);
  url.searchParams.append('q', searchQuery);
  url.searchParams.append('num', String(Math.min(itemCount * 2, 10)));

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Google Search API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error('No search results found from Google');
  }

  // Extract ASINs and build product data
  const products = data.items
    .map((item: any) => {
      const asin = extractASIN(item.link || '');
      if (!asin) return null;

      // Extract title (remove "Amazon.com: " prefix if present)
      let title = item.title || 'Unknown Product';
      title = title.replace(/^Amazon\.com:\s*/i, '');

      return {
        asin,
        title,
        brand: '',
        rating: 0, // Will be enriched later if possible
        ratingCount: 0,
        price: 0,
        imageUrl: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.cse_thumbnail?.[0]?.src || '',
        bulletPoints: []
      };
    })
    .filter((p: any) => p !== null && p.asin)
    .slice(0, itemCount);

  return products;
}

// Main product fetching function with fallback logic
async function fetchAmazonProducts(
  niche: string,
  itemCount: number = 5,
  supabaseClient: any,
  log: (level: string, message: string, ctx?: any) => Promise<void>
): Promise<any[]> {
  let products: any[] = [];

  // Try SerpAPI first
  try {
    await log('info', 'Attempting to fetch products via SerpAPI');
    products = await fetchProductsViaSerpAPI(niche, itemCount);

    if (products.length > 0) {
      await log('info', `SerpAPI found ${products.length} products`);
      return products;
    }
  } catch (error) {
    await log('warn', 'SerpAPI failed, falling back to Google Search', {
      error: (error as Error)?.message ?? String(error)
    });
  }

  // Fallback to Google Custom Search
  try {
    await log('info', 'Attempting to fetch products via Google Custom Search');
    products = await fetchProductsViaGoogleSearch(niche, itemCount);

    if (products.length > 0) {
      await log('info', `Google Search found ${products.length} products`);
      return products;
    }
  } catch (error) {
    await log('error', 'Google Search also failed', {
      error: (error as Error)?.message ?? String(error)
    });
    throw new Error(`Both SerpAPI and Google Search failed: ${(error as Error)?.message}`);
  }

  return products;
}

// Enrich product data with Amazon page scraping (optional enhancement)
async function enrichProductData(products: any[], log: (level: string, message: string, ctx?: any) => Promise<void>): Promise<any[]> {
  const enrichedProducts = [];

  for (const product of products) {
    try {
      // Simple enrichment via Amazon product page
      const amazonUrl = `https://www.amazon.com/dp/${product.asin}`;

      // Note: This is a basic implementation. For production, consider using a scraping service
      // or the Amazon PA-API for detailed product info

      // For now, we'll just ensure the product has minimal data
      if (!product.price || product.price === 0) {
        await log('warn', `Product ${product.asin} missing price data`, { title: product.title });
      }

      enrichedProducts.push(product);
    } catch (error) {
      await log('warn', `Failed to enrich product ${product.asin}`, {
        error: (error as Error)?.message
      });
      enrichedProducts.push(product);
    }
  }

  return enrichedProducts;
}

// SEO data generation removed - focusing on core article generation

// Enhanced AI prompt for better SEO and conversion optimization
async function generateArticleContent(products: any[], niche: string, wordCount: number) {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const prompt = `You are an expert Amazon affiliate product reviewer. Create a compelling, SEO-optimized article about "${niche}" that will rank well in Google and drive affiliate sales.

TARGET WORD COUNT: ${wordCount} words

PRODUCTS TO REVIEW:
${products.map((p, i) => `${i + 1}. ${p.title}
   - ASIN: ${p.asin}
   - Image URL: ${p.imageUrl || 'No image available'}
   ${p.price > 0 ? `- Price: $${p.price}` : ''}
   ${p.rating > 0 ? `- Rating: ${p.rating}/5 stars (${p.ratingCount || 0} reviews)` : ''}`).join('\n\n')}

ARTICLE STRUCTURE:

1. **Attention-Grabbing Introduction** (150-200 words)
   - Hook with a relatable problem or question
   - Present the solution (these products)
   - Promise value (what they'll learn)
   - Include target keyword "${niche}" in first 100 words

2. **Quick Comparison Table** (optional section)
   - Brief at-a-glance comparison
   - Top features, price points, ratings

3. **Comprehensive Buyer's Guide** (300-400 words)
   - What makes a great ${niche}
   - Key features to look for
   - Common mistakes to avoid
   - How to choose the right one for your needs

4. **In-Depth Product Reviews** (Main body)
   For EACH product, include:
   - Start with an <img> tag using the product's image URL: <img src="IMAGE_URL_HERE" alt="[Product Name] - [Main Feature]" />
   - Engaging overview paragraph (why it stands out)
   - **What We Love** section with <ul> list of 4-5 specific pros with details
   - **Room for Improvement** section with <ul> list of 2-3 honest cons
   - **Key Specifications** table or list with most important specs
   - **Best For** paragraph describing specific use case/user type
   - End with call-to-action: <a href="AMAZON_LINK_PLACEHOLDER" class="amazon-button">Check Price on Amazon</a>

5. **Comparison & Winner Analysis** (200-300 words)
   - Direct comparisons between products
   - Best overall, best value, best premium pick
   - Which product for which user

6. **Frequently Asked Questions** (4-6 questions)
   - Answer real questions buyers have
   - Include long-tail keywords naturally
   - Provide genuine value

7. **Final Thoughts & Recommendation** (150-200 words)
   - Summarize key points
   - Clear recommendation
   - Strong call-to-action with button: <a href="AMAZON_LINK_PLACEHOLDER" class="amazon-button">View Best Deals on Amazon</a>
   - Next steps for the reader

SEO REQUIREMENTS:
- Use target keyword "${niche}" naturally 5-7 times throughout
- Include keyword in: title, first paragraph, at least one H2, and conclusion
- Use semantic keywords and variations
- Write for humans first, search engines second
- Use proper heading hierarchy (H1 → H2 → H3)

TONE & STYLE:
- Conversational and authentic (like talking to a friend)
- Avoid robotic AI language
- Use contractions, questions, and varied sentence lengths
- Build trust through honesty (mention cons, not just pros)
- Show expertise but remain approachable
- Create urgency without being pushy

CONVERSION OPTIMIZATION:
- Frame features as benefits
- Use power words (proven, essential, premium, simple, reliable)
- Include social proof mentions (ratings, reviews)
- Address objections proactively
- Multiple natural CTAs throughout (not just at end)

Return ONLY valid JSON (no markdown code blocks) in this exact format:
{
  "title": "SEO-optimized title under 60 chars with power words",
  "excerpt": "Compelling 150-160 char meta description with CTA",
  "content": "Full HTML article with proper <h2> and <h3> tags, <p> paragraphs, <ul> lists, etc.",
  "seo_title": "Meta title (55-60 chars) with keyword",
  "seo_description": "Meta description (150-160 chars) with keyword and CTA",
  "target_keyword": "${niche}",
  "seo_keywords": ["primary keyword", "long-tail variation 1", "related keyword 1", "buyer intent keyword", "question keyword"],
  "products": [
    {
      "asin": "product ASIN from list above",
      "summary": "Compelling 2-3 sentence overview highlighting unique value proposition",
      "pros": ["Specific pro with context", "Another detailed pro", "Feature turned into benefit", "Quantifiable advantage"],
      "cons": ["Honest limitation", "Minor drawback", "What it's not ideal for"],
      "specs": {"Most Important Spec": "value", "Key Feature": "value", "Critical Detail": "value"},
      "best_for": "Specific user type or use case (e.g., 'Remote workers who need ergonomic support')"
    }
  ]
}

IMPORTANT: Return ONLY the JSON object. No explanations, no markdown formatting, just pure JSON.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Amazon affiliate marketer and SEO content writer. You write compelling, conversion-focused product reviews that rank well and drive sales. CRITICAL: Always return ONLY valid, properly escaped JSON. Never use markdown code blocks. Ensure all quotes in HTML content are properly escaped.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 20000, // Increased significantly to prevent truncation of detailed articles
      response_format: { type: "json_object" } // Force JSON mode
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

  // Try to parse JSON with better error handling
  try {
    return JSON.parse(jsonContent);
  } catch (parseError) {
    // Log first 500 chars of the problematic content for debugging
    console.error('[ERROR] JSON parse failed. Content preview:', jsonContent.substring(0, 500));
    console.error('[ERROR] Parse error:', parseError);
    
    // Try to fix common JSON issues
    // 1. Remove any leading/trailing whitespace or BOM
    jsonContent = jsonContent.trim().replace(/^\uFEFF/, '');
    
    // 2. Try to find the JSON object boundaries
    const jsonStart = jsonContent.indexOf('{');
    const jsonEnd = jsonContent.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
      
      try {
        return JSON.parse(jsonContent);
      } catch (secondError) {
        console.error('[ERROR] Second parse attempt failed:', secondError);
      }
    }
    
    throw new Error(`Failed to parse AI response as JSON: ${parseError.message}. Content length: ${content.length}`);
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read optional body overrides
    let bodyOverrides: any = {};
    try {
      if (req.method === 'POST') {
        bodyOverrides = await req.json();
      }
    } catch (_) { /* ignore bad json */ }

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

    await log('info', 'Pipeline started with new SerpAPI/Google Search integration');

    // Fetch settings
    const { data: settingsRow } = await supabase
      .from('amazon_pipeline_settings')
      .select('*')
      .maybeSingle();

    const settings = settingsRow || {
      niches: ["home office", "travel gear", "fitness"],
      daily_post_count: 1,
      min_rating: 4.0,
      price_min: null,
      price_max: null,
      review_required: false,
      word_count_target: 1500,
      amazon_tag: 'your-tag-20',
      cache_only_mode: false,
      id: null
    };

    const effectiveCacheOnly = Boolean(settings.cache_only_mode) || Boolean(bodyOverrides?.cacheOnly);

    if (!settings) {
      throw new Error('Pipeline settings not configured');
    }

    await log('info', 'Settings loaded', {
      niches: settings.niches,
      cache_only_mode: settings.cache_only_mode,
      amazon_tag: settings.amazon_tag
    });

    // Seed search terms from CSV if table is empty
    const { count } = await supabase
      .from('amazon_search_terms')
      .select('*', { count: 'exact', head: true });

    if (count === 0) {
      await log('info', 'Seeding search terms from CSV in storage bucket');
      
      // Read CSV from Supabase storage (admin-uploads bucket)
      // Note: You need to upload amazon_ideas.csv to the admin-uploads bucket first
      const { data: csvData, error: csvError } = await supabase
        .storage
        .from('admin-uploads')
        .download('amazon_ideas.csv');

      if (csvError) {
        await log('warn', 'CSV file not found in storage, using fallback niches', {
          error: csvError.message,
          note: 'Upload amazon_ideas.csv to admin-uploads bucket to use CSV search terms'
        });
        // Fall back to using settings niches if CSV not found
        const niches = settings.niches as string[];
        niche = niches[Math.floor(Math.random() * niches.length)];
      } else {
        const csvText = await csvData.text();
        const lines = csvText.split('\n').slice(1); // Skip header
        const terms = lines
          .filter(line => line.trim())
          .map(line => {
            const [search_term, category] = line.split(',');
            return { search_term: search_term?.trim(), category: category?.trim() };
          })
          .filter(t => t.search_term && t.category);

        if (terms.length > 0) {
          // Insert in batches to avoid payload size issues
          const batchSize = 100;
          for (let i = 0; i < terms.length; i += batchSize) {
            const batch = terms.slice(i, i + batchSize);
            await supabase.from('amazon_search_terms').insert(batch);
          }
          await log('info', `Seeded ${terms.length} search terms from CSV`);
        }
      }
    }

    // Pick random unused search term with retry logic
    let niche = '';
    let searchTermId = '';
    let retryCount = 0;
    const maxRetries = 5;
    let products: any[] = [];

    while (retryCount < maxRetries) {
      // Get random unused term
      const { data: unusedTerms } = await supabase
        .from('amazon_search_terms')
        .select('id, search_term, category')
        .is('used_at', null)
        .limit(50);

      if (!unusedTerms || unusedTerms.length === 0) {
        // Fallback to settings niches if no unused terms
        await log('warn', 'No unused search terms available, using settings niches');
        const niches = settings.niches as string[];
        niche = niches[Math.floor(Math.random() * niches.length)];
        searchTermId = ''; // No ID to mark as used
        break;
      }

      const selectedTerm = unusedTerms[Math.floor(Math.random() * unusedTerms.length)];
      niche = selectedTerm.search_term;
      searchTermId = selectedTerm.id;

      await log('info', `Selected search term (attempt ${retryCount + 1}): ${niche}`, {
        category: selectedTerm.category
      });

    // Try cached products first (24h window)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cached, error: cacheError } = await supabase
      .from('amazon_products')
      .select('asin, title, brand, rating, rating_count, price, image_url, bullet_points')
      .eq('niche', niche)
      .gte('last_seen_at', twentyFourHoursAgo)
      .order('rating', { ascending: false })
      .limit(5);

    // Reset products for this attempt
    products = [];

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
        p.asin && // Must have ASIN
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
      // Only fetch new products if cache-only is false
      if (!effectiveCacheOnly) {
        try {
          await log('info', 'Fetching fresh products via SerpAPI/Google Search');

          // Fetch products using new method
          let freshProducts = await fetchAmazonProducts(niche, 5, supabase, log);

          // Enrich product data if possible
          freshProducts = await enrichProductData(freshProducts, log);

          // Filter based on settings
          freshProducts = freshProducts.filter((p: any) => (
            p.asin && // Must have ASIN
            (settings.price_min ? p.price >= settings.price_min : true) &&
            (settings.price_max ? p.price <= settings.price_max : true)
          ));

          if (freshProducts.length === 0) {
            throw new Error('No products passed filtering criteria');
          }

          products = freshProducts;

          // Store newly fetched products in DB for caching
          if (products.length > 0) {
            await log('info', `Caching ${products.length} products for future use`);

            for (const product of products) {
              await supabase.from('amazon_products').upsert({
                asin: product.asin,
                title: product.title,
                brand: product.brand || '',
                rating: product.rating || 0,
                rating_count: product.ratingCount || 0,
                price: product.price || 0,
                image_url: product.imageUrl || '',
                niche: niche,
                bullet_points: product.bulletPoints || [],
                last_seen_at: new Date().toISOString()
              }, { onConflict: 'asin' });
            }
          }
        } catch (err) {
          await log('error', 'Product fetching failed; trying fallback cache', {
            error: (err as Error)?.message ?? String(err)
          });

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
              p.asin &&
              (settings.price_min ? p.price >= settings.price_min : true) &&
              (settings.price_max ? p.price <= settings.price_max : true)
            ));

            await log('info', `Using fallback cache: ${products.length} products`);
          }
        }
      } else {
        await log('info', 'Cache-only mode enabled; skipping product search APIs');
      }
    }

      // Check if we got enough products
      if (products.length >= 3) {
        await log('info', `Found ${products.length} products for "${niche}"`);
        break; // Success, exit retry loop
      } else {
        await log('warn', `Insufficient products for "${niche}" (${products.length}), retrying with different term`);
        retryCount++;
        products = []; // Reset for next attempt
      }
    }

    if (products.length === 0) {
      const message = effectiveCacheOnly
        ? 'No cached products for available search terms. Disable cache-only mode or seed products first.'
        : `Product search failed after ${maxRetries} attempts; no products available`;

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

    await log('info', `Using ${products.length} products for article generation`);

    // Generate article
    await log('info', 'Generating SEO-optimized article content with AI');
    let articleData;
    try {
      articleData = await generateArticleContent(
        products,
        niche,
        settings.word_count_target
      );
      await log('info', 'AI article generation completed successfully');
    } catch (aiError) {
      await log('error', 'AI generation failed', {
        error: (aiError as Error)?.message,
        stack: (aiError as Error)?.stack
      });
      throw new Error(`AI generation failed: ${(aiError as Error)?.message}`);
    }

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
        published: !settings.review_required, // Auto-publish unless review required
        author: 'BuildDesk Team',
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

    await log('info', `Article created: ${article.title}`, {
      slug: article.slug,
      published: article.published
    });

    // Mark search term as used (if we have a searchTermId)
    if (searchTermId) {
      await supabase
        .from('amazon_search_terms')
        .update({
          used_at: new Date().toISOString(),
          article_id: article.id,
          product_count: products.length
        })
        .eq('id', searchTermId);

      await log('info', `Marked search term "${niche}" as used`);
    }

    // Link products to article with affiliate URLs and replace placeholders in content
    let finalContent = articleData.content;
    
    for (const productData of articleData.products) {
      // Generate proper Amazon Associates affiliate URL with all required parameters
      const linkId = Math.random().toString(36).substring(2, 15);
      const affiliateUrl = `https://www.amazon.com/dp/${productData.asin}?&linkCode=ll1&tag=${settings.amazon_tag}&linkId=${linkId}&language=en_US&ref_=as_li_ss_tl`;

      // Replace placeholder in content with actual affiliate link
      finalContent = finalContent.replace(/AMAZON_LINK_PLACEHOLDER/g, affiliateUrl);

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

      await log('info', `Linked product ${productData.asin} with affiliate URL`, {
        asin: productData.asin,
        tag: settings.amazon_tag
      });
    }

    // Update article content with actual affiliate links
    await supabase
      .from('articles')
      .update({ content: finalContent })
      .eq('id', article.id);

    // If article is published, trigger webhook to distribute to social
    if (article.published) {
      try {
        await supabase.functions.invoke('send-article-webhook', {
          body: { articleId: article.id, isTest: false }
        });
        await log('info', 'Webhook invoked for article', { articleId: article.id });
      } catch (e) {
        await log('error', 'Failed to invoke webhook', { error: (e as Error)?.message || String(e) });
      }
    }

    // Update run status
    await supabase
      .from('amazon_pipeline_runs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        posts_created: 1,
        posts_published: article.published ? 1 : 0,
        note: `Successfully created article: ${article.title}`
      })
      .eq('id', runId);

    // Update settings last run
    if (settings.id) {
      await supabase
        .from('amazon_pipeline_settings')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', settings.id);
    }

    await log('info', 'Pipeline completed successfully with SerpAPI/Google Search integration');

    return new Response(
      JSON.stringify({
        success: true,
        article: {
          id: article.id,
          title: article.title,
          slug: article.slug,
          url: `https://yourdomain.com/news/${article.slug}`,
          published: article.published
        },
        products: products.length,
        affiliateTag: settings.amazon_tag,
        method: 'SerpAPI/Google Search',
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
