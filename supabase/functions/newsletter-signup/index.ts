import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { Resend } from 'npm:resend@2.0.0';
import { validateEmail } from './validation.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit, getClientIdentifier } from '../_shared/rate-limiter.ts';
import { generateConfirmationToken } from '../_shared/newsletter-tokens.ts';
import {
  NEWSLETTER_FROM,
  NEWSLETTER_REPLY_TO,
  confirmPageUrl,
  confirmationEmail,
} from '../_shared/newsletter-emails.ts';
import { decideSignupAction, type ExistingSubscriber } from './policy.ts';

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
// The welcome email moved to _shared/newsletter-emails.ts and is sent by
// newsletter-confirm once the address is confirmed (US-107).

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// Same body for a fresh send and a cooldown, so the response doesn't say
// whether a confirmation went out a minute ago.
const CONFIRMATION_SENT = {
  status: 'confirmation_sent',
  message: 'Check your inbox for a link to confirm.',
};

const handler = async (req: Request): Promise<Response> => {
  // CORS from the shared allow-list (per request; never a wildcard).
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, { ...corsHeaders, Allow: 'POST, OPTIONS' });
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

    const body: Partial<SubscribeRequest> | null = await req.json().catch(() => null);
    const rawEmail = body?.email;
    if (typeof rawEmail !== 'string') {
      return json({ error: 'Invalid email format' }, 400, corsHeaders);
    }

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: existing, error: lookupError } = await supabase
      .from('newsletter_subscribers')
      .select('id, active, confirmed_at, confirmation_sent_at')
      .eq('email', email)
      .maybeSingle();

    if (lookupError) {
      console.error('Newsletter lookup failed:', lookupError);
      return json({ error: 'Failed to subscribe' }, 500, corsHeaders);
    }

    const action = decideSignupAction(existing as ExistingSubscriber | null);

    if (action === 'already_subscribed') {
      return json(
        { status: 'already_subscribed', message: "You're already subscribed!" },
        200,
        corsHeaders
      );
    }
    if (action === 'cooldown') {
      return json(CONFIRMATION_SENT, 200, corsHeaders);
    }

    const { token, hash } = await generateConfirmationToken();
    const pending = {
      active: false,
      confirmed_at: null,
      confirmation_token_hash: hash,
      confirmation_sent_at: new Date().toISOString(),
    };

    if (action === 'insert') {
      const { error: insertError } = await supabase
        .from('newsletter_subscribers')
        .insert([{ email, ...pending }]);

      if (insertError) {
        // 23505: a concurrent request for the same address inserted first and
        // is sending the confirmation itself.
        if (insertError.code === '23505') return json(CONFIRMATION_SENT, 200, corsHeaders);
        console.error('Newsletter insert failed:', insertError);
        return json({ error: 'Failed to subscribe' }, 500, corsHeaders);
      }
    } else {
      // Pending past the cooldown, or previously unsubscribed: a new token,
      // still inactive until confirmed. Never a silent reactivation.
      const { error: updateError } = await supabase
        .from('newsletter_subscribers')
        .update(pending)
        .eq('email', email);

      if (updateError) {
        console.error('Newsletter update failed:', updateError);
        return json({ error: 'Failed to subscribe' }, 500, corsHeaders);
      }
    }

    const confirmation = confirmationEmail(confirmPageUrl(token));
    const resend = new Resend(Deno.env.get('RESEND_API'));
    const { error: sendError } = await resend.emails.send({
      from: NEWSLETTER_FROM,
      to: [email],
      reply_to: NEWSLETTER_REPLY_TO,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    });

    if (sendError) {
      console.error('Confirmation email failed:', sendError);
      // Lift the cooldown so the visitor can retry straight away.
      await supabase
        .from('newsletter_subscribers')
        .update({ confirmation_sent_at: null })
        .eq('email', email);
      return json({ error: 'Failed to send the confirmation email' }, 502, corsHeaders);
    }

    return json(CONFIRMATION_SENT, 200, corsHeaders);
  } catch (error) {
    console.error('Error in newsletter signup:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

export default handler;
