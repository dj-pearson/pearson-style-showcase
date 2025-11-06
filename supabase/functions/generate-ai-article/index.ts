import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Fetching articles from AI news website...');
    
    // Fetch the main page to get article links
    const newsResponse = await fetch('https://www.artificialintelligence-news.com/');
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
    const articleResponse = await fetch(randomUrl);
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

    // Generate a completely new article with AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert AI and technology content writer. Your task is to write original, SEO-optimized articles that are informative, engaging, and human-like. 
            
            Rules:
            - Write in a conversational, professional tone
            - Create completely original content - do NOT copy from the source
            - Use the source only for topic inspiration and key facts
            - Include relevant examples and real-world applications
            - Structure with clear headings (use ## and ### for markdown)
            - Aim for 800-1200 words
            - Write for both technical and non-technical readers
            - Include actionable insights`
          },
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
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    
    console.log('AI response received, parsing...');

    // Extract JSON from AI response (handle markdown code blocks)
    let articleData;
    try {
      const jsonMatch = aiContent.match(/```json\n([\s\S]*?)\n```/) || aiContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiContent;
      articleData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      throw new Error('Failed to parse AI-generated content');
    }

    // Generate a URL-friendly slug
    const slug = articleData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);

    // Calculate read time (assuming 200 words per minute)
    const wordCount = articleData.content.split(/\s+/).length;
    const readTime = `${Math.ceil(wordCount / 200)} min read`;

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
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
