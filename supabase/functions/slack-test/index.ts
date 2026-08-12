import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

/**
 * Validate that a webhook URL is a legitimate Slack webhook.
 * Blocks SSRF by only allowing https://hooks.slack.com/* URLs.
 */
function isValidSlackWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Must be HTTPS
    if (parsed.protocol !== 'https:') return false;

    // Must be hooks.slack.com
    if (parsed.hostname !== 'hooks.slack.com') return false;

    // Path must start with /services/
    if (!parsed.pathname.startsWith('/services/')) return false;

    return true;
  } catch {
    return false;
  }
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { webhookUrl, channel } = await req.json();

    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: 'Webhook URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SSRF protection: only allow Slack webhook URLs
    if (!isValidSlackWebhookUrl(webhookUrl)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid webhook URL. Only https://hooks.slack.com/services/* URLs are accepted.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send test message to Slack
    const payload = {
      text: '🧪 *Test Notification from Pearson Media Support*',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🧪 Test Notification',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'This is a test message from the *Pearson Media Support System*.\n\nIf you see this message, your Slack integration is working correctly! ✅',
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Sent to channel: *${channel || '#notifications'}*`,
            },
          ],
        },
      ],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return new Response(
          JSON.stringify({ success: true, message: 'Test message sent to Slack!' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({
            error: `Slack returned an error (status ${response.status}). Please verify your webhook URL.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: any) {
    console.error('Slack test error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send test message. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};
