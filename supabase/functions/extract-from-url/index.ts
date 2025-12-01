import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, type } = await req.json();

    if (!url || !type) {
      return new Response(
        JSON.stringify({ error: 'URL and type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lovableApiKey) {
      console.error('Lovable API key not found');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracting content from URL: ${url} for type: ${type}`);

    // Fetch the website content
    let pageContent = '';
    try {
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentExtractor/1.0)',
        },
      });
      
      if (!pageResponse.ok) {
        throw new Error(`Failed to fetch URL: ${pageResponse.status}`);
      }

      const html = await pageResponse.text();
      
      // Extract text content from HTML (simple approach)
      // Remove script and style tags
      pageContent = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 8000); // Limit content length
    } catch (fetchError) {
      console.error('Error fetching URL:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch URL content', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare system prompt based on type
    let systemPrompt = '';
    let extractionPrompt = '';

    if (type === 'project') {
      systemPrompt = `You are a technical content analyst. Extract project information from the provided webpage content and return ONLY a valid JSON object (no markdown formatting, no code blocks).

Return this exact structure:
{
  "title": "project name",
  "description": "comprehensive description of the project, its purpose, features, and technical implementation",
  "tags": ["technology1", "technology2", "framework1"],
  "status": "Active",
  "github_link": "github url if found",
  "live_link": "demo or live site url if found"
}`;

      extractionPrompt = `Analyze this webpage content and extract project information. Focus on identifying:
- Project name/title
- What the project does (features, purpose, goals)
- Technologies, frameworks, and tools used
- Current status or stage
- Any links to GitHub repository or live demo

Webpage content:
${pageContent}

Return ONLY the JSON object, no other text.`;

    } else if (type === 'ai-tool') {
      systemPrompt = `You are an AI tools specialist. Extract AI tool information from the provided webpage content and return ONLY a valid JSON object (no markdown formatting, no code blocks).

Return this exact structure:
{
  "title": "tool name",
  "description": "comprehensive description of what the tool does, its capabilities, and use cases",
  "features": ["feature1", "feature2", "feature3"],
  "category": "most appropriate category",
  "pricing": "Free or Freemium or Paid or Open Source",
  "complexity": "Beginner or Intermediate or Advanced",
  "tags": ["tag1", "tag2", "tag3"],
  "link": "main website url",
  "github_link": "github url if found"
}`;

      extractionPrompt = `Analyze this webpage content and extract AI tool information. Focus on identifying:
- Tool name
- What it does and its key capabilities
- Main features and functionality
- Pricing model (free, paid, freemium, etc.)
- Technical complexity level
- Category (NLP, Computer Vision, ML, etc.)
- Relevant tags and keywords

Webpage content:
${pageContent}

Return ONLY the JSON object, no other text.`;
    }

    // Call Lovable AI API
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: extractionPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.status);
      const errorText = await aiResponse.text();
      console.error('AI API error details:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to extract content from URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const extractedContent = aiData.choices[0].message.content;

    console.log('Raw AI response:', extractedContent);

    // Parse the JSON response
    let parsedData;
    try {
      // Remove markdown code blocks if present
      const cleanedContent = extractedContent
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      parsedData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Content that failed to parse:', extractedContent);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse extracted data',
          details: 'The AI response was not valid JSON',
          raw: extractedContent.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully extracted and parsed data');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedData,
        sourceUrl: url
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('URL Extraction Error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
