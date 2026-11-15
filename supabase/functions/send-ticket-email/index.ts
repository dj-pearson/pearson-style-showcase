import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { normalizedErrorResponse, classifyError } from '../_shared/error-normalizer.ts';
import { invokeFunctionAndForget } from '../_shared/invoke-function.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import { createEdgeFunctionLogger, type EdgeFunctionLogger } from '../_shared/production-logger.ts';

const baseLogger = createEdgeFunctionLogger('send-ticket-email');

const SMTP_TIMEOUT_MS = Number(Deno.env.get('SMTP_TIMEOUT_MS')) || 30_000;
const SMTP_CLOSE_TIMEOUT_MS = 5_000;
const UNIQUE_VIOLATION = '23505';
// Client-generated (crypto.randomUUID() in TicketDetailView); kept strict so it
// can't carry PostgREST filter syntax.
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_.:-]{8,200}$/;

/** SMTP didn't answer in time; the message may or may not have gone out. */
class SmtpTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SmtpTimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

interface SendEmailRequest {
  ticket_id: string;
  from_mailbox_id: string;
  to_email: string;
  subject: string;
  message: string;
  is_internal?: boolean;
  in_reply_to?: string;
  cc_emails?: string[];
  /** Same key on a retry returns the first result instead of sending again. */
  idempotency_key?: string;
}

// Send email via SMTP (supports Amazon SES, Gmail, etc.)
async function sendEmailViaSMTP(
  log: EdgeFunctionLogger,
  mailboxConfig: any,
  messageId: string,
  toEmail: string,
  subject: string,
  bodyText: string,
  bodyHtml: string,
  ccEmails?: string[],
  inReplyTo?: string
): Promise<void> {
  // Use environment variables as defaults, but allow mailbox config to override
  let smtpPort = mailboxConfig.smtp_port || 587;
  const smtpHost = mailboxConfig.smtp_host || Deno.env.get('AMAZON_SMTP_ENDPOINT');
  const smtpUsername = mailboxConfig.smtp_username || Deno.env.get('AMAZON_SMTP_USER_NAME');
  const smtpPassword = mailboxConfig.smtp_password || Deno.env.get('AMAZON_SMTP_PASSWORD');
  const smtpUseTls = mailboxConfig.smtp_use_tls !== undefined ? mailboxConfig.smtp_use_tls : true;

  // Work around Deno TLS bug on port 587 with some SMTP providers by switching to 465 when using TLS
  if (smtpUseTls && smtpPort === 587) {
    smtpPort = 465;
  }

  if (!smtpHost || !smtpUsername || !smtpPassword) {
    throw new Error(
      'SMTP configuration missing. Please configure mailbox or set environment variables.'
    );
  }

  const client = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: smtpPort,
      tls: smtpUseTls,
      auth: {
        username: smtpUsername,
        password: smtpPassword,
      },
    },
  });

  // Build email content with signature if provided
  let finalBodyText = bodyText;
  let finalBodyHtml = bodyHtml;

  if (mailboxConfig.signature) {
    finalBodyText += `\n\n--\n${mailboxConfig.signature}`;
    finalBodyHtml += `<br><br><div style="color: #666; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px;">${mailboxConfig.signature.replace(/\n/g, '<br>')}</div>`;
  }

  const emailConfig: any = {
    from: mailboxConfig.display_name
      ? `${mailboxConfig.display_name} <${mailboxConfig.email_address}>`
      : mailboxConfig.email_address,
    to: toEmail,
    subject: subject,
    content: finalBodyText,
    html: finalBodyHtml,
    headers: {
      'Message-ID': messageId,
    },
  };

  if (ccEmails && ccEmails.length > 0) {
    emailConfig.cc = ccEmails.join(', ');
  }

  if (inReplyTo) {
    emailConfig.headers['In-Reply-To'] = inReplyTo;
    emailConfig.headers['References'] = inReplyTo;
  }

  // A hung SMTP server used to hold the request (and the connection) open
  // until the platform killed it. Bound the send, and always try to close.
  try {
    await withTimeout(client.send(emailConfig), SMTP_TIMEOUT_MS, 'SMTP send');
  } finally {
    try {
      await withTimeout(client.close(), SMTP_CLOSE_TIMEOUT_MS, 'SMTP close');
    } catch (closeError) {
      log.warn('SMTP close failed', { error: String(closeError) });
    }
  }
}

// Helper function to convert plain text to HTML
function textToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/  /g, '&nbsp;&nbsp;');
}

// Allowed HTML tags for email content sanitization
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'code',
  'div',
  'span',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'hr',
  'img',
]);

// Allowed attributes per tag
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
  div: new Set(['style']),
  span: new Set(['style']),
  p: new Set(['style']),
};

// Dangerous protocols to block in href/src attributes
const DANGEROUS_PROTOCOL_RE = /^\s*(javascript|vbscript|data):/i;

/**
 * Sanitize HTML content by removing dangerous tags and attributes.
 * This is a basic sanitizer suitable for email content.
 */
function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove event handler attributes (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Remove dangerous tags (iframe, object, embed, form, input, etc.)
  const dangerousTags = [
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'textarea',
    'select',
    'button',
    'applet',
    'base',
    'link',
    'meta',
  ];
  for (const tag of dangerousTags) {
    // Remove self-closing and opening/closing variants
    const openClose = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
    const selfClose = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    sanitized = sanitized.replace(openClose, '');
    sanitized = sanitized.replace(selfClose, '');
  }

  // Sanitize href and src attributes to block javascript: and data: protocols
  sanitized = sanitized.replace(/(href|src)\s*=\s*"([^"]*)"/gi, (match, attr, value) => {
    if (DANGEROUS_PROTOCOL_RE.test(value)) {
      return `${attr}="#"`;
    }
    return match;
  });
  sanitized = sanitized.replace(/(href|src)\s*=\s*'([^']*)'/gi, (match, attr, value) => {
    if (DANGEROUS_PROTOCOL_RE.test(value)) {
      return `${attr}='#'`;
    }
    return match;
  });

  return sanitized;
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const log = baseLogger.forRequest(req);
  const json = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Shared admin gate: valid JWT, admin role, and an aal2 (MFA-verified)
    // token. Previously any signed-in user could send mail from any mailbox.
    const auth = await requireAdmin(req, corsHeaders);
    if (!auth.ok) return auth.response!;
    const user = { id: auth.userId!, email: auth.email };
    const ulog = log.withUser(user.id);

    const requestData: SendEmailRequest = await req.json();
    const {
      ticket_id,
      from_mailbox_id,
      to_email,
      subject,
      message,
      is_internal = false,
      in_reply_to,
      cc_emails,
    } = requestData;

    // Validate required fields
    if (!ticket_id || !from_mailbox_id || !to_email || !subject || !message) {
      return json(400, { error: 'Missing required fields' });
    }

    const suppliedKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      requestData.idempotency_key ||
      null;
    if (suppliedKey !== null && !IDEMPOTENCY_KEY_RE.test(suppliedKey)) {
      return json(400, { error: 'Invalid idempotency key' });
    }
    const idempotencyKey: string | null = suppliedKey;

    // Get mailbox details
    const { data: mailbox, error: mailboxError } = await supabase
      .from('email_mailboxes')
      .select('*')
      .eq('id', from_mailbox_id)
      .eq('is_active', true)
      .single();

    if (mailboxError || !mailbox) {
      return json(400, { error: 'Invalid or inactive mailbox' });
    }

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      return json(404, { error: 'Ticket not found' });
    }

    /** Answer a request whose key already has an outbound row. */
    const replayResponse = (existing: {
      ticket_id: string;
      message_id: string;
      send_status: string | null;
    }) => {
      if (existing.ticket_id !== ticket_id) {
        return json(409, { error: 'Idempotency key was already used for a different ticket' });
      }
      if (existing.send_status === 'sent') {
        ulog.info('Duplicate send request answered from the first result', { ticket_id });
        return json(200, {
          success: true,
          duplicate: true,
          message_id: existing.message_id,
          ticket_id,
        });
      }
      return json(409, {
        error:
          'A send with this key is still in progress, or SMTP timed out and the outcome is unknown. Check the ticket thread before sending again.',
        message_id: existing.message_id,
      });
    };

    const findByKey = async () => {
      if (!idempotencyKey) return null;
      const { data, error } = await supabase
        .from('email_threads')
        .select('id, ticket_id, message_id, send_status')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (error) throw error;
      return data;
    };

    const already = await findByKey();
    if (already) return replayResponse(already);

    // Convert message to HTML if needed, with sanitization
    const bodyHtml = message.includes('<') ? sanitizeHtml(message) : textToHtml(message);
    const messageId = `<${crypto.randomUUID()}@${mailbox.email_address.split('@')[1]}>`;
    const threadReplyTo = in_reply_to || ticket.email_message_id;

    // Write the outbound row as 'pending' before talking to SMTP. With a key,
    // the unique index makes this the claim: a concurrent retry fails here
    // instead of sending a second copy.
    const { data: pendingRow, error: pendingError } = await supabase
      .from('email_threads')
      .insert({
        ticket_id: ticket_id,
        mailbox_id: from_mailbox_id,
        from_email: mailbox.email_address,
        to_email: to_email,
        cc_emails: cc_emails || [],
        subject: subject,
        message_id: messageId,
        in_reply_to: threadReplyTo,
        email_references: ticket.email_message_id ? [ticket.email_message_id] : [],
        body_text: message,
        body_html: bodyHtml,
        direction: 'outbound',
        is_read: true,
        send_status: 'pending',
        idempotency_key: idempotencyKey,
      })
      .select('id')
      .single();

    if (pendingError) {
      if (pendingError.code === UNIQUE_VIOLATION && idempotencyKey) {
        const winner = await findByKey();
        if (winner) return replayResponse(winner);
      }
      throw pendingError;
    }

    try {
      await sendEmailViaSMTP(
        ulog,
        mailbox,
        messageId,
        to_email,
        subject,
        message,
        bodyHtml,
        cc_emails,
        threadReplyTo
      );
    } catch (sendError) {
      if (sendError instanceof SmtpTimeoutError) {
        // Unknown outcome: the server may have accepted the message after we
        // stopped waiting. Keep the row 'pending' so a retry with the same key
        // gets a 409 instead of mailing the customer twice.
        ulog.error('SMTP timed out; outcome unknown', sendError, { ticket_id });
        return json(504, {
          error:
            'The mail server did not answer in time. The email may or may not have been sent; check the ticket thread before sending again.',
          message_id: messageId,
          ticket_id,
        });
      }
      // Definite failure: nothing went out, so drop the pending row and let
      // the caller retry with the same key.
      const { error: cleanupError } = await supabase
        .from('email_threads')
        .delete()
        .eq('id', pendingRow.id);
      if (cleanupError) {
        ulog.error('Could not remove pending row after failed send', cleanupError, {
          ticket_id,
        });
      }
      ulog.error('SMTP send failed', sendError, { ticket_id });
      throw sendError;
    }

    // The email is out. Every write below is bookkeeping; a failure must not
    // be reported as a clean success, but it must not be a 5xx either, or the
    // caller would retry and send again.
    const failedWrites: string[] = [];
    const now = new Date().toISOString();

    const { error: markError } = await supabase
      .from('email_threads')
      .update({ send_status: 'sent', sent_at: now })
      .eq('id', pendingRow.id);
    if (markError) {
      failedWrites.push('email_threads');
      ulog.error('Error marking email thread sent', markError, { ticket_id });
    }

    // Create ticket response
    const { error: responseError } = await supabase.from('ticket_responses').insert({
      ticket_id: ticket_id,
      author_id: user.id,
      author_email: user.email,
      author_name: user.email?.split('@')[0] || 'Support',
      author_type: 'agent',
      message: message,
      is_internal: is_internal,
      is_ai_generated: false,
    });
    if (responseError) {
      failedWrites.push('ticket_responses');
      ulog.error('Error creating ticket response', responseError, { ticket_id });
    }

    // Update ticket status and timestamps
    const updateData: any = {
      last_activity_at: now,
      status: 'waiting_for_user',
    };

    // Set first_response_at if this is the first response
    if (!ticket.first_response_at) {
      updateData.first_response_at = now;
    }

    const { error: updateError } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticket_id);
    if (updateError) {
      failedWrites.push('support_tickets');
      ulog.error('Error updating ticket', updateError, { ticket_id });
    }

    // Log activity
    const { error: activityError } = await supabase.from('ticket_activity_log').insert({
      ticket_id: ticket_id,
      actor_id: user.id,
      actor_email: user.email,
      action: 'email_sent',
      new_value: to_email,
      metadata: {
        subject,
        message_id: messageId,
      },
    });
    if (activityError) {
      failedWrites.push('ticket_activity_log');
      ulog.error('Error logging ticket activity', activityError, { ticket_id });
    }

    // Notification about the agent reply; fire-and-forget.
    invokeFunctionAndForget('send-notification-email', {
      type: 'agent_reply',
      ticket_number: ticket.ticket_number,
      ticket_id: ticket_id,
      ticket_subject: ticket.subject,
      from_email: mailbox.email_address,
      from_name: user.email?.split('@')[0] || 'Support Agent',
      message_preview: message,
    });

    ulog.info('Ticket email sent', {
      ticket_id,
      ticket_number: ticket.ticket_number,
      failed_writes: failedWrites,
    });

    const partial = failedWrites.length > 0;
    return json(partial ? 207 : 200, {
      success: true,
      partial,
      failed_writes: failedWrites,
      message_id: messageId,
      ticket_id: ticket_id,
    });
  } catch (error: any) {
    log.error('send-ticket-email failed', error);
    return normalizedErrorResponse(classifyError(error), error, corsHeaders);
  }
};
