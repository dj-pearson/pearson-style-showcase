import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { normalizedErrorResponse, classifyError } from '../_shared/error-normalizer.ts';
import { verifyWebhookSignature, verifySecret } from '../_shared/webhook-security.ts';
import { invokeFunctionAndForget } from '../_shared/invoke-function.ts';
import { createEdgeFunctionLogger } from '../_shared/production-logger.ts';

const baseLogger = createEdgeFunctionLogger('receive-email');

interface MakeComEmailPayload {
  to: string; // Email address message was sent to
  from: string; // Sender name
  from_email: string; // Sender email address
  subject: string; // Email subject
  date: string; // Timestamp (e.g., "Tue, 18 Nov 2025 21:27:33 -0600")
  body: string; // Full email body
  id: string; // Unique email ID
  in_reply_to?: string; // In-Reply-To header (for threading)
  references?: string; // References header (for threading)
}

// RFC 5322 Message-ID, with or without angle brackets. Rejects whitespace,
// commas, parentheses, quotes and backslashes so a value can never carry
// PostgREST filter syntax.
const MESSAGE_ID_RE = /^<?[^\s<>,()"\\]+@[^\s<>,()"\\]+>?$/;
const MAX_THREAD_IDS = 50;

/**
 * Parse In-Reply-To and References into a de-duplicated list of valid
 * Message-IDs. Each id is included both with and without angle brackets,
 * since stored message_id values may use either form.
 */
function collectMessageIds(inReplyTo?: string, references?: string): string[] {
  const raw = `${inReplyTo ?? ''} ${references ?? ''}`
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && token.length <= 998 && MESSAGE_ID_RE.test(token));

  const ids = new Set<string>();
  for (const token of raw) {
    const bare = token.replace(/^</, '').replace(/>$/, '');
    ids.add(bare);
    ids.add(`<${bare}>`);
    if (ids.size >= MAX_THREAD_IDS) break;
  }
  return Array.from(ids);
}

const UNIQUE_VIOLATION = '23505';

/**
 * Find an inbound message that was already processed, by its Message-ID.
 * Make.com retries a webhook it thinks timed out, and before this check every
 * retry became a second ticket or a second reply.
 */
async function findProcessed(
  supabase: any,
  messageId: string
): Promise<{ ticketId: string; mailboxId: string | null } | null> {
  const { data: thread } = await supabase
    .from('email_threads')
    .select('ticket_id, mailbox_id')
    .eq('message_id', messageId)
    .eq('direction', 'inbound')
    .limit(1)
    .maybeSingle();
  if (thread) return { ticketId: thread.ticket_id, mailboxId: thread.mailbox_id };

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, mailbox_id')
    .eq('email_message_id', messageId)
    .limit(1)
    .maybeSingle();
  if (ticket) return { ticketId: ticket.id, mailboxId: ticket.mailbox_id };

  return null;
}

/** Escape LIKE/ILIKE wildcards so user text matches literally. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const log = baseLogger.forRequest(req);

  const duplicateResponse = (found: { ticketId: string; mailboxId: string | null }) => {
    log.info('Duplicate inbound email ignored', { ticket_id: found.ticketId });
    return new Response(
      JSON.stringify({
        success: true,
        duplicate: true,
        ticket_id: found.ticketId,
        mailbox_id: found.mailboxId,
        message: 'Email already processed',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  };

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Webhook auth is mandatory. Fail closed when the secret is not configured
    // so a missing env var can't silently open the endpoint.
    const webhookSecret = Deno.env.get('MAKE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      log.error('MAKE_WEBHOOK_SECRET is not set; rejecting request');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('authorization');
    const providedSecret =
      req.headers.get('x-webhook-secret') ||
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    // HMAC signature is preferred; it requires x-webhook-timestamp for replay protection
    const signature = req.headers.get('x-webhook-signature');
    if (signature) {
      // Clone request to read body for signature verification
      const rawBody = await req.clone().text();
      const timestamp = req.headers.get('x-webhook-timestamp');
      const result = await verifyWebhookSignature(rawBody, signature, webhookSecret, timestamp);
      if (!result.valid) {
        log.warn('Webhook signature verification failed', { reason: result.error });
        return new Response(JSON.stringify({ error: 'Unauthorized', message: result.error }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (providedSecret) {
      // Fallback to shared-secret verification
      if (!verifySecret(providedSecret, webhookSecret)) {
        log.warn('Invalid webhook secret');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      log.warn('Rejected request with no webhook credentials');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = req.headers.get('content-type') || '';

    let payload: MakeComEmailPayload;

    // Handle multipart/form-data (e.g. from Make.com sending form-data)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();

      const getField = (name: string): string => {
        const candidates = [name, name.toLowerCase(), name.toUpperCase()];

        for (const key of candidates) {
          const value = formData.get(key);
          if (typeof value === 'string') return value.trim();
        }
        return '';
      };

      const extractEmail = (value: string): string => {
        if (!value) return '';
        const trimmed = value.trim();
        // First try to extract email from angle brackets: "Name <email@domain.com>"
        const match = trimmed.match(/<([^>]+)>/);
        if (match && match[1]) return match[1].trim();
        // Check if the value itself is an email (contains @ and .)
        if (trimmed.includes('@') && trimmed.includes('.')) {
          return trimmed;
        }
        // If no email found, return empty string
        return '';
      };

      const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      const to = getField('to') || getField('To');

      // Get the email address from "From Email" field (not "From" which is just the name)
      const fromEmailRaw =
        getField('From Email') ||
        getField('from_email') ||
        getField('From_email') ||
        getField('fromEmail') ||
        getField('FromEmail');
      const fromEmail = extractEmail(fromEmailRaw);

      // Get the sender's name from "From" field
      const fromName = getField('from') || getField('From') || fromEmail.split('@')[0];

      const bodyRaw =
        getField('body') ||
        getField('Body') ||
        getField('text') ||
        getField('Text') ||
        getField('textbody') ||
        getField('TextBody') ||
        getField('html') ||
        getField('Html') ||
        getField('htmlbody') ||
        getField('HtmlBody');

      payload = {
        to,
        from: fromName,
        from_email: fromEmail,
        subject: getField('subject') || getField('Subject'),
        date: getField('date') || getField('Date'),
        body: bodyRaw,
        id: getField('id') || getField('Id') || getField('ID'),
        in_reply_to: getField('in_reply_to') || getField('In-Reply-To') || getField('inReplyTo'),
        references: getField('references') || getField('References'),
      };
    } else {
      const rawBody = await req.text();

      // Handle different content types from Make.com
      if (contentType.includes('application/x-www-form-urlencoded')) {
        // Parse URL-encoded data
        const params = new URLSearchParams(rawBody);
        payload = {
          to: params.get('to') || '',
          from: params.get('from') || '',
          from_email: params.get('from_email') || '',
          subject: params.get('subject') || '',
          date: params.get('date') || '',
          body: params.get('body') || '',
          id: params.get('id') || '',
        };
      } else {
        // Try to parse as JSON
        try {
          payload = JSON.parse(rawBody);
        } catch (parseError) {
          log.warn('Failed to parse payload', { content_type: contentType });
          return new Response(
            JSON.stringify({
              error:
                'Invalid payload format. Expected JSON, form-encoded data, or multipart form-data.',
              details: (parseError as Error).message,
              contentType: contentType,
              bodyPreview: rawBody.substring(0, 100),
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
    }
    // Validate and trim email fields
    payload.to = payload.to?.trim() || '';
    payload.from_email = payload.from_email?.trim() || '';

    // Validate required fields
    if (!payload.to || !payload.from_email || !payload.subject || !payload.body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, from_email, subject, body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate email format for from_email
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    if (!isValidEmail(payload.from_email) || payload.from_email.length > 254) {
      log.warn('Invalid from_email format');
      return new Response(
        JSON.stringify({
          error: 'Invalid from_email format. Must be a valid email address.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!isValidEmail(payload.to) || payload.to.length > 254) {
      log.warn('Invalid to email format');
      return new Response(JSON.stringify({ error: 'Invalid recipient email format.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate subject length to prevent abuse
    if (payload.subject && payload.subject.length > 998) {
      payload.subject = payload.subject.substring(0, 998);
    }

    // Message-ID (Make.com's id field) is the dedupe key. An empty value can't
    // dedupe anything and would collide in the unique index, so store NULL.
    const messageId =
      typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : null;
    if (messageId) {
      const found = await findProcessed(supabase, messageId);
      if (found) return duplicateResponse(found);
    }

    // Extract domain from "to" email for grouping
    const toDomain = payload.to.split('@')[1] || payload.to;

    // Check if mailbox exists for this "to" address
    let { data: mailbox, error: mailboxError } = await supabase
      .from('email_mailboxes')
      .select('*')
      .eq('email_address', payload.to)
      .single();

    // If mailbox doesn't exist, create it
    if (!mailbox) {
      log.info('Creating mailbox for unseen recipient domain', { domain: toDomain });

      const { data: newMailbox, error: createError } = await supabase
        .from('email_mailboxes')
        .insert({
          name: `${toDomain} Inbox`,
          email_address: payload.to,
          description: `Auto-created for ${payload.to}`,
          smtp_host: '', // Empty - needs configuration
          smtp_port: 587,
          smtp_username: '',
          smtp_password: '',
          smtp_use_tls: true,
          is_active: true,
          is_default: false,
          signature: null,
        })
        .select()
        .single();

      if (createError) {
        log.error('Failed to create mailbox', createError);
        throw createError;
      }

      mailbox = newMailbox;
    }

    // Check if this is a reply to an existing ticket
    let ticketId: string | null = null;
    let isReply = false;

    // First, try to find ticket by In-Reply-To or References headers.
    // Only well-formed Message-IDs are used, and they go through .in() so a
    // crafted header can't inject PostgREST filter syntax.
    const threadMessageIds = collectMessageIds(payload.in_reply_to, payload.references);
    if (threadMessageIds.length > 0) {
      const { data: threadTicket } = await supabase
        .from('email_threads')
        .select('ticket_id')
        .in('message_id', threadMessageIds)
        .eq('mailbox_id', mailbox.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (threadTicket) {
        ticketId = threadTicket.ticket_id;
        isReply = true;
      }
    }

    // If not found via headers, try to find an existing ticket from the same
    // sender (user_email) in the same mailbox with a matching subject
    const cleanSubject = payload.subject.replace(/^(Re:|Fwd:)\s*/i, '').trim();
    if (!ticketId && cleanSubject) {
      const { data: existingTicket } = await supabase
        .from('support_tickets')
        .select('id, ticket_number')
        .eq('user_email', payload.from_email)
        .ilike('subject', `%${escapeLikePattern(cleanSubject)}%`)
        .eq('mailbox_id', mailbox.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingTicket) {
        ticketId = existingTicket.id;
        isReply = true;
      }
    }

    // Parse date
    let parsedDate: string;
    try {
      parsedDate = new Date(payload.date).toISOString();
    } catch (e) {
      parsedDate = new Date().toISOString();
    }

    // Create new ticket if not a reply
    if (!ticketId) {
      // Auto-categorize based on subject keywords
      let category = 'question';
      const subjectLower = payload.subject.toLowerCase();
      if (
        subjectLower.includes('bug') ||
        subjectLower.includes('error') ||
        subjectLower.includes('issue')
      ) {
        category = 'bug';
      } else if (
        subjectLower.includes('feature') ||
        subjectLower.includes('request') ||
        subjectLower.includes('add')
      ) {
        category = 'feature_request';
      } else if (
        subjectLower.includes('billing') ||
        subjectLower.includes('payment') ||
        subjectLower.includes('invoice')
      ) {
        category = 'billing';
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          subject: payload.subject,
          message: payload.body,
          user_email: payload.from_email,
          user_name: payload.from || payload.from_email.split('@')[0],
          category,
          status: 'open',
          priority: 2, // Normal priority
          mailbox_id: mailbox.id,
          email_message_id: messageId,
          created_at: parsedDate,
          last_activity_at: parsedDate,
        })
        .select()
        .single();

      if (ticketError) {
        // A concurrent retry of the same message won the insert.
        if (ticketError.code === UNIQUE_VIOLATION && messageId) {
          const found = await findProcessed(supabase, messageId);
          if (found) return duplicateResponse(found);
        }
        log.error('Error creating ticket', ticketError);
        throw ticketError;
      }

      ticketId = ticket.id;
    }

    // Create the email thread entry. For a reply this insert goes first: the
    // unique index on inbound message_id makes it the dedupe claim, so a
    // concurrent retry stops here before writing a second ticket response.
    const { error: threadError } = await supabase.from('email_threads').insert({
      ticket_id: ticketId,
      mailbox_id: mailbox.id,
      from_email: payload.from_email,
      to_email: payload.to,
      subject: payload.subject,
      message_id: messageId,
      body_text: payload.body,
      body_html: payload.body, // Assuming body might contain HTML
      direction: 'inbound',
      is_read: false,
      received_at: parsedDate,
    });

    if (threadError) {
      if (threadError.code === UNIQUE_VIOLATION && isReply && messageId) {
        const found = await findProcessed(supabase, messageId);
        if (found) return duplicateResponse(found);
      }
      // Don't fail the whole request if thread creation fails
      log.error('Error creating email thread', threadError, { ticket_id: ticketId });
    }

    if (isReply) {
      // Update existing ticket with new activity
      const { error: activityError } = await supabase
        .from('support_tickets')
        .update({
          last_activity_at: parsedDate,
          status: 'waiting_for_agent',
        })
        .eq('id', ticketId);
      if (activityError) {
        log.error('Error updating ticket activity', activityError, { ticket_id: ticketId });
      }

      // Add as a response to the existing ticket
      const { error: responseError } = await supabase.from('ticket_responses').insert({
        ticket_id: ticketId,
        author_email: payload.from_email,
        author_name: payload.from || payload.from_email.split('@')[0],
        author_type: 'user',
        message: payload.body,
        is_internal: false,
        created_at: parsedDate,
      });
      if (responseError) {
        log.error('Error adding ticket response', responseError, { ticket_id: ticketId });
      }
    }

    log.info('Inbound email processed', {
      ticket_id: ticketId,
      mailbox_id: mailbox.id,
      is_reply: isReply,
      has_message_id: Boolean(messageId),
    });

    // Send notification email. Fire-and-forget: the webhook answers without
    // waiting on SMTP, so Make.com has no reason to retry.
    try {
      const { data: ticketData } = await supabase
        .from('support_tickets')
        .select('ticket_number, subject')
        .eq('id', ticketId)
        .single();

      if (ticketData) {
        invokeFunctionAndForget('send-notification-email', {
          type: isReply ? 'new_response' : 'new_ticket',
          ticket_number: ticketData.ticket_number,
          ticket_id: ticketId,
          ticket_subject: ticketData.subject,
          from_email: payload.from_email,
          from_name: payload.from,
          message_preview: payload.body,
        });
      }
    } catch (notifyError) {
      // Don't fail the request if notification fails
      log.error('Failed to queue notification', notifyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: ticketId,
        mailbox_id: mailbox.id,
        is_reply: isReply,
        message: 'Email received and processed successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    log.error('receive-email failed', error);
    return normalizedErrorResponse(classifyError(error), error, corsHeaders);
  }
};
