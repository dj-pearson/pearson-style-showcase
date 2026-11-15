import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitResponse,
  initRateLimiter,
  type RateLimitConfig,
} from '../_shared/rate-limiter.ts';
import { validateEmail, sanitizeInput, escapeHtml, messageToHtml } from './validation.ts';
import { createEdgeFunctionLogger } from '../_shared/production-logger.ts';

const baseLogger = createEdgeFunctionLogger('send-contact-email');

// Where contact form submissions are delivered. Overridable per environment;
// the fallback matches the owner address send-notification-email defaults to.
const CONTACT_RECIPIENT = Deno.env.get('CONTACT_EMAIL') || 'pearsonperformance@gmail.com';

// Verified sending identity. resend.dev senders only deliver to the Resend
// account owner, which silently drops the confirmation to the submitter.
const CONTACT_FROM = Deno.env.get('CONTACT_FROM') || 'Dan Pearson <noreply@danpearson.net>';

// Initialize rate limiter
initRateLimiter();

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Custom rate limit config for contact form (stricter than default)
const CONTACT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 emails per hour per IP
  burstAllowance: 1, // Allow 1 extra in burst
  keyPrefix: 'contact',
};

// Input validation
// Input validation / sanitization lives in ./validation.ts (imported at top).

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const log = baseLogger.forRequest(req);

  // Built per request: at module scope a missing key threw on import, so the
  // server answered every call with a generic 500 and no hint why.
  const resendKey = Deno.env.get('RESEND_API');
  if (!resendKey) {
    log.error('RESEND_API is not set; contact form cannot send');
    return new Response(JSON.stringify({ error: 'Contact form is temporarily unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const resend = new Resend(resendKey);

  try {
    // Get client IP for rate limiting
    const ip = getClientIdentifier(req);

    // Check rate limit using shared rate limiter
    const rateLimitResult = checkRateLimit(ip, CONTACT_RATE_LIMIT, 'contact-form');
    if (!rateLimitResult.allowed) {
      // The logger masks the address to its first octet.
      log.warn('Contact form rate limit exceeded', { ip });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const data: ContactFormData = await req.json();

    // Validate and sanitize inputs
    const name = sanitizeInput(data.name, 100);
    const email = sanitizeInput(data.email, 255);
    const subject = sanitizeInput(data.subject, 200);
    const message = sanitizeInput(data.message, 5000);

    // Server-side validation
    if (!name || name.length < 2) {
      return new Response(JSON.stringify({ error: 'Name must be at least 2 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!subject || subject.length < 3) {
      return new Response(JSON.stringify({ error: 'Subject must be at least 3 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!message || message.length < 10) {
      return new Response(JSON.stringify({ error: 'Message must be at least 10 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Send email to site owner
    const emailResponse = await resend.emails.send({
      from: CONTACT_FROM,
      to: [CONTACT_RECIPIENT],
      // resend@2.0.0 takes snake_case here. camelCase replyTo was not added
      // until v3.2, so spelling it that way against this pin silently drops the
      // header and replies go to CONTACT_FROM instead of the sender.
      reply_to: email,
      subject: `Contact Form: ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <hr />
        <h3>Message:</h3>
        <p>${messageToHtml(message)}</p>
      `,
    });

    if (emailResponse.error) {
      throw new Error(`Resend rejected the owner email: ${emailResponse.error.message}`);
    }
    log.info('Contact email delivered to owner', { resend_id: emailResponse.data?.id });

    // Send confirmation email to sender. The recipient address is whatever the
    // caller typed, so nothing they submitted (name, subject, message) goes in
    // this body; echoing it would let anyone relay their own text to any inbox
    // from our verified sender.
    const confirmation = await resend.emails.send({
      from: CONTACT_FROM,
      to: [email],
      subject: 'Thank you for contacting us!',
      html: `
        <h1>Thank you for reaching out!</h1>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <hr />
        <p>Best regards,<br>Dan Pearson</p>
      `,
    });

    if (confirmation.error) {
      // The owner already has the message; a failed courtesy copy shouldn't
      // make the visitor resubmit.
      log.warn('Confirmation email to submitter failed', {
        error: confirmation.error.message,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message sent successfully!',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    log.error('send-contact-email failed', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to send message. Please try again later.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

export default handler;
