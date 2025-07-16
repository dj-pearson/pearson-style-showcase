import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticator } from "https://esm.sh/otplib@12.0.1";
import { hash, verify } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cookie",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

interface ForgotPasswordRequest {
  email: string;
}

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

async function handleLogin(request: Request, data?: any): Promise<Response> {
  const clientIP = request.headers.get("x-forwarded-for") || "unknown";
  
  // Check rate limiting
  if (!checkRateLimit(clientIP)) {
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

  const requestData = data || await request.json();
  const { email, password, totpCode } = requestData;

  try {
    // Get user from database
    const { data: user, error: userError } = await supabase
      .from("admin_users")
      .select("*")
      .eq("email", email)
      .single();

    if (userError || !user) {
      recordFailedAttempt(clientIP);
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if account is locked
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      return new Response(
        JSON.stringify({ error: "Account is temporarily locked" }),
        { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password
    const isValidPassword = await verify(password, user.password_hash);
    if (!isValidPassword) {
      recordFailedAttempt(clientIP);
      
      // Update failed login attempts
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      let updateData: any = { failed_login_attempts: failedAttempts };
      
      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        updateData.account_locked_until = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      }
      
      await supabase
        .from("admin_users")
        .update(updateData)
        .eq("id", user.id);
      
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check 2FA if enabled
    if (user.two_factor_enabled) {
      if (!totpCode) {
        return new Response(
          JSON.stringify({ requiresTOTP: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isValidTOTP = authenticator.verify({
        token: totpCode,
        secret: user.two_factor_secret
      });

      if (!isValidTOTP) {
        recordFailedAttempt(clientIP);
        return new Response(
          JSON.stringify({ error: "Invalid 2FA code" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store session in database
    const { error: sessionError } = await supabase
      .from("admin_sessions")
      .insert({
        user_id: user.id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        ip_address: clientIP,
        user_agent: request.headers.get("user-agent") || ""
      });

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user login info
    await supabase
      .from("admin_users")
      .update({
        last_login: new Date().toISOString(),
        failed_login_attempts: 0,
        account_locked_until: null
      })
      .eq("id", user.id);

    // Clear failed attempts
    clearFailedAttempts(clientIP);

    // Set session cookie
    const response = new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          two_factor_enabled: user.two_factor_enabled
        }
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Set-Cookie": `admin_session=${sessionToken}; HttpOnly; Secure; Path=/; Max-Age=86400`
        } 
      }
    );

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleForgotPassword(request: Request, data?: any): Promise<Response> {
  const requestData = data || await request.json();
  const { email } = requestData;

  try {
    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("admin_users")
      .select("id, email")
      .eq("email", email)
      .single();

    if (userError || !user) {
      // Don't reveal if user exists for security
      return new Response(
        JSON.stringify({ success: true, message: "If the email exists, a reset link has been sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate reset token
    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    const { error: tokenError } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: user.id,
        token: resetToken,
        expires_at: expiresAt.toISOString()
      });

    if (tokenError) {
      console.error("Token creation error:", tokenError);
      return new Response(
        JSON.stringify({ error: "Failed to create reset token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Send email with reset link
    // For now, just return success
    console.log(`Password reset token for ${email}: ${resetToken}`);

    return new Response(
      JSON.stringify({ success: true, message: "Password reset email sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleGetUser(request: Request): Promise<Response> {
  const cookies = request.headers.get("cookie");
  const sessionToken = cookies?.split(";")
    .find(c => c.trim().startsWith("admin_session="))
    ?.split("=")[1];

  if (!sessionToken) {
    return new Response(
      JSON.stringify({ error: "No session" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from("admin_sessions")
      .select("user_id, expires_at")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Session expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user data
    const { data: user, error: userError } = await supabase
      .from("admin_users")
      .select("id, email, username, two_factor_enabled, last_login, created_at")
      .eq("id", session.user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(user),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get user error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleLogout(request: Request): Promise<Response> {
  const cookies = request.headers.get("cookie");
  const sessionToken = cookies?.split(";")
    .find(c => c.trim().startsWith("admin_session="))
    ?.split("=")[1];

  if (sessionToken) {
    // Delete session from database
    await supabase
      .from("admin_sessions")
      .delete()
      .eq("session_token", sessionToken);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { 
      status: 200, 
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Set-Cookie": "admin_session=; HttpOnly; Secure; Path=/; Max-Age=0"
      } 
    }
  );
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

  const url = new URL(req.url);
  const path = url.pathname;

  console.log(`Admin Auth Request: ${req.method} ${path}`);

  try {
  if (path.endsWith("/login") && req.method === "POST") {
    const { action, email, password, totpCode } = await req.json();
    return await handleLogin(req, { email, password, totpCode });
  }
  
  if (path.endsWith("/forgot-password") && req.method === "POST") {
    const { action, email } = await req.json();
    return await handleForgotPassword(req, { email });
  }
  
  if (path.endsWith("/me") && req.method === "GET") {
    return await handleGetUser(req);
  }
  
  if (path.endsWith("/logout") && req.method === "POST") {
    return await handleLogout(req);
  }

  // Handle actions from function body for Supabase client calls  
  const requestBody = await req.text();
  let bodyData = {};
  
  try {
    bodyData = requestBody ? JSON.parse(requestBody) : {};
  } catch (e) {
    // Handle non-JSON requests
  }

  if (bodyData.action === 'login') {
    return await handleLogin(req, bodyData);
  }
  
  if (bodyData.action === 'forgot-password') {
    return await handleForgotPassword(req, bodyData);
  }
  
  if (bodyData.action === 'me') {
    return await handleGetUser(req);
  }
  
  if (bodyData.action === 'logout') {
    return await handleLogout(req);
  }

    return new Response(
      JSON.stringify({ error: "Not found", path, method: req.method }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Request error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});