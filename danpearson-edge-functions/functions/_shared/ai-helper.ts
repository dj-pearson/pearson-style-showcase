import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Types
export type ModelTier = 'lightweight' | 'normal';
export type Provider = 'gemini-free' | 'gemini-paid' | 'claude' | 'openai' | 'lovable';

export interface AIConfig {
  id: string;
  provider: Provider;
  model_name: string;
  api_key_secret_name: string;
  priority: number;
  is_default: boolean;
  is_active: boolean;
  configuration: Record<string, any>;
  use_case: string;
  model_tier: ModelTier;
  last_tested_at?: string;
  last_test_status?: string;
}

export interface AICallOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface AICallResult {
  response: string;
  usedConfig: AIConfig;
}

/**
 * Get AI configurations filtered by tier and optional use case
 * Includes cross-tier fallback: lightweight ↔ normal for resilience
 * 
 * @param supabaseClient - Supabase client instance
 * @param tier - 'lightweight' for fast/cheap tasks, 'normal' for quality tasks
 * @param useCase - Optional specific use case (e.g., 'article_generation', 'ticket_response')
 */
export async function getAIConfigs(
  supabaseClient: SupabaseClient,
  tier: ModelTier = 'normal',
  useCase?: string
): Promise<AIConfig[]> {
  // Get all active configs
  const { data: allConfigs, error: configError } = await supabaseClient
    .from("ai_model_configs")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (configError) {
    console.error("[AI] Failed to load AI model configurations:", configError);
    throw new Error("Failed to load AI model configurations");
  }

  if (!allConfigs || allConfigs.length === 0) {
    throw new Error("No active AI configurations found");
  }

  // Separate configs by tier
  const primaryTierConfigs = allConfigs.filter((c: AIConfig) => c.model_tier === tier);
  const fallbackTier: ModelTier = tier === 'lightweight' ? 'normal' : 'lightweight';
  const fallbackTierConfigs = allConfigs.filter((c: AIConfig) => c.model_tier === fallbackTier);

  // Build ordered list: primary tier first, then fallback tier
  let orderedConfigs: AIConfig[] = [];

  // Filter by use case if provided
  const filterByUseCase = (configs: AIConfig[]): AIConfig[] => {
    if (!useCase) return configs;

    const useCaseConfigs = configs.filter((c: AIConfig) =>
      c.use_case && c.use_case.includes(useCase)
    );
    const allUseConfigs = configs.filter((c: AIConfig) =>
      c.use_case && c.use_case.includes("all")
    );
    const generalConfigs = configs.filter((c: AIConfig) =>
      !c.use_case || c.use_case.includes("general")
    );

    // Return filtered in priority: specific > all > general, or full list if no matches
    if (useCaseConfigs.length > 0) return useCaseConfigs;
    if (allUseConfigs.length > 0) return allUseConfigs;
    if (generalConfigs.length > 0) return generalConfigs;
    return configs; // Return all if no use case matches
  };

  // Add primary tier configs (filtered by use case)
  const filteredPrimary = filterByUseCase(primaryTierConfigs);
  orderedConfigs.push(...filteredPrimary);

  // Add fallback tier configs (filtered by use case) for resilience
  const filteredFallback = filterByUseCase(fallbackTierConfigs);
  orderedConfigs.push(...filteredFallback);

  if (orderedConfigs.length === 0) {
    // Ultimate fallback: use any active config
    console.warn(`[AI] No ${tier} or ${fallbackTier} configs found, using any available`);
    orderedConfigs = allConfigs as AIConfig[];
  } else {
    console.log(`[AI] Config order: ${orderedConfigs.length} configs (${filteredPrimary.length} ${tier}, ${filteredFallback.length} ${fallbackTier} fallback)`);
  }

  return orderedConfigs;
}

/**
 * Call AI using centralized configuration with fallback support
 * 
 * @param configs - Array of AI configurations to try in order
 * @param systemPrompt - System prompt for the AI
 * @param userPrompt - User prompt for the AI
 * @param options - Optional parameters (temperature, maxTokens, jsonMode)
 */
export async function callAIWithConfig(
  configs: AIConfig[],
  systemPrompt: string,
  userPrompt: string,
  options: AICallOptions = {}
): Promise<AICallResult> {
  const { temperature = 0.7, maxTokens = 4000, jsonMode = false } = options;

  for (const config of configs) {
    console.log(`[AI] Trying model: ${config.provider} - ${config.model_name}`);

    try {
      const apiKey = Deno.env.get(config.api_key_secret_name);
      if (!apiKey) {
        console.error(`[AI] API key ${config.api_key_secret_name} not found`);
        continue;
      }

      let response: Response;
      let generatedResponse: string | null = null;

      switch (config.provider) {
        case "gemini-paid":
        case "gemini-free": {
          response = await fetch(
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
            generatedResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
          } else {
            const errorText = await response.text();
            console.error(`[AI] Gemini API error: ${response.status}`, errorText);
          }
          break;
        }

        case "claude": {
          response = await fetch("https://api.anthropic.com/v1/messages", {
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
            generatedResponse = result.content?.[0]?.text;
          } else {
            const errorText = await response.text();
            console.error(`[AI] Claude API error: ${response.status}`, errorText);
          }
          break;
        }

        case "openai": {
          response = await fetch("https://api.openai.com/v1/chat/completions", {
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
            generatedResponse = result.choices?.[0]?.message?.content;
          } else {
            const errorText = await response.text();
            console.error(`[AI] OpenAI API error: ${response.status}`, errorText);
          }
          break;
        }

        case "lovable": {
          response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            generatedResponse = result.choices?.[0]?.message?.content;
          } else {
            const errorText = await response.text();
            console.error(`[AI] Lovable API error: ${response.status}`, errorText);
          }
          break;
        }
      }

      if (generatedResponse) {
        console.log(`[AI] Success with ${config.provider} - ${config.model_name}`);
        return { response: generatedResponse, usedConfig: config };
      }

    } catch (error) {
      console.error(`[AI] Failed with ${config.provider}:`, error);
      continue;
    }
  }

  throw new Error("All AI models failed to generate a response");
}

/**
 * Call AI with vision capabilities (for image processing)
 * Only certain models support vision - this function handles the differences
 */
export async function callAIWithVision(
  configs: AIConfig[],
  prompt: string,
  imageDataUrl: string,
  options: AICallOptions = {}
): Promise<AICallResult> {
  const { temperature = 0.1, maxTokens = 4000 } = options;

  for (const config of configs) {
    console.log(`[AI Vision] Trying model: ${config.provider} - ${config.model_name}`);

    try {
      const apiKey = Deno.env.get(config.api_key_secret_name);
      if (!apiKey) {
        console.error(`[AI Vision] API key ${config.api_key_secret_name} not found`);
        continue;
      }

      let response: Response;
      let generatedResponse: string | null = null;

      switch (config.provider) {
        case "gemini-paid":
        case "gemini-free": {
          // Extract base64 and mime type from data URL
          const matches = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) {
            console.error("[AI Vision] Invalid image data URL format");
            continue;
          }
          const [, mimeType, base64Data] = matches;

          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.model_name}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: prompt },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                      }
                    }
                  ]
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
            generatedResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
          } else {
            const errorText = await response.text();
            console.error(`[AI Vision] Gemini API error: ${response.status}`, errorText);
          }
          break;
        }

        case "openai": {
          // OpenAI GPT-4 Vision
          response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: config.model_name,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: imageDataUrl } }
                  ]
                }
              ],
              temperature,
              max_tokens: maxTokens
            })
          });

          if (response.ok) {
            const result = await response.json();
            generatedResponse = result.choices?.[0]?.message?.content;
          } else {
            const errorText = await response.text();
            console.error(`[AI Vision] OpenAI API error: ${response.status}`, errorText);
          }
          break;
        }

        case "lovable": {
          // Lovable gateway (OpenAI-compatible)
          response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: config.model_name,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: imageDataUrl } }
                  ]
                }
              ],
              temperature,
              max_tokens: maxTokens
            })
          });

          if (response.ok) {
            const result = await response.json();
            generatedResponse = result.choices?.[0]?.message?.content;
          } else {
            const errorText = await response.text();
            console.error(`[AI Vision] Lovable API error: ${response.status}`, errorText);
          }
          break;
        }

        case "claude": {
          // Claude with vision
          const matches = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) {
            console.error("[AI Vision] Invalid image data URL format");
            continue;
          }
          const [, mediaType, base64Data] = matches;

          response = await fetch("https://api.anthropic.com/v1/messages", {
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
                {
                  role: "user",
                  content: [
                    {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: mediaType,
                        data: base64Data
                      }
                    },
                    { type: "text", text: prompt }
                  ]
                }
              ]
            })
          });

          if (response.ok) {
            const result = await response.json();
            generatedResponse = result.content?.[0]?.text;
          } else {
            const errorText = await response.text();
            console.error(`[AI Vision] Claude API error: ${response.status}`, errorText);
          }
          break;
        }
      }

      if (generatedResponse) {
        console.log(`[AI Vision] Success with ${config.provider} - ${config.model_name}`);
        return { response: generatedResponse, usedConfig: config };
      }

    } catch (error) {
      console.error(`[AI Vision] Failed with ${config.provider}:`, error);
      continue;
    }
  }

  throw new Error("All AI models failed to process the image");
}

/**
 * Parse JSON from AI response, handling markdown code blocks
 */
export function parseJSONResponse(content: string): any {
  // Remove markdown code blocks if present
  let jsonContent = content.trim();
  
  if (jsonContent.startsWith("```json")) {
    jsonContent = jsonContent.slice(7);
  } else if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent.slice(3);
  }
  
  if (jsonContent.endsWith("```")) {
    jsonContent = jsonContent.slice(0, -3);
  }
  
  jsonContent = jsonContent.trim();

  // Try to find JSON object boundaries if still not clean
  if (!jsonContent.startsWith("{") && !jsonContent.startsWith("[")) {
    const jsonStart = jsonContent.indexOf("{");
    const arrayStart = jsonContent.indexOf("[");
    const start = jsonStart === -1 ? arrayStart : (arrayStart === -1 ? jsonStart : Math.min(jsonStart, arrayStart));
    
    if (start !== -1) {
      const isArray = jsonContent[start] === "[";
      const end = isArray ? jsonContent.lastIndexOf("]") : jsonContent.lastIndexOf("}");
      if (end > start) {
        jsonContent = jsonContent.substring(start, end + 1);
      }
    }
  }

  return JSON.parse(jsonContent);
}

/**
 * Create a Supabase client with service role key
 */
export function createSupabaseClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

