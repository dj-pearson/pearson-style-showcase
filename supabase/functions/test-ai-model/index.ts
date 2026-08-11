import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';

serve(async (req) => {
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

    const apiKey = Deno.env.get(config.api_key_secret_name);
    if (!apiKey) {
      console.error(`API key secret not found: ${config.api_key_secret_name}`);
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

    // Test based on provider
    if (config.provider === 'gemini-paid' || config.provider === 'gemini-free') {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.model_name}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: "Say 'test successful' if you can read this." }],
                },
              ],
            }),
          }
        );

        const testResult = await response.json();
        success = response.ok && !!testResult.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!success) {
          errorMessage = `Provider returned status ${response.status}`;
          console.error('Gemini test failed:', JSON.stringify(testResult));
        }
      } catch (err) {
        errorMessage = 'Failed to connect to Gemini API';
        console.error('Gemini test error:', err);
      }
    } else if (config.provider === 'claude') {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.model_name,
            max_tokens: 100,
            messages: [{ role: 'user', content: "Say 'test successful' if you can read this." }],
          }),
        });

        const testResult = await response.json();
        success = response.ok && !!testResult.content?.[0]?.text;

        if (!success) {
          errorMessage = `Provider returned status ${response.status}`;
          console.error('Claude test failed:', JSON.stringify(testResult));
        }
      } catch (err) {
        errorMessage = 'Failed to connect to Claude API';
        console.error('Claude test error:', err);
      }
    } else if (config.provider === 'openai' || config.provider === 'lovable') {
      // Deprecated providers: redirect to Claude for testing
      console.warn(`Provider "${config.provider}" is deprecated, testing with Claude instead`);
      const claudeKey = Deno.env.get('CLAUDE_API_KEY');
      if (!claudeKey) {
        errorMessage = 'Fallback API key is not configured';
        console.error('CLAUDE_API_KEY not configured for deprecated provider fallback');
      } else {
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': claudeKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 100,
              messages: [{ role: 'user', content: "Say 'test successful' if you can read this." }],
            }),
          });

          const testResult = await response.json();
          success = response.ok && !!testResult.content?.[0]?.text;

          if (!success) {
            errorMessage = `Provider returned status ${response.status}`;
            console.error('Claude fallback test failed:', JSON.stringify(testResult));
          }
        } catch (err) {
          errorMessage = 'Failed to connect to Claude API';
          console.error('Claude fallback test error:', err);
        }
      }
    } else {
      errorMessage = 'Unsupported provider';
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
});
