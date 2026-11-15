import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors, corsJsonResponse } from '../_shared/cors.ts';
import { verifyWebhookSignature } from '../_shared/webhook-security.ts';
import { invokeFunctionAndForget } from '../_shared/invoke-function.ts';
import { createEdgeFunctionLogger } from '../_shared/production-logger.ts';

const baseLogger = createEdgeFunctionLogger('email-webhook-receiver');
const UNIQUE_VIOLATION = '23505';

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

/**
 * Find an inbound message that was already processed, by its Message-ID, so a
 * retried webhook doesn't open a second ticket.
 */
async function findProcessed(supabase: any, messageId: string): Promise<string | null> {
  const { data: thread } = await supabase
    .from('email_threads')
    .select('ticket_id')
    .eq('message_id', messageId)
    .eq('direction', 'inbound')
    .limit(1)
    .maybeSingle();
  if (thread) return thread.ticket_id;

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id')
    .eq('email_message_id', messageId)
    .limit(1)
    .maybeSingle();
  return ticket ? ticket.id : null;
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const log = baseLogger.forRequest(req);

  const duplicateResponse = (ticketId: string) => {
    log.info('Duplicate inbound email ignored', { ticket_id: ticketId });
    return new Response(JSON.stringify({ success: true, duplicate: true, ticket_id: ticketId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  };

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
      log.error('No active webhook settings found');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the raw request body for signature verification
    const rawBody = await req.text();

    // An empty secret would make every HMAC trivially forgeable.
    const webhookSecret =
      typeof settings.webhook_secret === 'string' ? settings.webhook_secret : '';
    if (!webhookSecret.trim()) {
      log.error('Webhook secret is not configured');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // HMAC over "<timestamp>.<body>" is the only accepted scheme. The static
    // x-webhook-secret header and untimestamped signatures were dropped: both
    // could be replayed indefinitely once captured.
    const signature = req.headers.get('x-webhook-signature');
    const timestamp = req.headers.get('x-webhook-timestamp');

    const signatureResult = await verifyWebhookSignature(
      rawBody,
      signature,
      webhookSecret,
      timestamp,
      300,
      { requireTimestamp: true }
    );

    if (!signatureResult.valid) {
      log.warn('Webhook signature verification failed', { reason: signatureResult.error });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the payload
    let payload: EmailWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      log.warn('Failed to parse webhook payload');
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Validate email format for the 'from' field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const senderEmail = payload.from?.trim();
    if (!senderEmail || !emailRegex.test(senderEmail) || senderEmail.length > 254) {
      log.warn('Invalid sender email format');
      return new Response(JSON.stringify({ error: 'Invalid sender email format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate 'to' email
    const recipientEmail = payload.to?.trim();
    if (!recipientEmail || !emailRegex.test(recipientEmail) || recipientEmail.length > 254) {
      log.warn('Invalid recipient email format');
      return new Response(JSON.stringify({ error: 'Invalid recipient email format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate subject length to prevent abuse
    if (payload.subject && payload.subject.length > 998) {
      payload.subject = payload.subject.substring(0, 998);
    }

    // Message-ID is the dedupe key; an empty one can't dedupe anything.
    const messageId =
      typeof payload.message_id === 'string' && payload.message_id.trim()
        ? payload.message_id.trim()
        : null;
    if (messageId) {
      const existingTicketId = await findProcessed(supabase, messageId);
      if (existingTicketId) return duplicateResponse(existingTicketId);
    }

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
        log.warn('No mailbox configured for recipient', {
          domain: recipientEmail.split('@')[1],
        });
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
        .limit(1)
        .maybeSingle();

      if (existingThread) {
        ticketId = existingThread.ticket_id;
      }
    }

    const isReply = Boolean(ticketId);
    let ticketNumber: string | null = null;

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
          user_email: senderEmail,
          user_name: senderEmail.split('@')[0],
          category,
          status: 'open',
          priority: 2,
          mailbox_id: targetMailbox.id,
          email_message_id: messageId,
          email_in_reply_to: payload.in_reply_to,
        })
        .select()
        .single();

      if (ticketError) {
        // A concurrent retry of the same message won the insert.
        if (ticketError.code === UNIQUE_VIOLATION && messageId) {
          const existingTicketId = await findProcessed(supabase, messageId);
          if (existingTicketId) return duplicateResponse(existingTicketId);
        }
        log.error('Error creating ticket', ticketError);
        throw ticketError;
      }

      ticketId = ticket.id;
      ticketNumber = ticket.ticket_number;
    }

    // Create the email thread entry. For a reply this is the dedupe claim (the
    // unique index on inbound message_id), so it goes before any other write.
    const { error: threadError } = await supabase.from('email_threads').insert({
      ticket_id: ticketId,
      mailbox_id: targetMailbox.id,
      from_email: senderEmail,
      to_email: recipientEmail,
      cc_emails: payload.cc || [],
      subject: payload.subject,
      message_id: messageId,
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
      if (threadError.code === UNIQUE_VIOLATION && messageId) {
        const existingTicketId = await findProcessed(supabase, messageId);
        if (existingTicketId) return duplicateResponse(existingTicketId);
      }
      log.error('Error creating email thread', threadError, { ticket_id: ticketId });
      throw threadError;
    }

    if (isReply) {
      // Update ticket with new activity
      const { error: activityError } = await supabase
        .from('support_tickets')
        .update({
          last_activity_at: new Date().toISOString(),
          status: 'waiting_for_agent',
        })
        .eq('id', ticketId);
      if (activityError) {
        log.error('Error updating ticket activity', activityError, { ticket_id: ticketId });
      }
    }

    // Notify. Fire-and-forget: the webhook answers without waiting on SMTP, so
    // the sender has no reason to retry.
    try {
      let ticketSubject = payload.subject;
      if (isReply) {
        const { data: ticket } = await supabase
          .from('support_tickets')
          .select('ticket_number, subject')
          .eq('id', ticketId)
          .single();
        ticketNumber = ticket?.ticket_number ?? null;
        ticketSubject = ticket?.subject ?? ticketSubject;
      }

      if (ticketNumber) {
        invokeFunctionAndForget('send-notification-email', {
          type: isReply ? 'new_response' : 'new_ticket',
          ticket_number: ticketNumber,
          ticket_id: ticketId,
          ticket_subject: ticketSubject,
          from_email: senderEmail,
          from_name: senderEmail.split('@')[0],
          message_preview: payload.body_text || payload.body_html || '',
        });
      }
    } catch (notifError) {
      // Don't fail the whole request if notification fails
      log.error('Failed to queue notification', notifError);
    }

    // Update webhook last received timestamp
    await supabase
      .from('email_webhook_settings')
      .update({ last_received_at: new Date().toISOString() })
      .eq('id', settings.id);

    log.info('Inbound email processed', {
      ticket_id: ticketId,
      mailbox_id: targetMailbox.id,
      is_reply: isReply,
      has_message_id: Boolean(messageId),
    });

    return new Response(JSON.stringify({ success: true, ticket_id: ticketId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    log.error('Error processing email webhook', error);
    return new Response(JSON.stringify({ error: 'Failed to process email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
