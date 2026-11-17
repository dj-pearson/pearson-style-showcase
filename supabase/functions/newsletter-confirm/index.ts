/**
 * newsletter-confirm (US-107)
 *
 * POST { token } from /newsletter/confirm. A valid token under seven days old
 * confirms the address, activates it and sends the welcome email with a
 * signed unsubscribe link and RFC 8058 one-click headers.
 *
 * Token outcomes answer 200 with a status the page renders:
 *   confirmed  the address is on the list (also for a repeat click)
 *   expired    the token matched but is over seven days old
 *   invalid    no row holds this token
 * Server faults are 5xx.
 *
 * Needs NEWSLETTER_TOKEN_SECRET (to sign the unsubscribe link) and RESEND_API.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit, getClientIdentifier } from '../_shared/rate-limiter.ts';
import {
  hashToken,
  isWellFormedConfirmationToken,
  signUnsubscribeToken,
} from '../_shared/newsletter-tokens.ts';
import {
  NEWSLETTER_FROM,
  NEWSLETTER_REPLY_TO,
  listUnsubscribeHeaders,
  oneClickUnsubscribeUrl,
  unsubscribePageUrl,
  welcomeEmail,
} from '../_shared/newsletter-emails.ts';
import { decideConfirmAction, wonConfirmRace } from './policy.ts';

const CONFIRM_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  burstAllowance: 0,
  keyPrefix: 'newsletter-confirm',
};

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, { ...corsHeaders, Allow: 'POST, OPTIONS' });
  }

  try {
    const rateLimit = checkRateLimit(getClientIdentifier(req), CONFIRM_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return json({ error: 'Too many requests. Please try again later.' }, 429, {
        ...corsHeaders,
        ...rateLimit.headers,
      });
    }

    const body = await req.json().catch(() => null);
    const token: unknown = body?.token;
    if (!isWellFormedConfirmationToken(token)) {
      return json({ status: 'invalid' }, 200, corsHeaders);
    }

    const secret = Deno.env.get('NEWSLETTER_TOKEN_SECRET') ?? '';
    if (!secret) {
      // Confirming without a working unsubscribe link would break the promise
      // in the welcome email, so refuse until the secret is configured.
      console.error('NEWSLETTER_TOKEN_SECRET is not set; cannot confirm subscriptions');
      return json({ error: 'Internal server error' }, 500, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: row, error: lookupError } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, active, confirmed_at, confirmation_sent_at')
      .eq('confirmation_token_hash', await hashToken(token))
      .maybeSingle();

    if (lookupError) {
      console.error('Newsletter confirm lookup failed:', lookupError);
      return json({ error: 'Internal server error' }, 500, corsHeaders);
    }
    const action = decideConfirmAction(row);
    if (action === 'invalid') return json({ status: 'invalid' }, 200, corsHeaders);
    // A second click on the same link: already done, nothing to send.
    if (action === 'already_confirmed') return json({ status: 'confirmed' }, 200, corsHeaders);
    if (action === 'expired') return json({ status: 'expired' }, 200, corsHeaders);

    const now = new Date().toISOString();
    // Conditional on confirmed_at IS NULL so two racing clicks send one welcome.
    const { data: updated, error: updateError } = await supabase
      .from('newsletter_subscribers')
      .update({
        active: true,
        confirmed_at: now,
        subscribed_at: now,
        unsubscribed_at: null,
      })
      .eq('id', row.id)
      .is('confirmed_at', null)
      .select('id');

    if (updateError) {
      console.error('Newsletter confirm update failed:', updateError);
      return json({ error: 'Internal server error' }, 500, corsHeaders);
    }
    if (!wonConfirmRace(updated)) {
      return json({ status: 'confirmed' }, 200, corsHeaders);
    }

    const unsubscribeToken = await signUnsubscribeToken(row.id, secret);
    const welcome = welcomeEmail(unsubscribePageUrl(unsubscribeToken));
    const resend = new Resend(Deno.env.get('RESEND_API'));
    const { error: sendError } = await resend.emails.send({
      from: NEWSLETTER_FROM,
      to: [row.email],
      reply_to: NEWSLETTER_REPLY_TO,
      subject: welcome.subject,
      html: welcome.html,
      text: welcome.text,
      headers: listUnsubscribeHeaders(oneClickUnsubscribeUrl(unsubscribeToken)),
    });

    if (sendError) {
      // The subscription stands; only the welcome note is missing.
      console.error('Welcome email failed:', sendError);
    } else {
      await supabase
        .from('newsletter_subscribers')
        .update({ welcome_email_sent: true })
        .eq('id', row.id);
    }

    return json({ status: 'confirmed' }, 200, corsHeaders);
  } catch (error) {
    console.error('Error in newsletter confirm:', error);
    return json({ error: 'Internal server error' }, 500, corsHeaders);
  }
};

export default handler;
