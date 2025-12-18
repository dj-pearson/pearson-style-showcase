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
    // First get the raw text to debug JSON issues
    const rawBody = await req.text();
    console.log('[ContentGen] Raw request body length:', rawBody.length);
    
    // Try to parse the JSON
    let requestBody;
    try {
      requestBody = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[ContentGen] JSON Parse Error:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON format', 
          details: parseError.message,
          receivedData: rawBody.substring(0, 500)
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Handle both direct API calls and Make.com integration
    let type, prompt, context, webhookUrl, companyId, templateCategory;
    
    if (requestBody.company_id || requestBody.template_category) {
      // Make.com integration format
      companyId = requestBody.company_id;
      templateCategory = requestBody.template_category || 'article';
      webhookUrl = requestBody.webhook_url;
      type = templateCategory;
      prompt = requestBody.prompt || `Generate ${templateCategory} content for company ${companyId}`;
      context = requestBody.context;
      
      console.log(`[ContentGen] Make.com AI Content Request - Company: ${companyId}, Template: ${templateCategory}`);
    } else {
      // Direct API format
      type = requestBody.type;
      prompt = requestBody.prompt;
      context = requestBody.context;
      
      console.log(`[ContentGen] Direct AI Content Request - Type: ${type}`);
    }

    const supabaseClient = createSupabaseClient();

    // Get normal tier AI configs for full content generation (quality outputs)
    const aiConfigs = await getAIConfigs(supabaseClient, 'normal', 'content_generation');
    console.log(`[ContentGen] Found ${aiConfigs.length} normal tier AI configs`);

    let systemPrompt = '';
    const userPrompt = prompt;

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

    // Generate content using normal tier AI
    const { response: generatedContent, usedConfig } = await callAIWithConfig(
      aiConfigs,
      systemPrompt,
      `${userPrompt}${context ? `\n\nContext: ${context}` : ''}`,
      { temperature: 0.7, maxTokens: 2000, jsonMode: true }
    );

    console.log(`[ContentGen] Content generated using ${usedConfig.provider} - ${usedConfig.model_name}`);

    // Try to parse as JSON, fallback to plain text
    let parsedContent;
    try {
      parsedContent = parseJSONResponse(generatedContent);
    } catch {
      parsedContent = { content: generatedContent };
    }

    // Prepare response data
    const responseData = {
      success: true,
      data: parsedContent,
      metadata: {
        company_id: companyId,
        template_category: templateCategory,
        generated_at: new Date().toISOString(),
        type: type,
        model_used: `${usedConfig.provider} - ${usedConfig.model_name}`
      }
    };

    // Send webhook notification if Make.com integration
    if (webhookUrl) {
      try {
        console.log(`[ContentGen] Sending webhook notification to: ${webhookUrl}`);
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
            company_id: companyId,
            template_category: templateCategory,
            generated_content: parsedContent,
            timestamp: new Date().toISOString(),
            webhook_source: 'ai-content-generator'
          }),
        });
        console.log('[ContentGen] Webhook notification sent successfully');
      } catch (webhookError) {
        console.error('[ContentGen] Failed to send webhook notification:', webhookError);
        // Don't fail the main request if webhook fails
      }
    }

    return new Response(
      JSON.stringify(responseData), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[ContentGen] AI Content Generation Error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};
