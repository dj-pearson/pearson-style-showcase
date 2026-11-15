import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { Resend } from 'npm:resend@2.0.0';
import { validateEmail } from './validation.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit, getClientIdentifier } from '../_shared/rate-limiter.ts';

interface SubscribeRequest {
  email: string;
}

// 5 signups per client IP per hour. Keyed with the shared getClientIdentifier,
// which ignores the client-supplied first X-Forwarded-For hop.
const NEWSLETTER_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  burstAllowance: 0,
  keyPrefix: 'newsletter',
};

// DISPOSABLE_DOMAINS + validateEmail extracted to ./validation.ts for unit tests (US-012).

// No unsubscribe endpoint exists yet, so the footer link is a mailto.
const UNSUBSCRIBE_HREF = 'mailto:dan@danpearson.net?subject=Unsubscribe';

const WELCOME_SUBJECT = "You're on the list: pipeline notes from Dan Pearson";

const WELCOME_TEXT = `Thanks for signing up.

Here's what you'll get from me: teardowns of real CRM automations (what the workflow does, where it breaks, what it cost to run) and step-by-step guides you can copy into your own pipeline. No filler, and not more than a couple of emails a month.

Start here:
- AI CRM automation, the overview: https://danpearson.net/ai-crm-automation
- Every guide on the topic: https://danpearson.net/topics/ai-crm-automation

If you're working on something specific, reply to this email. I read every one.

Dan Pearson
https://danpearson.net
LinkedIn: https://www.linkedin.com/in/danpearson
GitHub: https://github.com/dj-pearson

You're getting this because you subscribed at danpearson.net. To unsubscribe, email dan@danpearson.net with "Unsubscribe" in the subject.`;

const WELCOME_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${WELCOME_SUBJECT}</title>
</head>
<body style="margin: 0; padding: 0; background: #ffffff;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 20px; font-family: Georgia, 'Times New Roman', serif; font-size: 17px; line-height: 1.6; color: #1f2328;">
    <p style="margin: 0 0 20px;">Thanks for signing up.</p>
    <p style="margin: 0 0 20px;">Here's what you'll get from me: teardowns of real CRM automations (what the workflow does, where it breaks, what it cost to run) and step-by-step guides you can copy into your own pipeline. No filler, and not more than a couple of emails a month.</p>
    <p style="margin: 0 0 8px; font-weight: bold;">Start here</p>
    <p style="margin: 0 0 6px;"><a href="https://danpearson.net/ai-crm-automation" style="color: #0b5cad;">AI CRM automation, the overview</a></p>
    <p style="margin: 0 0 20px;"><a href="https://danpearson.net/topics/ai-crm-automation" style="color: #0b5cad;">Every guide on the topic</a></p>
    <p style="margin: 0 0 20px;">If you're working on something specific, reply to this email. I read every one.</p>
    <p style="margin: 0 0 32px;">Dan Pearson</p>
    <p style="margin: 0; padding-top: 16px; border-top: 1px solid #d8dee4; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.5; color: #57606a;">
      <a href="https://danpearson.net" style="color: #57606a;">danpearson.net</a> &middot;
      <a href="https://www.linkedin.com/in/danpearson" style="color: #57606a;">LinkedIn</a> &middot;
      <a href="https://github.com/dj-pearson" style="color: #57606a;">GitHub</a><br>
      You're getting this because you subscribed at danpearson.net.
      <a href="${UNSUBSCRIBE_HREF}" style="color: #57606a;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;

const handler = async (req: Request): Promise<Response> => {
  // CORS from the shared allow-list (per request; never a wildcard).
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIP = getClientIdentifier(req);
    const rateLimit = checkRateLimit(clientIP, NEWSLETTER_RATE_LIMIT);
    if (!rateLimit.allowed) {
      console.warn('Newsletter signup rate limit exceeded');
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, ...rateLimit.headers, 'Content-Type': 'application/json' },
      });
    }

    const { email: rawEmail }: SubscribeRequest = await req.json();

    // Validate and normalize email
    const validation = validateEmail(rawEmail);
    if (!validation.valid) {
      console.warn(`Invalid email submission: ${validation.error}`);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email = rawEmail.trim().toLowerCase();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if email already exists
    const { data: existingSubscriber } = await supabase
      .from('newsletter_subscribers')
      .select('id, active')
      .eq('email', email)
      .single();

    if (existingSubscriber) {
      if (existingSubscriber.active) {
        return new Response(JSON.stringify({ message: "You're already subscribed!" }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } else {
        // Reactivate subscription
        await supabase
          .from('newsletter_subscribers')
          .update({ active: true, subscribed_at: new Date().toISOString() })
          .eq('email', email);
      }
    } else {
      // Add new subscriber
      const { error: insertError } = await supabase
        .from('newsletter_subscribers')
        .insert([{ email }]);

      if (insertError) {
        console.error('Database error:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to subscribe' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // Send welcome email
    const resend = new Resend(Deno.env.get('RESEND_API'));

    const welcomeEmailResponse = await resend.emails.send({
      from: 'Dan Pearson <noreply@danpearson.net>',
      to: [email],
      // The copy invites replies; noreply@ would swallow them.
      reply_to: 'dan@danpearson.net',
      subject: WELCOME_SUBJECT,
      html: WELCOME_HTML,
      text: WELCOME_TEXT,
    });

    console.log('Welcome email sent:', welcomeEmailResponse);

    // Mark welcome email as sent
    await supabase
      .from('newsletter_subscribers')
      .update({ welcome_email_sent: true })
      .eq('email', email);

    return new Response(
      JSON.stringify({
        message: 'Successfully subscribed! Check your inbox for a welcome email.',
        emailSent: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error in newsletter signup:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

export default handler;
