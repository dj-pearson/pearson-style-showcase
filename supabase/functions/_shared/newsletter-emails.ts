/**
 * Newsletter email templates and links (US-107). Pure string building, no
 * imports beyond html-escape, so the Deno tests can run offline.
 *
 * Every interpolated value goes through escapeHtml, including the URLs we
 * build ourselves: the tokens are base64url and a UUID today, and escaping
 * keeps that true if the format ever changes.
 */
import { escapeHtml } from './html-escape.ts';

export const SITE_URL = 'https://danpearson.net';
export const NEWSLETTER_FROM = 'Dan Pearson <noreply@danpearson.net>';
// The welcome copy invites replies; noreply@ would swallow them.
export const NEWSLETTER_REPLY_TO = 'dan@danpearson.net';
const UNSUBSCRIBE_MAILTO = 'mailto:dan@danpearson.net?subject=Unsubscribe';

/** Public base of the edge functions server, for the one-click endpoint. */
export function functionsBaseUrl(): string {
  return (Deno.env.get('FUNCTIONS_URL') || 'https://functions.danpearson.net').replace(/\/+$/, '');
}

export function confirmPageUrl(token: string): string {
  return `${SITE_URL}/newsletter/confirm?token=${encodeURIComponent(token)}`;
}

export function unsubscribePageUrl(token: string): string {
  return `${SITE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function oneClickUnsubscribeUrl(token: string, base: string = functionsBaseUrl()): string {
  return `${base}/newsletter-unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * RFC 2369 + RFC 8058 headers. Gmail and Yahoo show their own unsubscribe
 * button from these and POST `List-Unsubscribe=One-Click` to the HTTPS URL.
 */
export function listUnsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${oneClickUrl}>, <${UNSUBSCRIBE_MAILTO}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function page(subject: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background: #ffffff;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 20px; font-family: Georgia, 'Times New Roman', serif; font-size: 17px; line-height: 1.6; color: #1f2328;">
${body}
  </div>
</body>
</html>`;
}

const CONFIRM_SUBJECT = 'Confirm your subscription to the pipeline notes';

export function confirmationEmail(confirmUrl: string): RenderedEmail {
  const url = escapeHtml(confirmUrl);
  const text = `Someone, hopefully you, asked to get Dan Pearson's pipeline notes at this address.

Confirm your subscription:
${confirmUrl}

The link works for 7 days. If this wasn't you, ignore this email and you won't hear from me again.

Dan Pearson
https://danpearson.net`;

  const html = page(
    CONFIRM_SUBJECT,
    `    <p style="margin: 0 0 20px;">Someone, hopefully you, asked to get Dan Pearson's pipeline notes at this address.</p>
    <p style="margin: 0 0 20px;"><a href="${url}" style="display: inline-block; padding: 10px 18px; background: #0b5cad; color: #ffffff; text-decoration: none; border-radius: 6px; font-family: Arial, Helvetica, sans-serif; font-size: 15px;">Confirm my subscription</a></p>
    <p style="margin: 0 0 20px; font-size: 14px; color: #57606a;">Or paste this into your browser:<br><a href="${url}" style="color: #0b5cad; word-break: break-all;">${url}</a></p>
    <p style="margin: 0 0 20px;">The link works for 7 days. If this wasn't you, ignore this email and you won't hear from me again.</p>
    <p style="margin: 0;">Dan Pearson</p>`
  );

  return { subject: CONFIRM_SUBJECT, html, text };
}

export const WELCOME_SUBJECT = "You're on the list: pipeline notes from Dan Pearson";

export function welcomeEmail(unsubscribeUrl: string): RenderedEmail {
  const unsub = escapeHtml(unsubscribeUrl);
  const text = `Thanks for signing up.

Here's what you'll get from me: teardowns of real CRM automations (what the workflow does, where it breaks, what it cost to run) and step-by-step guides you can copy into your own pipeline. No filler, and not more than a couple of emails a month.

Start here:
- AI CRM automation, the overview: https://danpearson.net/ai-crm-automation
- Every guide on the topic: https://danpearson.net/topics/ai-crm-automation

If you're working on something specific, reply to this email. I read every one.

Dan Pearson
https://danpearson.net
LinkedIn: https://www.linkedin.com/in/danpearson
GitHub: https://github.com/dj-pearson

You're getting this because you subscribed at danpearson.net. Unsubscribe: ${unsubscribeUrl}`;

  const html = page(
    WELCOME_SUBJECT,
    `    <p style="margin: 0 0 20px;">Thanks for signing up.</p>
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
      <a href="${unsub}" style="color: #57606a;">Unsubscribe</a>
    </p>`
  );

  return { subject: WELCOME_SUBJECT, html, text };
}
