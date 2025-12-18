import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

// Helper function to call AI using centralized config
async function callAIWithConfig(
  configs: any[],
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}
): Promise<{ response: string; usedConfig: any }> {
  const { temperature = 0.7, maxTokens = 4000, jsonMode = false } = options;

  for (const config of configs) {
    console.log(`Trying AI model: ${config.provider} - ${config.model_name}`);

    try {
      const apiKey = Deno.env.get(config.api_key_secret_name);
      if (!apiKey) {
        console.error(`API key ${config.api_key_secret_name} not found`);
        continue;
      }

      if (config.provider === "gemini-paid" || config.provider === "gemini-free") {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.model_name}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
              }],
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
                ...(config.configuration || {})
              }
            })
          }
        );

        if (response.ok) {
          const result = await response.json();
          const generatedResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedResponse) {
            return { response: generatedResponse, usedConfig: config };
          }
        } else {
          const errorText = await response.text();
          console.error(`Gemini API error: ${response.status}`, errorText);
        }

      } else if (config.provider === "claude") {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: config.model_name,
            max_tokens: maxTokens,
            messages: [
              { role: "user", content: `${systemPrompt}\n\n${userPrompt}` }
            ]
          })
        });

        if (response.ok) {
          const result = await response.json();
          const generatedResponse = result.content?.[0]?.text;
          if (generatedResponse) {
            return { response: generatedResponse, usedConfig: config };
          }
        } else {
          const errorText = await response.text();
          console.error(`Claude API error: ${response.status}`, errorText);
        }

      } else if (config.provider === "lovable") {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: config.model_name,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature,
            max_tokens: maxTokens,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {})
          })
        });

        if (response.ok) {
          const result = await response.json();
          const generatedResponse = result.choices?.[0]?.message?.content;
          if (generatedResponse) {
            return { response: generatedResponse, usedConfig: config };
          }
        } else {
          const errorText = await response.text();
          console.error(`Lovable API error: ${response.status}`, errorText);
        }

      } else if (config.provider === "openai") {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: config.model_name,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature,
            max_tokens: maxTokens,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {})
          })
        });

        if (response.ok) {
          const result = await response.json();
          const generatedResponse = result.choices?.[0]?.message?.content;
          if (generatedResponse) {
            return { response: generatedResponse, usedConfig: config };
          }
        } else {
          const errorText = await response.text();
          console.error(`OpenAI API error: ${response.status}`, errorText);
        }
      }

    } catch (error) {
      console.error(`Failed with ${config.provider}:`, error);
      continue;
    }
  }

  throw new Error("All AI models failed to generate a response");
}

// Get AI configs filtered by use case
async function getAIConfigs(supabaseClient: any, useCase: string = "article_generation"): Promise<any[]> {
  const { data: configs, error: configError } = await supabaseClient
    .from("ai_model_configs")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (configError || !configs) {
    throw new Error("Failed to load AI model configurations");
  }

  // Prefer use-case-specific configs, then 'all', then general configs
  const useCaseConfigs = configs.filter((c: any) =>
    c.use_case && c.use_case.includes(useCase)
  );
  const allUseConfigs = configs.filter((c: any) =>
    c.use_case && c.use_case.includes("all")
  );
  const generalConfigs = configs.filter((c: any) =>
    !c.use_case || c.use_case.includes("general")
  );

  const orderedConfigs =
    useCaseConfigs.length > 0
      ? useCaseConfigs
      : allUseConfigs.length > 0
        ? allUseConfigs
        : generalConfigs;

  if (orderedConfigs.length === 0) {
    throw new Error(`No active AI configuration found for ${useCase}`);
  }

  return orderedConfigs;
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get AI configuration
    const aiConfigs = await getAIConfigs(supabaseClient, "article_generation");
    console.log(`Found ${aiConfigs.length} AI configs for article generation`);

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
    console.log('Generating new article with AI using centralized config...');

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

    // Call AI using centralized configuration
    const { response: aiContent, usedConfig } = await callAIWithConfig(
      aiConfigs,
      systemPrompt,
      userPrompt,
      { temperature: 0.7, maxTokens: 4000, jsonMode: true }
    );

    console.log(`AI response received from ${usedConfig.provider} - ${usedConfig.model_name}, parsing...`);

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

    // Call local webhook function for article distribution
    const functionsUrl = Deno.env.get('FUNCTIONS_URL') || 'https://functions.danpearson.net';
    if (newArticle.published) {
      try {
        const webhookResponse = await fetch(`${functionsUrl}/send-article-webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ articleId: newArticle.id, isTest: false })
        });
        console.log('Webhook invoked for article', newArticle.id, 'status:', webhookResponse.status);
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
        aiModel: `${usedConfig.provider} - ${usedConfig.model_name}`
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
};
