import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { fetchWithTimeout, structuredErrorResponse } from "../_shared/fetch-with-timeout.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, initRateLimiter } from "../_shared/rate-limiter.ts";
// Pure parse/derive helpers (extracted for unit testing). US-012.
import { assertApiKeyConfigured, parseAiArticleJson, slugify, calculateReadTime } from "./parse.ts";

// Initialize rate limiter cleanup
initRateLimiter();

// 5 article generations per hour per IP (expensive operation)
const ARTICLE_GEN_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  burstAllowance: 1,
  keyPrefix: 'article-gen',
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limit check
    const clientIp = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(clientIp, ARTICLE_GEN_RATE_LIMIT);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY');
    assertApiKeyConfigured(CLAUDE_API_KEY);

    console.log('Fetching articles from AI news website...');
    
    // Fetch the main page to get article links
    const newsResponse = await fetchWithTimeout(
      'https://www.artificialintelligence-news.com/',
      {},
      { timeoutMs: 30_000, maxRetries: 2, label: 'news-index' }
    );
    const newsHtml = await newsResponse.text();
    
    // Extract article URLs (looking for article links in the HTML)
    const articleUrlPattern = /href="(https:\/\/www\.artificialintelligence-news\.com\/[^"]+)"/g;
    const matches = [...newsHtml.matchAll(articleUrlPattern)];
    const articleUrls = [...new Set(matches.map(m => m[1]))].filter(url => 
      !url.includes('/tag/') && 
      !url.includes('/category/') && 
      !url.includes('/author/') &&
      !url.includes('/page/') &&
      url !== 'https://www.artificialintelligence-news.com/'
    );

    if (articleUrls.length === 0) {
      throw new Error('No articles found on the news website');
    }

    // Pick a random article
    const randomUrl = articleUrls[Math.floor(Math.random() * articleUrls.length)];
    console.log('Selected article:', randomUrl);

    // Fetch the selected article
    const articleResponse = await fetchWithTimeout(
      randomUrl,
      {},
      { timeoutMs: 30_000, maxRetries: 2, label: 'news-article' }
    );
    const articleHtml = await articleResponse.text();

    // Extract title and content (basic extraction)
    const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const title = titleMatch ? titleMatch[1].trim() : 'AI News Article';
    
    // Extract article content (simplified - gets text from article body)
    const contentMatch = articleHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    const rawContent = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const excerpt = rawContent.substring(0, 500);

    console.log('Original article title:', title);
    console.log('Generating new article with AI...');

    // Generate a completely new article with AI using Claude
    const aiResponse = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: `You are an expert AI and technology content writer. Your task is to write original, SEO-optimized articles that are informative, engaging, and human-like.

            Rules:
            - Write in a conversational, professional tone
            - Create completely original content - do NOT copy from the source
            - Use the source only for topic inspiration and key facts
            - Include relevant examples and real-world applications
            - Structure with clear headings (use ## and ### for markdown)
            - Aim for 800-1200 words
            - Write for both technical and non-technical readers
            - Include actionable insights`,
        messages: [
          {
            role: 'user',
            content: `Based on this article about "${title}", write a completely new, SEO-optimized article with a fresh perspective.

Source article context (use only as inspiration):
${excerpt}

Please provide your response in this exact JSON format:
{
  "title": "A compelling, SEO-friendly title (60-70 characters, include main keyword)",
  "excerpt": "An engaging 150-160 character meta description that includes the target keyword",
  "content": "Full article in markdown format with ## headings, bullet points, and proper structure",
  "category": "One of: Artificial Intelligence, Machine Learning, Technology, Innovation, Business AI",
  "target_keyword": "The main SEO keyword phrase",
  "seo_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}

Make sure the content is:
- 100% original and rewritten
- Well-researched with specific details
- Human-sounding and engaging
- SEO-optimized but natural
- Properly structured with markdown headings`
          }
        ],
        temperature: 0.7,
      }),
    }, { timeoutMs: 60_000, maxRetries: 2, label: 'claude-article-gen' });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Claude API error:', aiResponse.status, errorText);
      throw new Error(`Claude API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.content[0].text;
    
    console.log('AI response received, parsing...');

    // Extract JSON from AI response (handle markdown code blocks)
    const articleData = parseAiArticleJson(aiContent);

    // Generate a URL-friendly slug
    const slug = slugify(articleData.title);

    // Calculate read time (assuming 200 words per minute)
    const readTime = calculateReadTime(articleData.content);

    console.log('Saving article to database...');

    // Save the article to the database
    const safeCategory = articleData.category || 'Artificial Intelligence';
    const safeSeoKeywords = Array.isArray(articleData.seo_keywords) ? articleData.seo_keywords : [];
    const safeTags = Array.isArray(articleData.tags) ? articleData.tags : [];

    const { data: newArticle, error: insertError } = await supabaseClient
      .from('articles')
      .insert({
        title: articleData.title,
        slug: slug,
        excerpt: articleData.excerpt,
        content: articleData.content,
        category: safeCategory,
        target_keyword: articleData.target_keyword,
        seo_keywords: safeSeoKeywords,
        tags: safeTags,
        author: 'AI Content Generator',
        read_time: readTime,
        published: true, // Auto-publish
        seo_title: articleData.title,
        seo_description: articleData.excerpt,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      throw insertError;
    }

    console.log('Article created successfully:', newArticle.id);

    // If published, trigger the webhook asynchronously (do not fail main flow)
    if (newArticle.published) {
      try {
        await supabaseClient.functions.invoke('send-article-webhook', {
          body: { articleId: newArticle.id, isTest: false }
        });
        console.log('Webhook invoked for article', newArticle.id);
      } catch (e) {
        console.error('Failed to invoke webhook for article', newArticle.id, e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        article: newArticle,
        sourceUrl: randomUrl,
        message: 'Article generated and published successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-ai-article function:', error);
    return structuredErrorResponse(
      error.message || 'Internal server error',
      'ARTICLE_GENERATION_FAILED',
      500,
      corsHeaders
    );
  }
});
