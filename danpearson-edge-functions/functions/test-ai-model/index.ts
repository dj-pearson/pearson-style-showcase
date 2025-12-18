import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { config_id } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch the config
    const { data: config, error: configError } = await supabaseClient
      .from("ai_model_configs")
      .select("*")
      .eq("id", config_id)
      .single();

    if (configError || !config) {
      throw new Error("Configuration not found");
    }

    const apiKey = Deno.env.get(config.api_key_secret_name);
    if (!apiKey) {
      throw new Error(`API key ${config.api_key_secret_name} not found in environment`);
    }

    let testResult: any;
    let success = false;
    let errorDetails = "";

    // Test based on provider
    if (config.provider === "gemini-paid" || config.provider === "gemini-free") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model_name}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: "Say 'test successful' if you can read this." }]
            }]
          })
        }
      );

      testResult = await response.json();
      success = response.ok && testResult.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!success) {
        errorDetails = `Status: ${response.status}, Response: ${JSON.stringify(testResult)}`;
        console.error("Gemini test failed:", errorDetails);
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
          max_tokens: 100,
          messages: [
            { role: "user", content: "Say 'test successful' if you can read this." }
          ]
        })
      });

      testResult = await response.json();
      success = response.ok && testResult.content?.[0]?.text;
      
      if (!success) {
        errorDetails = `Status: ${response.status}, Response: ${JSON.stringify(testResult)}`;
        console.error("Claude test failed:", errorDetails);
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
            { role: "user", content: "Say 'test successful' if you can read this." }
          ]
        })
      });

      testResult = await response.json();
      success = response.ok && testResult.choices?.[0]?.message?.content;
      
      if (!success) {
        errorDetails = `Status: ${response.status}, Response: ${JSON.stringify(testResult)}`;
        console.error("Lovable test failed:", errorDetails);
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
            { role: "user", content: "Say 'test successful' if you can read this." }
          ],
          max_completion_tokens: 100
        })
      });

      testResult = await response.json();
      success = response.ok && testResult.choices?.[0]?.message?.content;
      
      if (!success) {
        errorDetails = `Status: ${response.status}, Response: ${JSON.stringify(testResult)}`;
        console.error("OpenAI test failed:", errorDetails);
      }
    }

    // Update config with test results
    const updateData: any = {
      last_tested_at: new Date().toISOString(),
      last_test_status: success ? "success" : "failed"
    };
    
    // Store error details in configuration if failed
    if (!success && errorDetails) {
      updateData.configuration = {
        ...config.configuration,
        last_error: errorDetails
      };
    }
    
    await supabaseClient
      .from("ai_model_configs")
      .update(updateData)
      .eq("id", config_id);

    return new Response(
      JSON.stringify({
        success,
        message: success ? "Model test successful" : `Model test failed: ${errorDetails}`,
        details: testResult,
        errorDetails: errorDetails || undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Test error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};