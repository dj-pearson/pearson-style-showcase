import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

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

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { text, project_id, project_name } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text input is required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get active AI model config for task_generation or general use case
    const { data: configs, error: configError } = await supabaseClient
      .from("ai_model_configs")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (configError || !configs) {
      throw new Error("Failed to load AI model configurations");
    }

    const activeConfigs = configs || [];

    // Prefer task_generation-specific configs, then 'all', then general configs
    const taskConfigs = activeConfigs.filter((c: any) =>
      c.use_case && c.use_case.includes("task_generation")
    );
    const allUseConfigs = activeConfigs.filter((c: any) =>
      c.use_case && c.use_case.includes("all")
    );
    const generalConfigs = activeConfigs.filter((c: any) =>
      !c.use_case || c.use_case.includes("general")
    );

    const orderedConfigs =
      taskConfigs.length > 0
        ? taskConfigs
        : allUseConfigs.length > 0
          ? allUseConfigs
          : generalConfigs;

    if (orderedConfigs.length === 0) {
      throw new Error("No active AI configuration found for task generation");
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
                  temperature: 0.3,
                  topP: 0.8,
                  maxOutputTokens: 4096,
                  ...(config.configuration || {})
                }
              })
            }
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
              max_tokens: 4096,
              messages: [
                { role: "user", content: `${systemPrompt}\n\n${userPrompt}` }
              ]
            })
          });

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
              temperature: 0.3,
              max_tokens: 4096
            })
          });

          if (response.ok) {
            const result = await response.json();
            generatedResponse = result.choices?.[0]?.message?.content;
            if (generatedResponse) {
              usedConfig = config;
              break;
            }
          } else {
            const errorText = await response.text();
            console.error(`OpenAI API error: ${response.status} - ${errorText}`);
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
              ]
            })
          });

          if (response.ok) {
            const result = await response.json();
            generatedResponse = result.choices?.[0]?.message?.content;
            if (generatedResponse) {
              usedConfig = config;
              break;
            }
          } else {
            const errorText = await response.text();
            console.error(`Lovable API error: ${response.status} - ${errorText}`);
          }
        }

      } catch (error) {
        console.error(`Failed with ${config.provider}:`, error);
        continue;
      }
    }

    if (!generatedResponse) {
      throw new Error("All AI models failed to generate tasks");
    }

    // Clean up the response - remove markdown code blocks if present
    let cleanedResponse = generatedResponse.trim();
    if (cleanedResponse.startsWith("```json")) {
      cleanedResponse = cleanedResponse.slice(7);
    } else if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    if (cleanedResponse.endsWith("```")) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();

    // Parse the JSON response
    let parsedTasks: GeneratedTasksResponse;
    try {
      parsedTasks = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("Failed to parse AI response:", cleanedResponse);
      throw new Error("Failed to parse AI response as JSON");
    }

    // Validate the response structure
    if (!parsedTasks.tasks || !Array.isArray(parsedTasks.tasks)) {
      throw new Error("Invalid response format: missing tasks array");
    }

    // Validate and normalize each task
    const validatedTasks: TaskData[] = parsedTasks.tasks.map((task: any) => ({
      title: task.title || "Untitled Task",
      description: task.description || null,
      category: task.category || null,
      priority: ['low', 'medium', 'high', 'urgent'].includes(task.priority)
        ? task.priority
        : 'medium',
      effort: task.effort || null,
      dependencies: task.dependencies || null,
    }));

    console.log(`Successfully generated ${validatedTasks.length} tasks using ${usedConfig.provider}`);

    return new Response(
      JSON.stringify({
        success: true,
        tasks: validatedTasks,
        summary: parsedTasks.summary || `Generated ${validatedTasks.length} task(s)`,
        model_used: `${usedConfig.provider} - ${usedConfig.model_name}`,
        config_id: usedConfig.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Generate tasks error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
