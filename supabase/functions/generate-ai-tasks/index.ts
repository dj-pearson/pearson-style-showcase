import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { fetchWithTimeout, structuredErrorResponse } from '../_shared/fetch-with-timeout.ts';
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitResponse,
  initRateLimiter,
} from '../_shared/rate-limiter.ts';
import { validateText } from '../_shared/validation.ts';

// Initialize rate limiter cleanup
initRateLimiter();

// 10 generations per hour per IP
const TASK_GEN_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  burstAllowance: 2,
  keyPrefix: 'task-gen',
};

interface TaskData {
  title: string;
  description?: string;
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  effort?: string;
  dependencies?: string;
}

interface GeneratedTasksResponse {
  tasks: TaskData[];
  summary: string;
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limit check
    const clientIp = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(clientIp, TASK_GEN_RATE_LIMIT);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { text, project_id, project_name } = await req.json();

    // Validate text input with max length of 5000 chars
    const textResult = validateText(text, { required: true, minLength: 1, maxLength: 5000 });
    if (!textResult.valid) {
      return new Response(JSON.stringify({ error: textResult.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get active AI model config for task_generation or general use case
    const { data: configs, error: configError } = await supabaseClient
      .from('ai_model_configs')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (configError || !configs) {
      throw new Error('Failed to load AI model configurations');
    }

    const activeConfigs = configs || [];

    // Prefer task_generation-specific configs, then 'all', then general configs
    const taskConfigs = activeConfigs.filter(
      (c: any) => c.use_case && c.use_case.includes('task_generation')
    );
    const allUseConfigs = activeConfigs.filter(
      (c: any) => c.use_case && c.use_case.includes('all')
    );
    const generalConfigs = activeConfigs.filter(
      (c: any) => !c.use_case || c.use_case.includes('general')
    );

    const orderedConfigs =
      taskConfigs.length > 0
        ? taskConfigs
        : allUseConfigs.length > 0
          ? allUseConfigs
          : generalConfigs;

    if (orderedConfigs.length === 0) {
      throw new Error('No active AI configuration found for task generation');
    }

    const systemPrompt = `You are a task extraction and organization specialist. Your job is to analyze text that users paste and extract actionable tasks from it.

IMPORTANT RULES:
1. Extract ONLY the tasks that are explicitly mentioned or strongly implied in the text
2. If the text mentions one task, return ONE task. If it mentions five tasks, return FIVE tasks
3. Do NOT add extra tasks that aren't in the original text
4. Do NOT split a single task into multiple subtasks unless the text clearly indicates separate items
5. Be precise - match the number of tasks to what's actually in the text

For each task, provide:
- title: A clear, actionable title (start with a verb like "Implement", "Fix", "Add", "Update", etc.)
- description: A brief description if more context is available (optional)
- category: Categorize the task (e.g., "Bug Fix", "Feature", "Documentation", "Security", "UI/UX", "Backend", "Frontend", "DevOps", "Testing", etc.) (optional)
- priority: One of "low", "medium", "high", "urgent" - infer from context or default to "medium"
- effort: Time estimate if mentioned or can be reasonably inferred (e.g., "2 hours", "1 day", "1 week") (optional)
- dependencies: Any mentioned dependencies or prerequisites (optional)

${project_name ? `These tasks are for the project: ${project_name}` : ''}

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "tasks": [
    {
      "title": "Task title here",
      "description": "Optional description",
      "category": "Category",
      "priority": "medium",
      "effort": "2 hours",
      "dependencies": "None"
    }
  ],
  "summary": "Brief summary of what was extracted"
}`;

    const userPrompt = `Analyze the following text and extract tasks from it. Remember: only extract tasks that are actually mentioned, don't add extras.

TEXT TO ANALYZE:
${text}`;

    let generatedResponse = null;
    let usedConfig = null;

    // Try each config in priority order until one succeeds
    for (const config of orderedConfigs) {
      console.log(`Trying model: ${config.provider} - ${config.model_name}`);

      try {
        const apiKey = Deno.env.get(config.api_key_secret_name);
        if (!apiKey) {
          console.error(`API key ${config.api_key_secret_name} not found`);
          continue;
        }

        if (config.provider === 'gemini-paid' || config.provider === 'gemini-free') {
          const response = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.model_name}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
                  },
                ],
                generationConfig: {
                  temperature: 0.3,
                  topP: 0.8,
                  maxOutputTokens: 4096,
                  ...(config.configuration || {}),
                },
              }),
            },
            { timeoutMs: 30_000, maxRetries: 2, label: 'gemini-tasks' }
          );

          if (response.ok) {
            const result = await response.json();
            generatedResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (generatedResponse) {
              usedConfig = config;
              break;
            }
          } else {
            const errorText = await response.text();
            console.error(`Gemini API error: ${response.status} - ${errorText}`);
          }
        } else if (config.provider === 'claude') {
          const response = await fetchWithTimeout(
            'https://api.anthropic.com/v1/messages',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: config.model_name,
                max_tokens: 4096,
                messages: [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }],
              }),
            },
            { timeoutMs: 30_000, maxRetries: 2, label: 'claude-tasks' }
          );

          if (response.ok) {
            const result = await response.json();
            generatedResponse = result.content?.[0]?.text;
            if (generatedResponse) {
              usedConfig = config;
              break;
            }
          } else {
            const errorText = await response.text();
            console.error(`Claude API error: ${response.status} - ${errorText}`);
          }
        } else if (config.provider === 'openai' || config.provider === 'lovable') {
          // Deprecated: redirect openai/lovable configs to Claude
          console.warn(`Provider "${config.provider}" is deprecated, falling back to Claude`);
          const FALLBACK_MODEL = 'claude-sonnet-4-6';
          const claudeKey = Deno.env.get('CLAUDE_API_KEY');
          if (!claudeKey) {
            console.error('CLAUDE_API_KEY not configured for fallback');
            continue;
          }
          const response = await fetchWithTimeout(
            'https://api.anthropic.com/v1/messages',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': claudeKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: FALLBACK_MODEL,
                max_tokens: 4096,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
              }),
            },
            { timeoutMs: 30_000, maxRetries: 2, label: 'claude-tasks-fallback' }
          );

          if (response.ok) {
            const result = await response.json();
            generatedResponse = result.content?.[0]?.text;
            if (generatedResponse) {
              // Claude produced this text, not config.provider/config.model_name.
              // Report what actually ran; config_id still points at the row that
              // triggered the fallback so the deprecated config stays traceable.
              usedConfig = { ...config, provider: 'claude', model_name: FALLBACK_MODEL };
              break;
            }
          } else {
            const errorText = await response.text();
            console.error(`Claude API fallback error: ${response.status} - ${errorText}`);
          }
        }
      } catch (error) {
        console.error(`Failed with ${config.provider}:`, error);
        continue;
      }
    }

    if (!generatedResponse) {
      throw new Error('All AI models failed to generate tasks');
    }

    // Clean up the response - remove markdown code blocks if present
    let cleanedResponse = generatedResponse.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.slice(7);
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();

    // Parse the JSON response
    let parsedTasks: GeneratedTasksResponse;
    try {
      parsedTasks = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', cleanedResponse);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate the response structure
    if (!parsedTasks.tasks || !Array.isArray(parsedTasks.tasks)) {
      throw new Error('Invalid response format: missing tasks array');
    }

    // Validate and normalize each task
    const validatedTasks: TaskData[] = parsedTasks.tasks.map((task: any) => ({
      title: task.title || 'Untitled Task',
      description: task.description || null,
      category: task.category || null,
      priority: ['low', 'medium', 'high', 'urgent'].includes(task.priority)
        ? task.priority
        : 'medium',
      effort: task.effort || null,
      dependencies: task.dependencies || null,
    }));

    console.log(
      `Successfully generated ${validatedTasks.length} tasks using ${usedConfig.provider}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        tasks: validatedTasks,
        summary: parsedTasks.summary || `Generated ${validatedTasks.length} task(s)`,
        model_used: `${usedConfig.provider} - ${usedConfig.model_name}`,
        config_id: usedConfig.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate tasks error:', error);
    return structuredErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'TASK_GENERATION_FAILED',
      500,
      corsHeaders
    );
  }
};
