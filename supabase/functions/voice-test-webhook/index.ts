import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import { safeFetch, UrlGuardError } from '../_shared/url-guard.ts';
import { generateSignature } from '../_shared/webhook-security.ts';

/**
 * Test fire for the voice engine (Admin > Voice > Settings).
 *
 * Sends one sample payload to a platform's Make webhook, in the same shape and
 * with the same signature as a real send from services/voice-engine, plus a
 * top-level "test": true. The Make scenarios pass a run only when `test` does
 * not exist, so a test fire reaches the webhook and posts nothing.
 *
 * The URL is read from voice_webhook_targets, never taken from the caller, so
 * this cannot be pointed at an arbitrary address.
 */

const PLATFORMS = ['x', 'linkedin', 'instagram', 'facebook', 'threads', 'youtube'];
const TIMEOUT_MS = 15000;
const SAMPLE_IMAGE_URL = 'https://danpearson.net/android-chrome-512x512.png';

export default async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Admin only: this makes an outbound request.
  const auth = await requireAdmin(req, corsHeaders);
  if (!auth.ok) return auth.response!;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let platform: unknown;
  try {
    ({ platform } = await req.json());
  } catch {
    return json({ error: 'Request body must be JSON' }, 400);
  }
  if (typeof platform !== 'string' || !PLATFORMS.includes(platform)) {
    return json({ error: `platform must be one of: ${PLATFORMS.join(', ')}` }, 400);
  }

  const secret = Deno.env.get('VOICE_WEBHOOK_SECRET');
  if (!secret) {
    return json({ error: 'VOICE_WEBHOOK_SECRET is not set on the edge functions app' }, 500);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );
  const { data: target, error: targetError } = await supabase
    .from('voice_webhook_targets')
    .select('url')
    .eq('platform', platform)
    .maybeSingle();
  if (targetError) {
    console.error('voice-test-webhook: target lookup failed:', targetError.message);
    return json({ error: 'Could not read the webhook target' }, 500);
  }

  const url = (target?.url ?? '').trim();
  if (!url) return json({ error: `No webhook URL is saved for ${platform}` }, 400);
  if (!url.toLowerCase().startsWith('https://')) {
    return json({ error: 'The saved webhook URL must start with https://' }, 400);
  }

  const timestamp = new Date().toISOString();
  // Sign and send the same string: the receiver verifies the raw body.
  const rawBody = JSON.stringify({
    event: 'social.published',
    platform,
    timestamp,
    test: true,
    data: {
      id: 'test',
      body: 'Test fire from the Dan Pearson voice engine. If this shows up as a post, the scenario is missing its test filter.',
      hashtags: [],
      cta_url: null,
      product_focus: 'test',
      track: 'test',
      image_url: SAMPLE_IMAGE_URL,
      media_type: 'image',
    },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Signature': await generateSignature(rawBody, secret),
        'X-Idempotency-Key': `test:${platform}:${timestamp}`,
      },
      body: rawBody,
      signal: controller.signal,
    });
    await response.body?.cancel();
    return json({ ok: response.ok, status: response.status });
  } catch (error) {
    if (error instanceof UrlGuardError) {
      return json({ error: `Webhook URL refused: ${error.message}` }, 400);
    }
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    console.error('voice-test-webhook: send failed:', timedOut ? 'timeout' : error);
    return json(
      {
        error: timedOut
          ? 'The webhook did not answer within 15 seconds'
          : 'Could not reach the webhook',
      },
      502
    );
  } finally {
    clearTimeout(timer);
  }
};
