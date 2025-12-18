import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface NotificationRequest {
  type: 'new_ticket' | 'new_response' | 'agent_reply';
  ticket_number: string;
  ticket_id: string;
  ticket_subject: string;
  from_email: string;
  from_name: string;
  message_preview: string;
  notification_email?: string; // Optional override, defaults to pearsonperformance@gmail.com
}

interface NotificationSettings {
  notification_emails: string[];
  enabled: boolean;
  slack_enabled?: boolean;
  slack_webhook_url?: string;
  slack_channel?: string;
}

async function sendNotificationEmail(
  notificationEmail: string,
  subject: string,
  body: string
): Promise<void> {
  const smtpHost = Deno.env.get('AMAZON_SMTP_ENDPOINT');
  let smtpPort = 587;
  const smtpUsername = Deno.env.get('AMAZON_SMTP_USER_NAME');
  const smtpPassword = Deno.env.get('AMAZON_SMTP_PASSWORD');
  const smtpUseTls = true;

  // Work around Deno TLS bug on port 587 by switching to 465 when using TLS
  if (smtpUseTls && smtpPort === 587) {
    smtpPort = 465;
  }

  if (!smtpHost || !smtpUsername || !smtpPassword) {
    throw new Error('SMTP configuration missing for notifications');
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

  try {
    await client.send({
      from: smtpUsername,
      to: notificationEmail,
      subject: subject,
      content: body,
      html: `<html><body style="font-family: Arial, sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br>')}</body></html>`,
    });
    console.log(`Notification email sent to ${notificationEmail}`);
  } finally {
    await client.close();
  }
}

async function sendSlackNotification(
  webhookUrl: string,
  request: NotificationRequest
): Promise<void> {
  let emoji: string;
  let headerText: string;
  let statusColor: string;

  if (request.type === 'new_ticket') {
    emoji = '🎫';
    headerText = 'New Support Ticket';
    statusColor = '#36a64f'; // Green
  } else if (request.type === 'new_response') {
    emoji = '💬';
    headerText = 'New Response on Ticket';
    statusColor = '#2196f3'; // Blue
  } else {
    emoji = '✉️';
    headerText = 'Agent Reply Sent';
    statusColor = '#9c27b0'; // Purple
  }

  const messagePreview = request.message_preview.substring(0, 300);
  const truncated = request.message_preview.length > 300 ? '...' : '';

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${headerText}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Ticket:*\n${request.ticket_number}`,
          },
          {
            type: 'mrkdwn',
            text: `*From:*\n${request.from_name}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Subject:*\n${request.ticket_subject}`,
          },
          {
            type: 'mrkdwn',
            text: `*Email:*\n${request.from_email}`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Message Preview:*\n>${messagePreview.replace(/\n/g, '\n>')}${truncated}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Ticket',
              emoji: true,
            },
            url: `https://danpearson.net/admin/dashboard?tab=support&ticket=${request.ticket_id}`,
            style: 'primary',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📧 From Pearson Media Support System`,
          },
        ],
      },
    ],
    attachments: [
      {
        color: statusColor,
        blocks: [],
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} - ${errorText}`);
  }

  console.log('Slack notification sent successfully');
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

    const request: NotificationRequest = await req.json();
    
    // Fetch ticket to check status
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('status')
      .eq('id', request.ticket_id)
      .single();

    if (ticketError) {
      console.error('Error fetching ticket:', ticketError);
      throw ticketError;
    }

    // Skip notifications for spam and disregard statuses
    if (ticket && (ticket.status === 'spam' || ticket.status === 'disregard')) {
      console.log(`Skipping notification for ticket ${request.ticket_number} with status: ${ticket.status}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: `Ticket marked as ${ticket.status}` 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Fetch notification settings to get configured email addresses and Slack settings
    const { data: notificationSettings } = await supabase
      .from('notification_settings')
      .select('notification_emails, enabled, slack_enabled, slack_webhook_url, slack_channel')
      .single();
    
    const settings = notificationSettings as NotificationSettings | null;
    
    // Skip if notifications are disabled
    if (settings && !settings.enabled && !settings.slack_enabled) {
      console.log('All notifications are disabled in settings');
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: 'All notifications disabled' 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Get notification emails from settings or use default
    const notificationEmails = settings?.notification_emails || ['pearsonperformance@gmail.com'];

    let subject: string;
    let body: string;

    if (request.type === 'new_ticket') {
      subject = `🎫 New Support Ticket: ${request.ticket_number}`;
      body = `
Hello,

A new support ticket has been received:

Ticket Number: ${request.ticket_number}
Subject: ${request.ticket_subject}
From: ${request.from_name} <${request.from_email}>

Message Preview:
${request.message_preview.substring(0, 200)}${request.message_preview.length > 200 ? '...' : ''}

View ticket: https://danpearson.net/admin (Support & Help Center tab)

---
This is an automated notification from Pearson Media Support System
`;
    } else if (request.type === 'new_response') {
      subject = `💬 New Response on Ticket: ${request.ticket_number}`;
      body = `
Hello,

A new response has been received on an existing support ticket:

Ticket Number: ${request.ticket_number}
Subject: ${request.ticket_subject}
From: ${request.from_name} <${request.from_email}>

Message Preview:
${request.message_preview.substring(0, 200)}${request.message_preview.length > 200 ? '...' : ''}

View ticket: https://danpearson.net/admin (Support & Help Center tab)

---
This is an automated notification from Pearson Media Support System
`;
    } else if (request.type === 'agent_reply') {
      subject = `✉️ Agent Reply Sent on Ticket: ${request.ticket_number}`;
      body = `
Hello,

An agent has replied to a support ticket:

Ticket Number: ${request.ticket_number}
Subject: ${request.ticket_subject}
Agent: ${request.from_name}
From Email: ${request.from_email}

Message Preview:
${request.message_preview.substring(0, 200)}${request.message_preview.length > 200 ? '...' : ''}

The reply has been sent to the customer. View ticket history: https://danpearson.net/admin (Support & Help Center tab)

---
This is an automated notification from Pearson Media Support System
`;
    }

    // Send email notifications if enabled
    if (settings?.enabled !== false) {
      for (const email of notificationEmails) {
        try {
          await sendNotificationEmail(email, subject!, body!);
          
          // Log the notification
          await supabase.from('email_logs').insert({
            recipient_email: email,
            subject: subject,
            type: 'notification',
            status: 'sent',
            sent_at: new Date().toISOString(),
          });
          
          console.log(`Email notification sent to ${email}`);
        } catch (emailError: any) {
          console.error(`Failed to send notification to ${email}:`, emailError);
          
          // Log the failure
          await supabase.from('email_logs').insert({
            recipient_email: email,
            subject: subject,
            type: 'notification',
            status: 'failed',
            error_message: emailError.message,
            sent_at: new Date().toISOString(),
          });
        }
      }
    }

    // Send Slack notification if enabled
    if (settings?.slack_enabled && settings?.slack_webhook_url) {
      try {
        await sendSlackNotification(settings.slack_webhook_url, request);
        
        // Log the Slack notification
        await supabase.from('email_logs').insert({
          recipient_email: `slack:${settings.slack_channel || '#notifications'}`,
          subject: subject,
          type: 'slack_notification',
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
        
        console.log(`Slack notification sent to ${settings.slack_channel || '#notifications'}`);
      } catch (slackError: any) {
        console.error('Failed to send Slack notification:', slackError);
        
        // Log the failure
        await supabase.from('email_logs').insert({
          recipient_email: `slack:${settings.slack_channel || '#notifications'}`,
          subject: subject,
          type: 'slack_notification',
          status: 'failed',
          error_message: slackError.message,
          sent_at: new Date().toISOString(),
        });
      }
    }

    console.log(`Notification sent for ${request.type}: ${request.ticket_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notifications sent successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send notification',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
