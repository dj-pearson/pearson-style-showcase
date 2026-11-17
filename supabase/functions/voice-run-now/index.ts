import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';

/**
 * Post now for the voice engine (Admin > Voice > Activity).
 *
 * Relays an admin's request to the voice engine service's POST /run. The run
 * secret lives here, in the edge functions app's env, so it never reaches the
 * browser. The service answers quickly (202 accepted, 401 bad secret, 409 the
 * track already posted today, 429 over 6 calls an hour) and this returns its
 * status and JSON body unchanged.
 */

const TRACKS = ['gradethread', 'eatpal', 'platform'];
const TIMEOUT_MS = 30000;

export default async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Admin only: this publishes under Dan's name.
  const auth = await requireAdmin(req, corsHeaders);
  if (!auth.ok) return auth.response!;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: { track?: unknown; dryRun?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Request body must be JSON' }, 400);
  }
  const { track } = body;
  if (typeof track !== 'string' || !TRACKS.includes(track)) {
    return json({ error: `track must be one of: ${TRACKS.join(', ')}` }, 400);
  }
  const dryRun = body.dryRun === true;

  const serviceUrl = (Deno.env.get('VOICE_SERVICE_URL') ?? '').replace(/\/+$/, '');
  const runSecret = Deno.env.get('VOICE_RUN_SECRET');
  const missing = [
    ...(serviceUrl ? [] : ['VOICE_SERVICE_URL']),
    ...(runSecret ? [] : ['VOICE_RUN_SECRET']),
  ];
  if (missing.length > 0 || !runSecret) {
    return json({ error: `Not set on the edge functions app: ${missing.join(', ')}` }, 500);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${serviceUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-run-secret': runSecret },
      body: JSON.stringify({ track, dryRun }),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: `Voice engine answered ${response.status} with a non-JSON body` };
    }
    // A 401 here means the two VOICE_RUN_SECRET values disagree, not that the
    // admin is signed out. Relaying it as 401 would send the dashboard to the
    // login screen, so report it as a gateway error instead.
    if (response.status === 401) {
      return json(
        { error: 'The voice engine rejected the run secret (VOICE_RUN_SECRET mismatch)' },
        502
      );
    }
    return json(payload, response.status);
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    console.error('voice-run-now: relay failed:', timedOut ? 'timeout' : error);
    return json(
      {
        error: timedOut
          ? 'The voice engine did not answer within 30 seconds'
          : 'Could not reach the voice engine',
      },
      502
    );
  } finally {
    clearTimeout(timer);
  }
};
