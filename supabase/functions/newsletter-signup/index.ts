import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://danpearson.net", // TODO: Update to your domain
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscribeRequest {
  email: string;
}

// Rate limiting map: IP -> { count, resetTime }
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5; // 5 requests
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

// Disposable email domains to block
const DISPOSABLE_DOMAINS = ['tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email'];

function validateEmail(email: string): { valid: boolean; error?: string } {
  // Trim and lowercase
  const normalized = email.trim().toLowerCase();
  
  // Length check
  if (normalized.length > 255) {
    return { valid: false, error: 'Email address is too long' };
  }
  
  // Comprehensive email regex
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  
  if (!emailRegex.test(normalized)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  // Check for disposable domains
  const domain = normalized.split('@')[1];
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    return { valid: false, error: 'Disposable email addresses are not allowed' };
  }
  
  return { valid: true };
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { email: rawEmail }: SubscribeRequest = await req.json();

    // Validate and normalize email
    const validation = validateEmail(rawEmail);
    if (!validation.valid) {
      console.warn(`Invalid email submission: ${rawEmail} - ${validation.error}`);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const email = rawEmail.trim().toLowerCase();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if email already exists
    const { data: existingSubscriber } = await supabase
      .from('newsletter_subscribers')
      .select('id, active')
      .eq('email', email)
      .single();

    if (existingSubscriber) {
      if (existingSubscriber.active) {
        return new Response(
          JSON.stringify({ message: "You're already subscribed!" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } else {
        // Reactivate subscription
        await supabase
          .from('newsletter_subscribers')
          .update({ active: true, subscribed_at: new Date().toISOString() })
          .eq('email', email);
      }
    } else {
      // Add new subscriber
      const { error: insertError } = await supabase
        .from('newsletter_subscribers')
        .insert([{ email }]);

      if (insertError) {
        console.error('Database error:', insertError);
        return new Response(
          JSON.stringify({ error: "Failed to subscribe" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Send welcome email
    const resend = new Resend(Deno.env.get("RESEND_API"));
    
    const welcomeEmailResponse = await resend.emails.send({
      from: "Dan Pearson <noreply@danpearson.net>",
      to: [email],
      subject: "Welcome to Dan Pearson's Newsletter! 🚀",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Dan Pearson's Newsletter</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">Welcome aboard! 🎉</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Thanks for joining the Dan Pearson community</p>
          </div>
          
          <div style="background: #f8fafc; padding: 25px; border-radius: 8px; border-left: 4px solid #0ea5e9;">
            <h2 style="color: #1e293b; margin-top: 0;">What to expect:</h2>
            <ul style="color: #64748b; padding-left: 20px;">
              <li><strong>🚀 Project Updates:</strong> Behind-the-scenes looks at my latest AI and blockchain projects</li>
              <li><strong>💡 Tech Insights:</strong> Lessons learned from building innovative solutions</li>
              <li><strong>📈 Business Tips:</strong> Strategies for growing tech businesses</li>
              <li><strong>🔮 Industry Trends:</strong> My take on where AI and web3 are heading</li>
            </ul>
          </div>
          
          <div style="margin: 30px 0; text-align: center;">
            <h3 style="color: #1e293b;">Explore My Work</h3>
            <div style="display: inline-block; margin: 10px;">
              <a href="https://danpearson.net/projects" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Projects</a>
            </div>
            <div style="display: inline-block; margin: 10px;">
              <a href="https://danpearson.net/ai-tools" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">AI Tools</a>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e2e8f0; margin-top: 30px; color: #64748b;">
            <p style="margin: 0;">Follow me for more updates:</p>
            <div style="margin: 15px 0;">
              <a href="https://linkedin.com/in/danpearson" style="color: #0ea5e9; text-decoration: none; margin: 0 10px;">LinkedIn</a> |
              <a href="https://twitter.com/danpearson" style="color: #0ea5e9; text-decoration: none; margin: 0 10px;">Twitter</a> |
              <a href="https://github.com/danpearson" style="color: #0ea5e9; text-decoration: none; margin: 0 10px;">GitHub</a>
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin: 15px 0 0 0;">
              You're receiving this because you subscribed to updates from danpearson.net
              <br>
              <a href="mailto:dan@danpearson.net" style="color: #94a3b8;">Unsubscribe</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log('Welcome email sent:', welcomeEmailResponse);

    // Mark welcome email as sent
    await supabase
      .from('newsletter_subscribers')
      .update({ welcome_email_sent: true })
      .eq('email', email);

    return new Response(
      JSON.stringify({ 
        message: "Successfully subscribed! Check your inbox for a welcome email.",
        emailSent: true 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error in newsletter signup:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);