import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { 
  createSupabaseClient, 
  getAIConfigs, 
  callAIWithConfig,
  parseJSONResponse 
} from "../_shared/ai-helper.ts";

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { articleId } = await req.json();

    const supabaseClient = createSupabaseClient();

    // Get lightweight AI configs for social content (quick, simple generation)
    const aiConfigs = await getAIConfigs(supabaseClient, 'lightweight', 'social_content');
    console.log(`[Social] Found ${aiConfigs.length} lightweight AI configs`);

    // Fetch article details
    const { data: article, error: articleError } = await supabaseClient
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (articleError || !article) {
      throw new Error('Article not found');
    }

    const systemPrompt = 'You are a social media expert. Generate engaging posts that drive traffic. Always return valid JSON only.';

    const userPrompt = `Based on this article, create engaging social media posts:

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

    // Generate social content using lightweight AI
    const { response: rawContent, usedConfig } = await callAIWithConfig(
      aiConfigs,
      systemPrompt,
      userPrompt,
      { temperature: 0.7, maxTokens: 1000, jsonMode: true }
    );

    console.log(`[Social] Generated content using ${usedConfig.provider} - ${usedConfig.model_name}`);

    // Parse the JSON response
    let socialContent;
    try {
      socialContent = parseJSONResponse(rawContent);
    } catch (parseError) {
      console.error('[Social] Failed to parse AI response:', rawContent);
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
      console.error('[Social] Failed to update article:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        shortForm: socialContent.shortForm,
        longForm: socialContent.longForm,
        imageUrl: socialImageUrl,
        model_used: `${usedConfig.provider} - ${usedConfig.model_name}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Social] Error generating social content:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};
