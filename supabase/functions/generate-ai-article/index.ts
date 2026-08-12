import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { fetchWithTimeout, structuredErrorResponse } from '../_shared/fetch-with-timeout.ts';
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitResponse,
  initRateLimiter,
} from '../_shared/rate-limiter.ts';
import { getAIConfigs, callAIWithConfig, parseJSONResponse } from '../_shared/ai-helper.ts';
import { invokeFunctionAndForget } from '../_shared/invoke-function.ts';
// Pure parse/derive helpers (extracted for unit testing). US-012.
import { slugify, calculateReadTime } from './parse.ts';

// Initialize rate limiter cleanup
initRateLimiter();

// 5 article generations per hour per IP (expensive operation)
const ARTICLE_GEN_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  burstAllowance: 1,
  keyPrefix: 'article-gen',
};

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
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

    // Normal tier: quality matters more than latency for a full article.
    const aiConfigs = await getAIConfigs(supabaseClient, 'normal', 'article_generation');
    console.log(`Found ${aiConfigs.length} normal tier AI configs for article generation`);

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
    const articleUrls = [...new Set(matches.map((m) => m[1]))].filter(
      (url) =>
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
    const rawContent = contentMatch
      ? contentMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : '';
    const excerpt = rawContent.substring(0, 500);

    console.log('Original article title:', title);
    console.log('Generating new article with AI...');

    const systemPrompt = `You are an expert AI and technology content writer. Your task is to write original, SEO-optimized articles that are informative, engaging, and human-like.

Rules:
- Write in a conversational, professional tone
- Create completely original content - do NOT copy from the source
- Use the source only for topic inspiration and key facts
- Include relevant examples and real-world applications
- Structure with clear headings (use ## and ### for markdown)
- Aim for 800-1200 words
- Write for both technical and non-technical readers
- Include actionable insights`;

    const userPrompt = `Based on this article about "${title}", write a completely new, SEO-optimized article with a fresh perspective.

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
- Properly structured with markdown headings`;

    // Provider/model selection lives in ai_model_configs, with fallback across
    // configs handled by callAIWithConfig.
    const { response: aiContent, usedConfig } = await callAIWithConfig(
      aiConfigs,
      systemPrompt,
      userPrompt,
      { temperature: 0.7, maxTokens: 4000, jsonMode: true }
    );

    console.log(
      `AI response received from ${usedConfig.provider} - ${usedConfig.model_name}, parsing...`
    );

    let articleData;
    try {
      articleData = parseJSONResponse(aiContent);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      throw new Error('Failed to parse AI-generated content');
    }

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

    // If published, trigger the webhook (failures are logged, not fatal)
    if (newArticle.published) {
      await invokeFunctionAndForget('send-article-webhook', {
        articleId: newArticle.id,
        isTest: false,
      });
      console.log('Webhook invoked for article', newArticle.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        article: newArticle,
        sourceUrl: randomUrl,
        message: 'Article generated and published successfully',
        model_used: `${usedConfig.provider} - ${usedConfig.model_name}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-ai-article function:', error);
    return structuredErrorResponse(
      (error instanceof Error ? error.message : '') || 'Internal server error',
      'ARTICLE_GENERATION_FAILED',
      500,
      corsHeaders
    );
  }
};
