import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, prompt, context } = await req.json();
    
    console.log(`AI Content Generation Request - Type: ${type}, Prompt: ${prompt}`);

    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let systemPrompt = '';
    let userPrompt = prompt;

    // Set system prompts based on content type
    switch (type) {
      case 'article':
        systemPrompt = `You are a professional content writer. Generate high-quality article content that is engaging, informative, and well-structured. Include:
        - A compelling title
        - SEO-optimized content with proper headings
        - A concise excerpt/summary
        - Relevant tags and keywords
        - Meta description for SEO
        Return the response as a JSON object with: title, content (in markdown format), excerpt, tags (array), seoTitle, seoDescription, targetKeyword.`;
        break;
      
      case 'project':
        systemPrompt = `You are a portfolio content specialist. Generate professional project descriptions that showcase technical skills and achievements. Include:
        - A clear project title
        - Comprehensive description highlighting features and tech stack
        - Relevant tags/technologies used
        - Status information
        Return the response as a JSON object with: title, description, tags (array), status.`;
        break;
      
      case 'ai-tool':
        systemPrompt = `You are an AI tools specialist. Generate comprehensive descriptions for AI tools that highlight their capabilities and use cases. Include:
        - A clear tool title
        - Detailed description of features and capabilities
        - Pricing information
        - Complexity level
        - Relevant categories and tags
        Return the response as a JSON object with: title, description, features (array), pricing, complexity, category, tags (array).`;
        break;
      
      case 'seo':
        systemPrompt = `You are an SEO specialist. Generate SEO-optimized content including title tags, meta descriptions, and keywords based on the provided content.
        Return the response as a JSON object with: seoTitle, seoDescription, targetKeyword, seoKeywords (array).`;
        break;

      default:
        systemPrompt = 'You are a helpful content creation assistant. Generate high-quality content based on the user\'s request.';
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${userPrompt}${context ? `\n\nContext: ${context}` : ''}` }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate content' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    console.log('AI Content Generated Successfully');

    // Try to parse as JSON, fallback to plain text
    let parsedContent;
    try {
      parsedContent = JSON.parse(generatedContent);
    } catch {
      parsedContent = { content: generatedContent };
    }

    return new Response(
      JSON.stringify({ success: true, data: parsedContent }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('AI Content Generation Error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});