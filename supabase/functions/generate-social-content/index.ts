import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { articleId } = await req.json();

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

    // Generate social media content using Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('Lovable API key not configured');
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

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are a social media expert. Generate engaging posts that drive traffic. Always return valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error('Failed to generate social content');
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content ?? '';

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
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});