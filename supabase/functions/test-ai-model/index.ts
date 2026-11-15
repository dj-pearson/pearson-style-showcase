import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import { AIProviderError, callSingleConfig, type AIConfig } from '../_shared/ai-helper.ts';

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Spends the configured provider's API key; admins only.
  const auth = await requireAdmin(req, corsHeaders);
  if (!auth.ok) return auth.response!;

  try {
    const { config_id } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch the config
    const { data: config, error: configError } = await supabaseClient
      .from('ai_model_configs')
      .select('*')
      .eq('id', config_id)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ success: false, message: 'Configuration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deprecated openai/lovable rows are tested on Claude, matching how the
    // generating functions run them.
    const redirected = config.provider === 'openai' || config.provider === 'lovable';
    const keyName = redirected ? 'CLAUDE_API_KEY' : config.api_key_secret_name;
    if (!Deno.env.get(keyName)) {
      console.error(`API key secret not found: ${keyName}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'API key is not configured. Please check your environment settings.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let success = false;
    let errorMessage = '';

    if (!['gemini-paid', 'gemini-free', 'claude', 'openai', 'lovable'].includes(config.provider)) {
      errorMessage = 'Unsupported provider';
    } else {
      try {
        await callSingleConfig(
          config as AIConfig,
          // Room for Gemini thinking models, which spend output tokens before
          // they answer; the reply itself is a few words either way.
          { prompt: "Say 'test successful' if you can read this.", maxTokens: 2048 },
          { timeoutMs: 30_000, redirectDeprecatedToClaude: true }
        );
        success = true;
      } catch (err) {
        if (err instanceof AIProviderError && err.status) {
          errorMessage = `Provider returned status ${err.status}`;
        } else if (err instanceof AIProviderError) {
          errorMessage = 'Provider returned no text';
        } else {
          errorMessage = `Failed to connect to ${redirected ? 'claude' : config.provider} API`;
        }
        console.error('Model test failed:', err instanceof Error ? err.message : err);
      }
    }

    // Update config with test results
    const updateData: Record<string, unknown> = {
      last_tested_at: new Date().toISOString(),
      last_test_status: success ? 'success' : 'failed',
    };

    // Store generic error status in configuration if failed (no sensitive details)
    if (!success && errorMessage) {
      updateData.configuration = {
        ...config.configuration,
        last_error: errorMessage,
      };
    }

    await supabaseClient.from('ai_model_configs').update(updateData).eq('id', config_id);

    return new Response(
      JSON.stringify({
        success,
        message: success ? 'Model test successful' : `Model test failed: ${errorMessage}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Test error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'An unexpected error occurred while testing the model.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};
