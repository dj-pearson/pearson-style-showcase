import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitResponse,
  initRateLimiter,
  type RateLimitConfig,
} from "../_shared/rate-limiter.ts";

const resend = new Resend(Deno.env.get("RESEND_API"));

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
  maxRequests: 3,           // 3 emails per hour per IP
  burstAllowance: 1,        // Allow 1 extra in burst
  keyPrefix: 'contact',
};

// Input validation
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function sanitizeInput(input: string, maxLength: number): string {
  return input.trim().slice(0, maxLength);
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get client IP for rate limiting
    const ip = getClientIdentifier(req);

    console.log(`Contact form submission from IP: ${ip}`);

    // Check rate limit using shared rate limiter
    const rateLimitResult = checkRateLimit(ip, CONTACT_RATE_LIMIT, 'contact-form');
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for IP: ${ip}`);
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
      return new Response(
        JSON.stringify({ error: "Name must be at least 2 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!validateEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!subject || subject.length < 3) {
      return new Response(
        JSON.stringify({ error: "Subject must be at least 3 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!message || message.length < 10) {
      return new Response(
        JSON.stringify({ error: "Message must be at least 10 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending contact email from: ${email}`);

    // Send email to site owner
    const emailResponse = await resend.emails.send({
      from: "Build Desk Contact <onboarding@resend.dev>",
      to: ["your-email@example.com"], // Replace with actual recipient email
      replyTo: email,
      subject: `Contact Form: ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr />
        <h3>Message:</h3>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Send confirmation email to sender
    await resend.emails.send({
      from: "Build Desk <onboarding@resend.dev>",
      to: [email],
      subject: "Thank you for contacting us!",
      html: `
        <h1>Thank you for reaching out, ${name}!</h1>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <p><strong>Your message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr />
        <p>Best regards,<br>The Build Desk Team</p>
      `,
    };

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Message sent successfully!" 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to send message. Please try again later." 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
