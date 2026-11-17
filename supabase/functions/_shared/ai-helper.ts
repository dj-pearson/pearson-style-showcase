import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { fetchJsonWithTimeout, FetchHttpError } from './fetch-with-timeout.ts';

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
  /** Deadline for each provider call (default 120s for text, 60s for vision) */
  timeoutMs?: number;
  /** Deadline across all configs tried (default AI_DEFAULT_TOTAL_BUDGET_MS) */
  totalBudgetMs?: number;
  /** Run openai/lovable configs on Claude instead (see callSingleConfig) */
  redirectDeprecatedToClaude?: boolean;
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
    .from('ai_model_configs')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (configError) {
    console.error('[AI] Failed to load AI model configurations:', configError);
    throw new Error('Failed to load AI model configurations');
  }

  if (!allConfigs || allConfigs.length === 0) {
    throw new Error('No active AI configurations found');
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

    const useCaseConfigs = configs.filter(
      (c: AIConfig) => c.use_case && c.use_case.includes(useCase)
    );
    const allUseConfigs = configs.filter((c: AIConfig) => c.use_case && c.use_case.includes('all'));
    const generalConfigs = configs.filter(
      (c: AIConfig) => !c.use_case || c.use_case.includes('general')
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
    console.log(
      `[AI] Config order: ${orderedConfigs.length} configs (${filteredPrimary.length} ${tier}, ${filteredFallback.length} ${fallbackTier} fallback)`
    );
  }

  return orderedConfigs;
}

/** Per-call deadline for text generation, headers and body included. */
export const AI_GENERATION_TIMEOUT_MS = 120_000;
/** Per-call deadline for vision/OCR calls. */
export const AI_VISION_TIMEOUT_MS = 60_000;
/**
 * Default ceiling for one callAIWithConfig/callAIWithVision across every
 * config it tries. Pipelines that reclaim stale runs must wait longer than
 * this (see generate-ai-article and amazon-article-pipeline).
 */
export const AI_DEFAULT_TOTAL_BUDGET_MS = 300_000;

/** Used when a config names no model or a deprecated provider is redirected. */
export const DEFAULT_CLAUDE_MODEL_FALLBACK = 'claude-sonnet-4-6';

/** Claude model for fallbacks: env AI_DEFAULT_CLAUDE_MODEL, else DEFAULT_CLAUDE_MODEL_FALLBACK. */
export function getDefaultClaudeModel(): string {
  try {
    return Deno.env.get('AI_DEFAULT_CLAUDE_MODEL')?.trim() || DEFAULT_CLAUDE_MODEL_FALLBACK;
  } catch {
    // No env permission (tests): use the built-in default.
    return DEFAULT_CLAUDE_MODEL_FALLBACK;
  }
}

/** The fields a single provider call needs from a config row. */
export type ProviderTarget = Pick<AIConfig, 'provider' | 'model_name' | 'api_key_secret_name'> & {
  configuration?: Record<string, any> | null;
};

export interface ProviderRequest {
  system?: string;
  prompt: string;
  /** data: URL (base64) for vision calls */
  imageDataUrl?: string;
  temperature?: number;
  maxTokens: number;
  jsonMode?: boolean;
}

/** A provider call that produced no text. `status` is set when the provider answered. */
export class AIProviderError extends Error {
  provider: string;
  status?: number;
  body?: string;
  constructor(provider: string, message: string, status?: number, body?: string) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.status = status;
    this.body = body;
  }
}

const DEPRECATED_PROVIDERS: Provider[] = ['openai', 'lovable'];
const GEMINI_REJECTED_KEYS = ['thinking', 'last_error', 'thinkingConfig'];

function geminiGenerationConfig(configuration?: Record<string, any> | null): Record<string, any> {
  if (!configuration) return {};
  return Object.fromEntries(
    Object.entries(configuration).filter(([key]) => !GEMINI_REJECTED_KEYS.includes(key))
  );
}

function splitDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return matches ? { mediaType: matches[1], data: matches[2] } : null;
}

interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  extract: (result: any) => string | undefined;
}

function buildRequest(
  provider: Provider,
  model: string,
  apiKey: string,
  req: ProviderRequest,
  configuration?: Record<string, any> | null
): BuiltRequest {
  const image = req.imageDataUrl ? splitDataUrl(req.imageDataUrl) : null;
  if (req.imageDataUrl && !image) {
    throw new AIProviderError(provider, 'Invalid image data URL format');
  }

  switch (provider) {
    case 'gemini-paid':
    case 'gemini-free': {
      const text = req.system ? `${req.system}\n\n${req.prompt}` : req.prompt;
      const parts: Record<string, unknown>[] = [{ text }];
      if (image) parts.push({ inline_data: { mime_type: image.mediaType, data: image.data } });
      return {
        // The key goes in a header, not the query string, so it never lands in
        // URL logs or error messages.
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: {
          contents: [{ parts }],
          generationConfig: {
            ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
            maxOutputTokens: req.maxTokens,
            ...geminiGenerationConfig(configuration),
          },
        },
        extract: (r) => r?.candidates?.[0]?.content?.parts?.[0]?.text,
      };
    }

    case 'claude': {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
      let content: unknown = req.prompt;
      if (image) {
        const isPdf = image.mediaType === 'application/pdf';
        // PDF support requires the beta header
        if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';
        // Claude only accepts these image media types
        const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const block = isPdf
          ? {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: image.data },
            }
          : {
              type: 'image',
              source: {
                type: 'base64',
                media_type: supportedImageTypes.includes(image.mediaType)
                  ? image.mediaType
                  : 'image/png',
                data: image.data,
              },
            };
        content = [block, { type: 'text', text: req.prompt }];
      }
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers,
        body: {
          model,
          max_tokens: req.maxTokens,
          // Claude takes the system prompt as a top-level field. Concatenating
          // it into the user turn instead measurably weakens instruction
          // following, so keep it separate here.
          ...(req.system ? { system: req.system } : {}),
          messages: [{ role: 'user', content }],
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        },
        extract: (r) =>
          (Array.isArray(r?.content)
            ? r.content.find((b: { type?: string }) => b?.type === 'text')?.text
            : undefined) ?? r?.content?.[0]?.text,
      };
    }

    case 'openai':
    case 'lovable': {
      const userContent = image
        ? [
            { type: 'text', text: req.prompt },
            { type: 'image_url', image_url: { url: req.imageDataUrl } },
          ]
        : req.prompt;
      return {
        url:
          provider === 'openai'
            ? 'https://api.openai.com/v1/chat/completions'
            : 'https://ai.gateway.lovable.dev/v1/chat/completions',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: {
          model,
          messages: [
            ...(req.system ? [{ role: 'system', content: req.system }] : []),
            { role: 'user', content: userContent },
          ],
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          max_tokens: req.maxTokens,
          ...(req.jsonMode && !image ? { response_format: { type: 'json_object' } } : {}),
        },
        extract: (r) => r?.choices?.[0]?.message?.content,
      };
    }

    default:
      throw new AIProviderError(String(provider), `Unsupported provider: ${provider}`);
  }
}

/**
 * Make one provider call and return its text. Goes through fetchWithTimeout
 * with a hard deadline; a paid POST is never repeated after a timeout and is
 * retried at most once, only when the provider rejected it (429/503/529).
 * Throws AIProviderError (or FetchTimeoutError) when there is no text.
 */
export async function callProvider(
  provider: Provider,
  model: string,
  apiKey: string,
  req: ProviderRequest,
  options: { configuration?: Record<string, any> | null; timeoutMs?: number } = {}
): Promise<string> {
  const built = buildRequest(provider, model, apiKey, req, options.configuration);
  try {
    const { data } = await fetchJsonWithTimeout<any>(
      built.url,
      { method: 'POST', headers: built.headers, body: JSON.stringify(built.body) },
      {
        timeoutMs: options.timeoutMs ?? AI_GENERATION_TIMEOUT_MS,
        maxRetries: 2,
        idempotent: false,
        retryOnRejected: true,
        label: `ai:${provider}`,
      }
    );
    const text = built.extract(data);
    if (!text) throw new AIProviderError(provider, `${provider} returned no text`);
    return text;
  } catch (err) {
    if (err instanceof FetchHttpError) {
      throw new AIProviderError(provider, err.message, err.status, err.body);
    }
    throw err;
  }
}

/**
 * Call one config. With `redirectDeprecatedToClaude`, openai/lovable configs
 * run on Claude (CLAUDE_API_KEY, getDefaultClaudeModel()) and the returned
 * usedConfig names what actually ran.
 */
export async function callSingleConfig<T extends ProviderTarget>(
  config: T,
  req: ProviderRequest,
  options: { timeoutMs?: number; redirectDeprecatedToClaude?: boolean } = {}
): Promise<{ response: string; usedConfig: T }> {
  let target: T = config;
  if (options.redirectDeprecatedToClaude && DEPRECATED_PROVIDERS.includes(config.provider)) {
    console.warn(`[AI] Provider "${config.provider}" is deprecated, using Claude instead`);
    target = {
      ...config,
      provider: 'claude',
      model_name: getDefaultClaudeModel(),
      api_key_secret_name: 'CLAUDE_API_KEY',
    };
  }

  const apiKey = Deno.env.get(target.api_key_secret_name);
  if (!apiKey) {
    throw new AIProviderError(target.provider, `API key ${target.api_key_secret_name} not found`);
  }

  const response = await callProvider(
    target.provider,
    target.model_name || getDefaultClaudeModel(),
    apiKey,
    req,
    { configuration: target.configuration, timeoutMs: options.timeoutMs }
  );
  return { response, usedConfig: target };
}

async function callWithFallback(
  tag: string,
  configs: AIConfig[],
  req: ProviderRequest,
  options: AICallOptions,
  defaultTimeoutMs: number
): Promise<AICallResult> {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const deadline = Date.now() + (options.totalBudgetMs ?? AI_DEFAULT_TOTAL_BUDGET_MS);

  for (const config of configs) {
    const remaining = deadline - Date.now();
    if (remaining < 5_000) {
      console.error(`[${tag}] Time budget used up before trying ${config.provider}`);
      break;
    }
    console.log(`[${tag}] Trying model: ${config.provider} - ${config.model_name}`);
    try {
      const result = await callSingleConfig(config, req, {
        timeoutMs: Math.min(timeoutMs, remaining),
        redirectDeprecatedToClaude: options.redirectDeprecatedToClaude,
      });
      console.log(
        `[${tag}] Success with ${result.usedConfig.provider} - ${result.usedConfig.model_name}`
      );
      return result;
    } catch (error) {
      console.error(
        `[${tag}] Failed with ${config.provider}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  throw new Error('All AI models failed to generate a response');
}

/**
 * Call AI using centralized configuration with fallback support
 *
 * @param configs - Array of AI configurations to try in order
 * @param systemPrompt - System prompt for the AI
 * @param userPrompt - User prompt for the AI
 * @param options - temperature, maxTokens, jsonMode, timeouts
 */
export async function callAIWithConfig(
  configs: AIConfig[],
  systemPrompt: string,
  userPrompt: string,
  options: AICallOptions = {}
): Promise<AICallResult> {
  const { temperature = 0.7, maxTokens = 4000, jsonMode = false } = options;
  return await callWithFallback(
    'AI',
    configs,
    { system: systemPrompt, prompt: userPrompt, temperature, maxTokens, jsonMode },
    options,
    AI_GENERATION_TIMEOUT_MS
  );
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
  try {
    return await callWithFallback(
      'AI Vision',
      configs,
      { prompt, imageDataUrl, temperature, maxTokens },
      options,
      AI_VISION_TIMEOUT_MS
    );
  } catch {
    throw new Error('All AI models failed to process the image');
  }
}

/**
 * Parse JSON from AI response, handling markdown code blocks
 */
export function parseJSONResponse(content: string): any {
  // Remove markdown code blocks if present
  let jsonContent = content.trim();

  if (jsonContent.startsWith('```json')) {
    jsonContent = jsonContent.slice(7);
  } else if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.slice(3);
  }

  if (jsonContent.endsWith('```')) {
    jsonContent = jsonContent.slice(0, -3);
  }

  jsonContent = jsonContent.trim();

  // Try to find JSON object boundaries if still not clean
  if (!jsonContent.startsWith('{') && !jsonContent.startsWith('[')) {
    const jsonStart = jsonContent.indexOf('{');
    const arrayStart = jsonContent.indexOf('[');
    const start =
      jsonStart === -1
        ? arrayStart
        : arrayStart === -1
          ? jsonStart
          : Math.min(jsonStart, arrayStart);

    if (start !== -1) {
      const isArray = jsonContent[start] === '[';
      const end = isArray ? jsonContent.lastIndexOf(']') : jsonContent.lastIndexOf('}');
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
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}
