import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';

/**
 * Emails Dan when a voice engine track did not post. Called only by the voice
 * engine service with the service role key; an admin user's token is refused.
 *
 * At most one email per track per day: the post row's notified_at is checked
 * and set here, and any other notified post for the same track and day counts.
 * Dry-run posts never email.
 *
 * SMTP uses the same AMAZON_SMTP_* settings as send-notification-email, which
 * only handles support tickets and is not changed. The recipient is
 * VOICE_NOTIFY_EMAIL when set, else the first address in notification_settings.
 */

interface NotifyRequest {
  post_id?: unknown;
  stage?: unknown;
  reason?: unknown;
}

const json = (status: number, body: unknown, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

export default async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req.headers.get('origin'));
  const pre = handleCors(req);
  if (pre) return pre;

  const auth = await requireAdmin(req, cors, { allowServiceRole: true });
  if (!auth.ok) return auth.response!;
  if (!auth.internal) return json(403, { error: 'service role only' }, cors);

  let body: NotifyRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON' }, cors);
  }
  const postId = typeof body.post_id === 'string' ? body.post_id : '';
  const stage = typeof body.stage === 'string' ? body.stage.slice(0, 50) : 'unknown';
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 2000) : '';
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return json(400, { error: 'post_id must be a uuid' }, cors);

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: { persistSession: false },
    }
  );

  const { data: post, error: postError } = await db
    .from('voice_posts')
    .select('id, track, product, run_date, dry_run, notified_at')
    .eq('id', postId)
    .maybeSingle();
  if (postError) return json(500, { error: 'could not read the post' }, cors);
  if (!post) return json(404, { error: 'no such post' }, cors);
  if (post.dry_run) return json(200, { sent: false, reason: 'dry run' }, cors);

  const { data: already } = await db
    .from('voice_posts')
    .select('id')
    .eq('track', post.track)
    .eq('run_date', post.run_date)
    .eq('dry_run', false)
    .not('notified_at', 'is', null)
    .limit(1);
  if (post.notified_at || (already && already.length > 0)) {
    return json(200, { sent: false, reason: 'already notified today for this track' }, cors);
  }

  let to = Deno.env.get('VOICE_NOTIFY_EMAIL') ?? '';
  if (!to) {
    const { data: settings } = await db
      .from('notification_settings')
      .select('notification_emails')
      .limit(1)
      .maybeSingle();
    to = (settings?.notification_emails as string[] | undefined)?.[0] ?? '';
  }
  if (!to)
    return json(
      500,
      { error: 'no recipient: set VOICE_NOTIFY_EMAIL or notification_settings' },
      cors
    );

  const host = Deno.env.get('AMAZON_SMTP_ENDPOINT');
  const username = Deno.env.get('AMAZON_SMTP_USER_NAME');
  const password = Deno.env.get('AMAZON_SMTP_PASSWORD');
  if (!host || !username || !password) {
    return json(
      500,
      {
        error:
          'SMTP not configured: AMAZON_SMTP_ENDPOINT, AMAZON_SMTP_USER_NAME, AMAZON_SMTP_PASSWORD',
      },
      cors
    );
  }

  // Claim the notification before sending, so two calls racing cannot both email.
  const { data: claimed } = await db
    .from('voice_posts')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', post.id)
    .is('notified_at', null)
    .select('id');
  if (!claimed || claimed.length === 0)
    return json(200, { sent: false, reason: 'already notified' }, cors);

  const subject = `Voice: ${post.track} did not post on ${post.run_date}`;
  const text = [
    `The ${post.track} track (${post.product}) did not post on ${post.run_date}.`,
    '',
    `Stage: ${stage}`,
    `Reason: ${reason || 'not given'}`,
    '',
    'Details: https://danpearson.net/admin/dashboard (Voice > Activity)',
  ].join('\n');

  // Same TLS workaround as send-notification-email: Deno's TLS on 587 is unreliable.
  const client = new SMTPClient({
    connection: { hostname: host, port: 465, tls: true, auth: { username, password } },
  });
  try {
    await client.send({ from: username, to, subject, content: text });
  } catch (err) {
    // Release the claim so a later call can try again.
    await db.from('voice_posts').update({ notified_at: null }).eq('id', post.id);
    console.error('voice-notify: send failed', err instanceof Error ? err.message : String(err));
    return json(502, { error: 'email send failed' }, cors);
  } finally {
    await client.close();
  }
  return json(200, { sent: true }, cors);
};
