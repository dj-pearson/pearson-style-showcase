import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

interface AIModelConfig {
  id: string;
  provider: string;
  model_name: string;
  api_key_env_var: string;
  is_active: boolean;
  priority: number;
  is_lightweight: boolean;
  configuration?: Record<string, unknown>;
}

interface AICallResult {
  text: string;
  model: string;
  provider: string;
}

/**
 * Fetch AI model configs from the database, sorted by priority
 */
async function getAIConfigs(lightweight: boolean = false): Promise<AIModelConfig[]> {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let query = supabaseClient
    .from('ai_model_configs')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (lightweight) {
    query = query.eq('is_lightweight', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[AI] Failed to fetch AI configs:', error);
    return [];
  }

  // If no lightweight configs found, fall back to all active configs
  if (lightweight && (!data || data.length === 0)) {
    const { data: allData } = await supabaseClient
      .from('ai_model_configs')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });
    return allData || [];
  }

  return data || [];
}

/**
 * Call AI with text-only prompt, trying multiple models in priority order
 */
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  options?: { lightweight?: boolean; maxTokens?: number; temperature?: number }
): Promise<AICallResult> {
  const configs = await getAIConfigs(options?.lightweight);
  const maxTokens = options?.maxTokens || 4096;
  const temperature = options?.temperature ?? 0.3;

  console.log(`[AI] Config order: ${configs.length} configs`);

  for (const config of configs) {
    const apiKey = Deno.env.get(config.api_key_env_var);
    if (!apiKey) {
      console.warn(`[AI] No API key for ${config.provider} (${config.api_key_env_var})`);
      continue;
    }

    try {
      if (config.provider === 'claude') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.model_name,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            temperature,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const text = result.content?.[0]?.text;
          if (text) {
            return { text, model: config.model_name, provider: config.provider };
          }
        } else {
          const errorText = await response.text();
          console.error(`[AI] Claude API error: ${response.status} - ${errorText}`);
        }
      } else if (config.provider === 'gemini-free' || config.provider === 'gemini-paid') {
        // Filter out non-standard fields from configuration
        const genConfig = config.configuration
          ? Object.fromEntries(
              Object.entries(config.configuration).filter(
                ([key]) => !['thinking', 'last_error'].includes(key)
              )
            )
          : {};

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.model_name}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
                ...genConfig,
              },
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return { text, model: config.model_name, provider: config.provider };
          }
        } else {
          const errorText = await response.text();
          console.error(`[AI] Gemini API error: ${response.status} - ${errorText}`);
        }
      }
    } catch (error) {
      console.error(`[AI] Failed with ${config.provider}:`, error);
      continue;
    }
  }

  throw new Error('All AI models failed to generate a response');
}

/**
 * Call AI with vision (image/PDF input), trying multiple models in priority order
 */
export async function callAIWithVision(
  base64Data: string,
  mimeType: string,
  prompt: string,
  options?: {
    lightweight?: boolean;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  }
): Promise<AICallResult> {
  const configs = await getAIConfigs(options?.lightweight);
  const maxTokens = options?.maxTokens || 4096;
  const temperature = options?.temperature ?? 0.1;
  const systemPrompt = options?.systemPrompt || '';

  const isPdf = mimeType === 'application/pdf';

  const lightweightCount = configs.filter((c) => c.is_lightweight).length;
  const normalCount = configs.length - lightweightCount;
  console.log(
    `[AI] Config order: ${configs.length} configs (${lightweightCount} lightweight, ${normalCount} normal fallback)`
  );

  for (const config of configs) {
    const apiKey = Deno.env.get(config.api_key_env_var);
    if (!apiKey) {
      console.warn(`[AI Vision] No API key for ${config.provider} (${config.api_key_env_var})`);
      continue;
    }

    try {
      console.log(`[AI Vision] Trying model: ${config.provider} - ${config.model_name}`);

      if (config.provider === 'claude') {
        // Claude vision: images use 'image' type, PDFs use 'document' type
        let contentBlock;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        };

        if (isPdf) {
          // PDF support requires the beta header
          headers['anthropic-beta'] = 'pdfs-2024-09-25';
          contentBlock = {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data,
            },
          };
        } else {
          // Only these image types are supported
          const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          const imageMediaType = supportedImageTypes.includes(mimeType) ? mimeType : 'image/png';
          contentBlock = {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMediaType,
              data: base64Data,
            },
          };
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: config.model_name,
            max_tokens: maxTokens,
            ...(systemPrompt ? { system: systemPrompt } : {}),
            messages: [
              {
                role: 'user',
                content: [contentBlock, { type: 'text', text: prompt }],
              },
            ],
            temperature,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const text = result.content?.[0]?.text;
          if (text) {
            return { text, model: config.model_name, provider: config.provider };
          }
        } else {
          const errorText = await response.text();
          console.error(`[AI Vision] Claude API error: ${response.status} ${errorText}`);
        }
      } else if (config.provider === 'gemini-free' || config.provider === 'gemini-paid') {
        // Filter out non-standard fields from configuration
        const genConfig = config.configuration
          ? Object.fromEntries(
              Object.entries(config.configuration).filter(
                ([key]) => !['thinking', 'last_error'].includes(key)
              )
            )
          : {};

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.model_name}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: mimeType,
                        data: base64Data,
                      },
                    },
                    { text: `${systemPrompt ? systemPrompt + '\n\n' : ''}${prompt}` },
                  ],
                },
              ],
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
                ...genConfig,
              },
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return { text, model: config.model_name, provider: config.provider };
          }
        } else {
          const errorText = await response.text();
          console.error(`[AI Vision] Gemini API error: ${response.status} ${errorText}`);
        }
      }
    } catch (error) {
      console.error(`[AI Vision] Failed with ${config.provider}:`, error);
      continue;
    }
  }

  throw new Error('All AI models failed to process the image');
}
