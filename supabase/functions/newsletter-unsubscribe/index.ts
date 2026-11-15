/**
 * newsletter-unsubscribe (US-107)
 *
 * POST only; a GET does nothing, so link scanners that prefetch URLs can't
 * unsubscribe anyone. Two callers:
 *
 *   /newsletter/unsubscribe page   POST, JSON body { token }
 *   mail client one-click button   POST ?token=..., body
 *                                  "List-Unsubscribe=One-Click" (RFC 8058),
 *                                  or no body at all
 *
 * The token is `<subscriber id>.<HMAC>` (see _shared/newsletter-tokens.ts).
 * A valid token marks the row inactive and unsubscribed and drops any pending
 * confirmation token, so an old confirm link can't re-add the address.
 * Unsubscribing twice, or a subscriber row that's since been deleted, still
 * answers 200.
 *
 * Needs NEWSLETTER_TOKEN_SECRET.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit, getClientIdentifier } from '../_shared/rate-limiter.ts';
import { verifyUnsubscribeToken } from '../_shared/newsletter-tokens.ts';

// One-click POSTs come from the mail provider's servers, so many subscribers
// can share an IP. Generous, but still a ceiling.
const UNSUBSCRIBE_RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  maxRequests: 60,
  burstAllowance: 0,
  keyPrefix: 'newsletter-unsubscribe',
};

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

/** The token from the query string, else from a JSON body. */
async function readToken(req: Request): Promise<unknown> {
  const fromQuery = new URL(req.url).searchParams.get('token');
  if (fromQuery) return fromQuery;
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  const body = await req.json().catch(() => null);
  return body?.token ?? null;
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
    const rateLimit = checkRateLimit(getClientIdentifier(req), UNSUBSCRIBE_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return json({ error: 'Too many requests. Please try again later.' }, 429, {
        ...corsHeaders,
        ...rateLimit.headers,
      });
    }

    const secret = Deno.env.get('NEWSLETTER_TOKEN_SECRET') ?? '';
    if (!secret) {
      console.error('NEWSLETTER_TOKEN_SECRET is not set; cannot verify unsubscribe links');
      return json({ error: 'Internal server error' }, 500, corsHeaders);
    }

    const subscriberId = await verifyUnsubscribeToken(await readToken(req), secret);
    if (!subscriberId) {
      return json({ error: 'invalid' }, 400, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: updateError } = await supabase
      .from('newsletter_subscribers')
      .update({
        active: false,
        unsubscribed_at: new Date().toISOString(),
        confirmation_token_hash: null,
        confirmation_sent_at: null,
      })
      .eq('id', subscriberId);

    if (updateError) {
      console.error('Newsletter unsubscribe failed:', updateError);
      return json({ error: 'Internal server error' }, 500, corsHeaders);
    }

    return json({ status: 'unsubscribed' }, 200, corsHeaders);
  } catch (error) {
    console.error('Error in newsletter unsubscribe:', error);
    return json({ error: 'Internal server error' }, 500, corsHeaders);
  }
};

export default handler;
