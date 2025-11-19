import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MakeComEmailPayload {
  to: string;              // Email address message was sent to
  from: string;            // Sender name
  from_email: string;      // Sender email address
  subject: string;         // Email subject
  date: string;            // Timestamp (e.g., "Tue, 18 Nov 2025 21:27:33 -0600")
  body: string;            // Full email body
  id: string;              // Unique email ID
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

    const contentType = req.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    
    let payload: MakeComEmailPayload;
    
    // Handle multipart/form-data (e.g. from Make.com sending form-data)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();

      const getField = (name: string): string => {
        const candidates = [
          name,
          name.toLowerCase(),
          name.toUpperCase(),
        ];

        for (const key of candidates) {
          const value = formData.get(key);
          if (typeof value === 'string') return value;
        }
        return '';
      };

      payload = {
        to: getField('to') || getField('To'),
        from: getField('from') || getField('From'),
        from_email:
          getField('from_email') ||
          getField('From_email') ||
          getField('fromEmail') ||
          getField('FromEmail'),
        subject: getField('subject') || getField('Subject'),
        date: getField('date') || getField('Date'),
        body:
          getField('body') ||
          getField('text') ||
          getField('Text') ||
          getField('html') ||
          getField('Html'),
        id: getField('id') || getField('Id') || getField('ID'),
      };

      console.log('Parsed as multipart form-data', {
        to: payload.to,
        from: payload.from_email,
        subject: payload.subject,
      });
    } else {
      const rawBody = await req.text();
      console.log('Raw body received (first 200 chars):', rawBody.substring(0, 200));
      
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
        console.log('Parsed as form-encoded data');
      } else {
        // Try to parse as JSON
        try {
          payload = JSON.parse(rawBody);
          console.log('Parsed as JSON');
        } catch (parseError) {
          console.error('Failed to parse payload:', parseError);
          return new Response(
            JSON.stringify({ 
              error: 'Invalid payload format. Expected JSON, form-encoded data, or multipart form-data.',
              details: (parseError as Error).message,
              contentType: contentType,
              bodyPreview: rawBody.substring(0, 100)
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      }
    }
    console.log('Received email from Make.com:', {
      to: payload.to,
      from: payload.from_email,
      subject: payload.subject
    });

    // Validate required fields
    if (!payload.to || !payload.from_email || !payload.subject || !payload.body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, from_email, subject, body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
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
      console.log(`Creating new mailbox for: ${payload.to}`);

      const { data: newMailbox, error: createError } = await supabase
        .from('email_mailboxes')
        .insert({
          name: `${toDomain} Inbox`,
          email_address: payload.to,
          display_name: toDomain,
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
        console.error('Failed to create mailbox:', createError);
        throw createError;
      }

      mailbox = newMailbox;
      console.log(`Mailbox created with ID: ${mailbox.id}`);
    }

    // Check if this is a reply to an existing ticket (by checking subject or message ID)
    let ticketId: string | null = null;

    // Try to find existing ticket by matching subject or email ID
    const { data: existingTicket } = await supabase
      .from('support_tickets')
      .select('id, ticket_number')
      .eq('user_email', payload.from_email)
      .ilike('subject', `%${payload.subject.replace(/^(Re:|Fwd:)\s*/i, '')}%`)
      .eq('mailbox_id', mailbox.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingTicket) {
      ticketId = existingTicket.id;
      console.log(`Found existing ticket: ${existingTicket.ticket_number}`);
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
      if (subjectLower.includes('bug') || subjectLower.includes('error') || subjectLower.includes('issue')) {
        category = 'bug';
      } else if (subjectLower.includes('feature') || subjectLower.includes('request') || subjectLower.includes('add')) {
        category = 'feature_request';
      } else if (subjectLower.includes('billing') || subjectLower.includes('payment') || subjectLower.includes('invoice')) {
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
          email_message_id: payload.id,
          created_at: parsedDate,
          last_activity_at: parsedDate,
        })
        .select()
        .single();

      if (ticketError) {
        console.error('Error creating ticket:', ticketError);
        throw ticketError;
      }

      ticketId = ticket.id;
      console.log(`Created new ticket: ${ticket.ticket_number}`);
    } else {
      // Update existing ticket with new activity
      await supabase
        .from('support_tickets')
        .update({
          last_activity_at: parsedDate,
          status: 'waiting_for_agent'
        })
        .eq('id', ticketId);

      // Add as a response to the existing ticket
      await supabase
        .from('ticket_responses')
        .insert({
          ticket_id: ticketId,
          author_email: payload.from_email,
          author_name: payload.from || payload.from_email.split('@')[0],
          author_type: 'user',
          message: payload.body,
          is_internal: false,
          created_at: parsedDate,
        });

      console.log(`Added response to existing ticket`);
    }

    // Create email thread entry
    const { error: threadError } = await supabase
      .from('email_threads')
      .insert({
        ticket_id: ticketId,
        mailbox_id: mailbox.id,
        from_email: payload.from_email,
        to_email: payload.to,
        subject: payload.subject,
        message_id: payload.id,
        body_text: payload.body,
        body_html: payload.body, // Assuming body might contain HTML
        direction: 'inbound',
        is_read: false,
        received_at: parsedDate,
      });

    if (threadError) {
      console.error('Error creating email thread:', threadError);
      // Don't fail the whole request if thread creation fails
    }

    console.log('Successfully processed email from Make.com');

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: ticketId,
        mailbox_id: mailbox.id,
        message: 'Email received and processed successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error processing email webhook:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process email',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
