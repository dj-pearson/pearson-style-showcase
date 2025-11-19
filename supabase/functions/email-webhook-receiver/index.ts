import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailWebhookPayload {
  from: string;
  to: string;
  cc?: string[];
  subject: string;
  body_text?: string;
  body_html?: string;
  message_id?: string;
  in_reply_to?: string;
  references?: string[];
  attachments?: Array<{
    filename: string;
    content_type: string;
    size: number;
    url?: string;
  }>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify webhook secret
    const webhookSecret = req.headers.get('x-webhook-secret');
    const { data: settings } = await supabase
      .from('email_webhook_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!settings || settings.webhook_secret !== webhookSecret) {
      console.error('Invalid webhook secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: EmailWebhookPayload = await req.json();
    console.log('Received email webhook:', { from: payload.from, to: payload.to, subject: payload.subject });

    // Find the appropriate mailbox based on the 'to' address
    const { data: mailbox } = await supabase
      .from('email_mailboxes')
      .select('*')
      .eq('email_address', payload.to)
      .eq('is_active', true)
      .single();

    if (!mailbox) {
      // Try to find default mailbox
      const { data: defaultMailbox } = await supabase
        .from('email_mailboxes')
        .select('*')
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (!defaultMailbox) {
        console.error('No mailbox found for:', payload.to);
        return new Response(JSON.stringify({ error: 'No mailbox configured' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const targetMailbox = mailbox || defaultMailbox;

    // Check if this is a reply to an existing ticket
    let ticketId: string | null = null;
    if (payload.in_reply_to) {
      const { data: existingThread } = await supabase
        .from('email_threads')
        .select('ticket_id')
        .eq('message_id', payload.in_reply_to)
        .single();

      if (existingThread) {
        ticketId = existingThread.ticket_id;
      }
    }

    // Create new ticket if not a reply
    if (!ticketId) {
      // Parse category from subject or default to 'question'
      let category = 'question';
      const subjectLower = payload.subject.toLowerCase();
      if (subjectLower.includes('bug') || subjectLower.includes('error')) {
        category = 'bug';
      } else if (subjectLower.includes('feature') || subjectLower.includes('request')) {
        category = 'feature_request';
      } else if (subjectLower.includes('billing') || subjectLower.includes('payment')) {
        category = 'billing';
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          subject: payload.subject,
          message: payload.body_text || payload.body_html || '',
          user_email: payload.from,
          user_name: payload.from.split('@')[0],
          category,
          status: 'open',
          priority: 2,
          mailbox_id: targetMailbox.id,
          email_message_id: payload.message_id,
          email_in_reply_to: payload.in_reply_to,
        })
        .select()
        .single();

      if (ticketError) {
        console.error('Error creating ticket:', ticketError);
        throw ticketError;
      }

      ticketId = ticket.id;
      console.log('Created new ticket:', ticketId);
    } else {
      // Update ticket with new activity
      await supabase
        .from('support_tickets')
        .update({ 
          last_activity_at: new Date().toISOString(),
          status: 'waiting_for_agent'
        })
        .eq('id', ticketId);
    }

    // Create email thread entry
    const { error: threadError } = await supabase
      .from('email_threads')
      .insert({
        ticket_id: ticketId,
        mailbox_id: targetMailbox.id,
        from_email: payload.from,
        to_email: payload.to,
        cc_emails: payload.cc || [],
        subject: payload.subject,
        message_id: payload.message_id,
        in_reply_to: payload.in_reply_to,
        email_references: payload.references || [],
        body_text: payload.body_text,
        body_html: payload.body_html,
        attachments: payload.attachments || [],
        direction: 'inbound',
        is_read: false,
        received_at: new Date().toISOString(),
      });

    if (threadError) {
      console.error('Error creating email thread:', threadError);
      throw threadError;
    }

    // Update webhook last received timestamp
    await supabase
      .from('email_webhook_settings')
      .update({ last_received_at: new Date().toISOString() })
      .eq('id', settings.id);

    console.log('Successfully processed email webhook');

    return new Response(
      JSON.stringify({ success: true, ticket_id: ticketId }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error processing email webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});