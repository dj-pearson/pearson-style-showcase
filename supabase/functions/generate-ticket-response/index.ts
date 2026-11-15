import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import { callAIWithConfig, type AIConfig } from '../_shared/ai-helper.ts';

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Reads full ticket threads and spends an AI provider key; admins only.
  const auth = await requireAdmin(req, corsHeaders);
  if (!auth.ok) return auth.response!;

  try {
    const { ticket_id } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch ticket and all email threads
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('support_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Ticket not found');
    }

    const { data: threads, error: threadsError } = await supabaseClient
      .from('email_threads')
      .select('*')
      .eq('ticket_id', ticket_id)
      .order('created_at', { ascending: true });

    if (threadsError) {
      throw new Error('Failed to fetch email threads');
    }

    // Get active AI model config for ticket_response use case
    // use_case is now a comma-separated string, so we check if it contains ticket_response or all
    const { data: configs, error: configError } = await supabaseClient
      .from('ai_model_configs')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (configError || !configs) {
      throw new Error('Failed to load AI model configurations');
    }

    const activeConfigs = configs || [];

    // Prefer ticket_response-specific configs, then 'all', then general configs
    const ticketConfigs = activeConfigs.filter(
      (c: any) => c.use_case && c.use_case.includes('ticket_response')
    );
    const allUseConfigs = activeConfigs.filter(
      (c: any) => c.use_case && c.use_case.includes('all')
    );
    const generalConfigs = activeConfigs.filter(
      (c: any) => !c.use_case || c.use_case.includes('general')
    );

    const orderedConfigs =
      ticketConfigs.length > 0
        ? ticketConfigs
        : allUseConfigs.length > 0
          ? allUseConfigs
          : generalConfigs;

    if (orderedConfigs.length === 0) {
      throw new Error('No active AI configuration found for ticket responses');
    }

    // Build conversation history
    const conversationHistory = threads.map((thread) => ({
      role: thread.direction === 'inbound' ? 'customer' : 'agent',
      from: thread.from_email,
      to: thread.to_email,
      subject: thread.subject,
      body: thread.body_text || thread.body_html,
      timestamp: thread.created_at,
    }));

    const ticketPrompt = `You are a helpful customer support agent for BuildDesk. 
Review the ticket history below and generate a professional, empathetic response to the customer's latest message.

Ticket Subject: ${ticket.subject}
Ticket Status: ${ticket.status}
Ticket Priority: ${ticket.priority}

Conversation History:
${conversationHistory
  .map(
    (msg) =>
      `[${msg.timestamp}] ${msg.role.toUpperCase()} (${msg.from} → ${msg.to}):\n${msg.body}\n---`
  )
  .join('\n')}

Generate a response that:
1. Addresses the customer's concerns directly
2. Provides clear next steps or solutions
3. Maintains a professional and empathetic tone
4. Is concise but comprehensive (2-3 paragraphs)

Generate ONLY the response text, no additional formatting or metadata.`;

    // ai-helper applies the timeout and retry policy and runs deprecated
    // openai/lovable rows on Claude, reporting the model that actually ran.
    const { response: generatedResponse, usedConfig } = await callAIWithConfig(
      orderedConfigs as AIConfig[],
      'You are a helpful customer support agent.',
      ticketPrompt,
      { maxTokens: 1024, redirectDeprecatedToClaude: true }
    );

    return new Response(
      JSON.stringify({
        success: true,
        response: generatedResponse,
        model_used: `${usedConfig.provider} - ${usedConfig.model_name}`,
        config_id: usedConfig.id,
        ticket_subject: ticket.subject,
        ticket_number: ticket.ticket_number,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate response error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
