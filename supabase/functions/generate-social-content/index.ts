import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { fetchWithTimeout, structuredErrorResponse } from '../_shared/fetch-with-timeout.ts';
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitResponse,
  initRateLimiter,
} from '../_shared/rate-limiter.ts';
import { validateUuid } from '../_shared/validation.ts';

// Initialize rate limiter cleanup
initRateLimiter();

// 20 generations per hour per IP
const SOCIAL_GEN_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  burstAllowance: 3,
  keyPrefix: 'social-gen',
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limit check
    const clientIp = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(clientIp, SOCIAL_GEN_RATE_LIMIT);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { articleId } = await req.json();

    // Validate articleId
    const articleIdResult = validateUuid(articleId);
    if (!articleIdResult.valid) {
      return new Response(JSON.stringify({ error: 'Invalid articleId: must be a valid UUID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch article details
    const { data: article, error: articleError } = await supabaseClient
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (articleError || !article) {
      throw new Error('Article not found');
    }

    // Generate social media content using Claude
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!claudeApiKey) {
      throw new Error('CLAUDE_API_KEY not configured');
    }

    const prompt = `Based on this article, create engaging social media posts:

Article Title: ${article.title}
Article Excerpt: ${article.excerpt}

Generate:
1. SHORT FORM (for Twitter/X - max 280 characters): Create a punchy, engaging tweet with relevant hashtags
2. LONG FORM (for Facebook - 300-500 characters): Create a detailed post that encourages engagement and sharing

Return ONLY valid JSON in this exact format:
{
  "shortForm": "your twitter post here",
  "longForm": "your facebook post here"
}`;

    const aiResponse = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system:
            'You are a social media expert. Generate engaging posts that drive traffic. Always return valid JSON only.',
          messages: [{ role: 'user', content: prompt }],
        }),
      },
      { timeoutMs: 30_000, maxRetries: 2, label: 'claude-social' }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Claude API error:', errorText);
      throw new Error('Failed to generate social content');
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.content?.[0]?.text ?? '';

    // Robust JSON extraction: handle code fences and extra text
    let generatedContent = (rawContent as string).trim();
    // Remove markdown code fences if present
    const fenceMatch = generatedContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      generatedContent = fenceMatch[1].trim();
    }
    // If still not plain JSON, extract between first { and last }
    if (!generatedContent.trim().startsWith('{')) {
      const start = generatedContent.indexOf('{');
      const end = generatedContent.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        generatedContent = generatedContent.slice(start, end + 1);
      }
    }

    console.log('Generated content (cleaned):', generatedContent);

    // Parse the JSON response
    let socialContent;
    try {
      socialContent = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', rawContent);
      throw new Error('Invalid AI response format');
    }

    // Determine social image URL (first image from article or featured image)
    let socialImageUrl = article.image_url;
    if (article.content) {
      const imgMatch = article.content.match(/<img[^>]+src="([^">]+)"/);
      if (imgMatch && imgMatch[1]) {
        socialImageUrl = imgMatch[1];
      }
    }

    // Update article with generated social content
    const { error: updateError } = await supabaseClient
      .from('articles')
      .update({
        social_short_form: socialContent.shortForm,
        social_long_form: socialContent.longForm,
        social_image_url: socialImageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);

    if (updateError) {
      console.error('Failed to update article:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        shortForm: socialContent.shortForm,
        longForm: socialContent.longForm,
        imageUrl: socialImageUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating social content:', error);
    return structuredErrorResponse(
      error.message || 'Internal server error',
      'SOCIAL_CONTENT_GENERATION_FAILED',
      500,
      corsHeaders
    );
  }
});
