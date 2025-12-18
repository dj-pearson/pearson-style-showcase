import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { getCorsHeaders, handleCors, corsJsonResponse } from "../_shared/cors.ts";
import { verifyWebhookSignature, verifySecret } from "../_shared/webhook-security.ts";

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
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get webhook settings for secret verification
    const { data: settings } = await supabase
      .from('email_webhook_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!settings) {
      console.error('No active webhook settings found');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the raw request body for signature verification
    const rawBody = await req.text();

    // Check for HMAC signature first (preferred method)
    const signature = req.headers.get('x-webhook-signature');
    const timestamp = req.headers.get('x-webhook-timestamp');

    if (signature) {
      // Verify HMAC signature
      const signatureResult = await verifyWebhookSignature(
        rawBody,
        signature,
        settings.webhook_secret,
        timestamp
      );

      if (!signatureResult.valid) {
        console.error('Webhook signature verification failed:', signatureResult.error);
        return new Response(JSON.stringify({ error: 'Unauthorized', message: signatureResult.error }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Webhook signature verified successfully');
    } else {
      // Fallback to simple secret header check (legacy support)
      const webhookSecret = req.headers.get('x-webhook-secret');
      if (!verifySecret(webhookSecret, settings.webhook_secret)) {
        console.error('Invalid webhook secret');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.warn('Using legacy webhook secret verification - consider upgrading to HMAC signature');
    }

    // Parse the payload
    let payload: EmailWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error('Failed to parse webhook payload');
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Received email webhook:', { from: payload.from, to: payload.to, subject: payload.subject });

    // Find the appropriate mailbox based on the 'to' address
    const { data: mailbox } = await supabase
      .from('email_mailboxes')
      .select('*')
      .eq('email_address', payload.to)
      .eq('is_active', true)
      .single();

    let targetMailbox = mailbox;

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
      targetMailbox = defaultMailbox;
    }

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
      
      // Send notification for new ticket
      try {
        await supabase.functions.invoke('send-notification-email', {
          body: {
            type: 'new_ticket',
            ticket_number: ticket.ticket_number,
            ticket_id: ticket.id,
            ticket_subject: payload.subject,
            from_email: payload.from,
            from_name: payload.from.split('@')[0],
            message_preview: payload.body_text || payload.body_html || ''
          }
        });
        console.log('Sent new ticket notification');
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
        // Don't fail the whole request if notification fails
      }
    } else {
      // Update ticket with new activity
      await supabase
        .from('support_tickets')
        .update({ 
          last_activity_at: new Date().toISOString(),
          status: 'waiting_for_agent'
        })
        .eq('id', ticketId);
      
      // Send notification for new response
      try {
        const { data: ticket } = await supabase
          .from('support_tickets')
          .select('ticket_number, subject')
          .eq('id', ticketId)
          .single();
        
        if (ticket) {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              type: 'new_response',
              ticket_number: ticket.ticket_number,
              ticket_id: ticketId,
              ticket_subject: ticket.subject,
              from_email: payload.from,
              from_name: payload.from.split('@')[0],
              message_preview: payload.body_text || payload.body_html || ''
            }
          });
          console.log('Sent new response notification');
        }
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
        // Don't fail the whole request if notification fails
      }
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
      };

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
};