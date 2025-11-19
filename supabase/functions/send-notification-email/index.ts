import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const request: NotificationRequest = await req.json();
    
    // Default notification email
    const notificationEmail = request.notification_email || 'pearsonperformance@gmail.com';

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

View ticket: https://builddesk.io/admin (Support & Help Center tab)

---
This is an automated notification from BuildDesk Support System
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

View ticket: https://builddesk.io/admin (Support & Help Center tab)

---
This is an automated notification from BuildDesk Support System
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

The reply has been sent to the customer. View ticket history: https://builddesk.io/admin (Support & Help Center tab)

---
This is an automated notification from BuildDesk Support System
`;
    }

    // Send the notification email
    await sendNotificationEmail(notificationEmail, subject, body);

    // Log the notification
    await supabase.from('email_logs').insert({
      recipient_email: notificationEmail,
      subject: subject,
      type: 'notification',
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    console.log(`Notification sent for ${request.type}: ${request.ticket_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification email sent successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error sending notification email:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send notification email',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
