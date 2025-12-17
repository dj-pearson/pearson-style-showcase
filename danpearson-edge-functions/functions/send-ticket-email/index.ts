import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface SendEmailRequest {
  ticket_id: string;
  from_mailbox_id: string;
  to_email: string;
  subject: string;
  message: string;
  is_internal?: boolean;
  in_reply_to?: string;
  cc_emails?: string[];
}

// Send email via SMTP (supports Amazon SES, Gmail, etc.)
async function sendEmailViaSMTP(
  mailboxConfig: any,
  toEmail: string,
  subject: string,
  bodyText: string,
  bodyHtml: string,
  ccEmails?: string[],
  inReplyTo?: string
): Promise<{ messageId: string; success: boolean }> {

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
    throw new Error('SMTP configuration missing. Please configure mailbox or set environment variables.');
  }

  console.log(`Using SMTP: ${smtpHost}:${smtpPort} with username: ${smtpUsername?.substring(0, 4)}***`);

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

  const messageId = `<${crypto.randomUUID()}@${mailboxConfig.email_address.split('@')[1]}>`;

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

  await client.send(emailConfig);
  await client.close();

  return {
    messageId: messageId,
    success: true,
  };
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

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestData: SendEmailRequest = await req.json();
    const {
      ticket_id,
      from_mailbox_id,
      to_email,
      subject,
      message,
      is_internal = false,
      in_reply_to,
      cc_emails
    } = requestData;

    // Validate required fields
    if (!ticket_id || !from_mailbox_id || !to_email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get mailbox details
    const { data: mailbox, error: mailboxError } = await supabase
      .from('email_mailboxes')
      .select('*')
      .eq('id', from_mailbox_id)
      .eq('is_active', true)
      .single();

    if (mailboxError || !mailbox) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive mailbox' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Sending email for ticket ${ticket.ticket_number} from ${mailbox.email_address} to ${to_email}`);

    // Convert message to HTML if needed
    const bodyHtml = message.includes('<') ? message : textToHtml(message);

    // Send email via SMTP
    const { messageId } = await sendEmailViaSMTP(
      mailbox,
      to_email,
      subject,
      message,
      bodyHtml,
      cc_emails,
      in_reply_to || ticket.email_message_id
    );

    console.log('Email sent successfully, Message ID:', messageId);

    // Create email thread entry
    const { error: threadError } = await supabase
      .from('email_threads')
      .insert({
        ticket_id: ticket_id,
        mailbox_id: from_mailbox_id,
        from_email: mailbox.email_address,
        to_email: to_email,
        cc_emails: cc_emails || [],
        subject: subject,
        message_id: messageId,
        in_reply_to: in_reply_to || ticket.email_message_id,
        email_references: ticket.email_message_id ? [ticket.email_message_id] : [],
        body_text: message,
        body_html: bodyHtml,
        direction: 'outbound',
        is_read: true,
        sent_at: new Date().toISOString(),
      });

    if (threadError) {
      console.error('Error creating email thread:', threadError);
      // Continue even if thread creation fails
    }

    // Create ticket response
    const { error: responseError } = await supabase
      .from('ticket_responses')
      .insert({
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
      console.error('Error creating ticket response:', responseError);
      // Continue even if response creation fails
    }

    // Update ticket status and timestamps
    const updateData: any = {
      last_activity_at: new Date().toISOString(),
      status: 'waiting_for_user',
    };

    // Set first_response_at if this is the first response
    if (!ticket.first_response_at) {
      updateData.first_response_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticket_id);

    if (updateError) {
      console.error('Error updating ticket:', updateError);
    }

    // Log activity
    await supabase
      .from('ticket_activity_log')
      .insert({
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

    console.log('Successfully processed email send and updated ticket');

    // Send notification email about agent reply
    try {
      await supabase.functions.invoke('send-notification-email', {
        body: {
          type: 'agent_reply',
          ticket_number: ticket.ticket_number,
          ticket_id: ticket_id,
          ticket_subject: ticket.subject,
          from_email: mailbox.email_address,
          from_name: user.email?.split('@')[0] || 'Support Agent',
          message_preview: message,
        }
      });
      console.log('Notification email sent for agent reply');
    } catch (notifyError) {
      // Don't fail the request if notification fails
      console.error('Failed to send notification:', notifyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        ticket_id: ticket_id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-ticket-email function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send email',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};
