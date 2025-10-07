import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://danpearson.net", // TODO: Update to your domain
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cookie",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

// Admin email whitelist - only these emails can access admin
const ADMIN_EMAILS = [
  'dan@danpearson.net',
  'pearsonperformance@gmail.com'
];

// Rate limiting map
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  
  if (attempts) {
    if (now - attempts.lastAttempt < LOCKOUT_TIME && attempts.count >= MAX_ATTEMPTS) {
      return false;
    }
    if (now - attempts.lastAttempt > LOCKOUT_TIME) {
      loginAttempts.delete(ip);
    }
  }
  
  return true;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
  
  attempts.count++;
  attempts.lastAttempt = now;
  loginAttempts.set(ip, attempts);
}

function clearFailedAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
      } 
    });
  }

  console.log(`Admin Auth Request: ${req.method} ${req.url}`);

  try {
    const requestBody = await req.text();
    console.log("Request body:", requestBody);

    let bodyData: any = {};
    
    try {
      bodyData = requestBody ? JSON.parse(requestBody) : {};
    } catch (e) {
      console.error("Error parsing JSON:", e);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, email, password } = bodyData;
    console.log("Parsed action:", action);

    // Handle login action
    if (action === 'login') {
      const clientIP = req.headers.get("x-forwarded-for") || "unknown";
      
      console.log("Login attempt - Email:", email, "IP:", clientIP);
      
      // Check rate limiting
      if (!checkRateLimit(clientIP)) {
        console.log("Rate limit exceeded for IP:", clientIP);
        return new Response(
          JSON.stringify({ 
            error: "Too many login attempts. Please try again later." 
          }),
          { 
            status: 429, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      if (!email || !password) {
        console.log("Missing email or password");
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if email is in admin whitelist
      if (!ADMIN_EMAILS.includes(email)) {
        console.log("Email not in admin whitelist:", email);
        recordFailedAttempt(clientIP);
        return new Response(
          JSON.stringify({ error: "Access denied. Not authorized for admin access." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Attempting Supabase Auth login for:", email);

      // Use Supabase Auth to authenticate
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log("Supabase Auth result:", { 
        success: !!authData.user, 
        email: authData.user?.email, 
        error: authError?.message 
      });

      if (authError || !authData.user) {
        console.log("Authentication failed:", authError?.message);
        recordFailedAttempt(clientIP);
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store admin session
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      console.log("Creating admin session for:", authData.user.email);

      const { error: sessionError } = await supabase
        .from("admin_sessions")
        .insert({
          user_id: authData.user.id,
          session_token: sessionToken,
          expires_at: expiresAt.toISOString(),
          ip_address: clientIP,
          user_agent: req.headers.get("user-agent") || ""
        });

      if (sessionError) {
        console.error("Session creation error:", sessionError);
        // Continue anyway, we have successful auth
      }

      // Clear failed attempts
      clearFailedAttempts(clientIP);

      console.log("Login successful for:", email);

      return new Response(
        JSON.stringify({ 
          success: true, 
          user: {
            id: authData.user.id,
            email: authData.user.email,
            username: authData.user.email.split('@')[0],
            two_factor_enabled: false
          }
        }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json"
          } 
        }
      );
    }

    // Handle session verification - verify actual authentication
    if (action === 'me') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        console.error('No authorization header provided');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the JWT token and get the user
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        console.error('Invalid token or user not found:', error);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user is in admin whitelist
      if (!ADMIN_EMAILS.includes(user.email || '')) {
        console.error('User not in admin whitelist:', user.email);
        return new Response(
          JSON.stringify({ error: 'Forbidden - Not an admin' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user has admin role in user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (roleError || !roleData) {
        console.error('User does not have admin role in database:', user.email);
        return new Response(
          JSON.stringify({ error: 'Forbidden - Admin role not assigned' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Admin authenticated successfully:', user.email);
      return new Response(
        JSON.stringify({ 
          id: user.id,
          email: user.email,
          username: user.email?.split('@')[0] || 'admin',
          two_factor_enabled: false,
          last_login: new Date().toISOString(),
          created_at: user.created_at
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'logout') {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'forgot-password') {
      const { email } = bodyData;
      
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if email is in admin whitelist
      if (!ADMIN_EMAILS.includes(email)) {
        return new Response(
          JSON.stringify({ success: true, message: "If the email exists, a reset link has been sent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Sending password reset for:", email);

      // Use Supabase Auth password reset
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${req.headers.get("origin")}/admin/reset-password`
      });

      if (resetError) {
        console.error("Password reset error:", resetError);
        return new Response(
          JSON.stringify({ error: "Failed to send reset email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password reset email sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action", action, available: ["login", "me", "logout", "forgot-password"] }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Request error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});