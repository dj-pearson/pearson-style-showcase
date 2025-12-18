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
    const { url, type } = await req.json();

    if (!url || !type) {
      return new Response(
        JSON.stringify({ error: 'URL and type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createSupabaseClient();

    // Get lightweight AI configs for URL extraction (simple data extraction)
    const aiConfigs = await getAIConfigs(supabaseClient, 'lightweight', 'url_extraction');
    console.log(`[Extract] Found ${aiConfigs.length} lightweight AI configs`);

    console.log(`[Extract] Extracting content from URL: ${url} for type: ${type}`);

    // Fetch the website content
    let pageContent = '';
    let metaImage = '';
    let detectedLinks = { github: '', demo: '' };
    
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
      
      // Extract meta tags for images
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
      metaImage = ogImageMatch?.[1] || twitterImageMatch?.[1] || '';
      
      // Look for GitHub links
      const githubMatch = html.match(/https?:\/\/github\.com\/[^\s"'<>]+/i);
      if (githubMatch) detectedLinks.github = githubMatch[0];
      
      // Look for common demo/live links (excluding the current URL)
      const linkMatches = html.match(/https?:\/\/[^\s"'<>]+/gi) || [];
      for (const link of linkMatches) {
        if (link !== url && !link.includes('github.com') && 
            (link.includes('demo') || link.includes('app') || link.includes('live'))) {
          detectedLinks.demo = link;
          break;
        }
      }
      
      // Extract text content from HTML
      // Remove script and style tags
      pageContent = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 10000); // Increased limit for better context
    } catch (fetchError) {
      console.error('[Extract] Error fetching URL:', fetchError);
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
  "description": "comprehensive description of the project, its purpose, features, and technical implementation (2-3 sentences)",
  "tags": ["technology1", "technology2", "framework1"],
  "status": "Active",
  "github_link": "github url if found",
  "live_link": "demo or live site url if found",
  "image_url": "logo or project image url if found"
}`;

      extractionPrompt = `Analyze this webpage content and extract project information.

${detectedLinks.github ? `GitHub link detected: ${detectedLinks.github}` : ''}
${detectedLinks.demo ? `Demo link detected: ${detectedLinks.demo}` : ''}
${metaImage ? `Image found: ${metaImage}` : ''}

Focus on identifying:
- Project name/title (clear, concise)
- What the project does - be specific about features and benefits (2-3 sentences)
- Technologies, frameworks, and tools used (look for: React, Vue, Node.js, Python, TypeScript, JavaScript, etc.)
- GitHub repository URL (if available)
- Live demo or website URL (if available)
- Logo or main project image URL

Be thorough in finding technologies mentioned in the content. Look for programming languages, frameworks, databases, and tools.

Webpage URL: ${url}
Webpage content:
${pageContent}

Return ONLY the JSON object, no other text.`;

    } else if (type === 'ai-tool') {
      systemPrompt = `You are an AI tools specialist. Extract AI tool information from the provided webpage content and return ONLY a valid JSON object (no markdown formatting, no code blocks).

Return this exact structure:
{
  "title": "tool name",
  "description": "comprehensive description of what the tool does, its capabilities, and use cases (2-3 sentences)",
  "features": ["feature1", "feature2", "feature3"],
  "category": "most appropriate category",
  "pricing": "Free or Freemium or Paid or Open Source",
  "complexity": "Beginner or Intermediate or Advanced",
  "tags": ["tag1", "tag2", "tag3"],
  "link": "main website url",
  "github_link": "github url if found",
  "image_url": "logo or tool image url if found"
}`;

      extractionPrompt = `Analyze this webpage content and extract AI tool information.

${detectedLinks.github ? `GitHub link detected: ${detectedLinks.github}` : ''}
${metaImage ? `Image found: ${metaImage}` : ''}

Focus on identifying:
- Tool name (clear, concise)
- What it does and its key capabilities (2-3 sentences)
- Main features and functionality (list 3-5 key features)
- Pricing model (Free, Freemium, Paid, or Open Source)
- Technical complexity level (Beginner, Intermediate, or Advanced)
- Category (e.g., NLP, Computer Vision, ML Platform, Code Generation, Data Analysis)
- Relevant tags and keywords for searchability
- GitHub repository URL (if available)
- Logo or main tool image URL

Webpage URL: ${url}
Webpage content:
${pageContent}

Return ONLY the JSON object, no other text.`;
    }

    // Call AI using lightweight model
    const { response: extractedContent, usedConfig } = await callAIWithConfig(
      aiConfigs,
      systemPrompt,
      extractionPrompt,
      { temperature: 0.3, maxTokens: 2000, jsonMode: true }
    );

    console.log(`[Extract] Content extracted using ${usedConfig.provider} - ${usedConfig.model_name}`);

    // Parse the JSON response
    let parsedData;
    try {
      parsedData = parseJSONResponse(extractedContent);
    } catch (parseError) {
      console.error('[Extract] Failed to parse AI response as JSON:', parseError);
      console.error('[Extract] Content that failed to parse:', extractedContent);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse extracted data',
          details: 'The AI response was not valid JSON',
          raw: extractedContent.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Extract] Successfully extracted and parsed data');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedData,
        sourceUrl: url,
        model_used: `${usedConfig.provider} - ${usedConfig.model_name}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Extract] URL Extraction Error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};
