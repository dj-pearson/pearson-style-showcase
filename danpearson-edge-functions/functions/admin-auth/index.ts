import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Track locked accounts to avoid sending duplicate emails
const lockoutNotificationsSent = new Map<string, number>();
const LOCKOUT_NOTIFICATION_COOLDOWN = 60 * 60 * 1000; // 1 hour cooldown between notifications

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://danpearson.net",
  "https://53293242-1a3e-40cf-bf21-2a4867985711.lovableproject.com",
  "https://9bf99955-d7e1-4b0d-8abc-f62199d56772.lovableproject.com",
  "https://id-preview--53293242-1a3e-40cf-bf21-2a4867985711.lovable.app",
  "https://id-preview--9bf99955-d7e1-4b0d-8abc-f62199d56772.lovable.app",
  "https://pearson-style-showcase.lovable.app",
  "https://preview--pearson-style-showcase.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173"
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cookie",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
};

// Helper function to check if email is in database whitelist
async function isEmailWhitelisted(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('admin_whitelist')
    .select('id')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  return !error && !!data;
}

// Helper function to get user roles from database
async function getUserRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !data) return [];
  return data.map(r => r.role);
}

// Helper function to get user permissions from database
async function getUserPermissions(userId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_user_permissions', {
    _user_id: userId
  });

  if (error || !data) return [];
  return data.map((p: { permission_name: string }) => p.permission_name);
}

// Helper function to ensure user has admin role in user_roles table
async function ensureAdminRole(userId: string, email: string): Promise<boolean> {
  // Check if user already has admin role
  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .single();

  if (existingRole) return true;

  // Insert admin role for whitelisted user
  const { error: insertError } = await supabase
    .from('user_roles')
    .insert({
      user_id: userId,
      role: 'admin',
      is_active: true
    });

  if (insertError) {
    console.error('Failed to assign admin role:', insertError);
    return false;
  }

  console.log('Auto-assigned admin role to whitelisted user:', email);
  return true;
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

/**
 * Send account lockout notification email
 */
async function sendLockoutNotification(
  email: string,
  ip: string,
  userAgent: string,
  attemptCount: number
): Promise<void> {
  // Check cooldown to avoid spam
  const lastNotification = lockoutNotificationsSent.get(email);
  if (lastNotification && Date.now() - lastNotification < LOCKOUT_NOTIFICATION_COOLDOWN) {
    console.log(`Skipping lockout notification for ${email} - cooldown active`);
    return;
  }

  const smtpHost = Deno.env.get('AMAZON_SMTP_ENDPOINT');
  const smtpUsername = Deno.env.get('AMAZON_SMTP_USER_NAME');
  const smtpPassword = Deno.env.get('AMAZON_SMTP_PASSWORD');

  // If SMTP is not configured, log and continue (non-critical)
  if (!smtpHost || !smtpUsername || !smtpPassword) {
    console.warn('SMTP not configured - skipping lockout notification email');
    // Still log the event to the database
    await logLockoutEvent(email, ip, userAgent, attemptCount, false);
    return;
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: 465, // Use TLS port
        tls: true,
        auth: {
          username: smtpUsername,
          password: smtpPassword,
        },
      },
    });

    const lockoutTime = new Date().toISOString();
    const unlockTime = new Date(Date.now() + LOCKOUT_TIME).toISOString();

    const subject = '🔒 Security Alert: Account Locked Due to Failed Login Attempts';
    const body = `
Security Alert - Account Temporarily Locked

Your admin account (${email}) has been temporarily locked due to ${attemptCount} failed login attempts.

Lockout Details:
• Time: ${lockoutTime}
• IP Address: ${ip}
• Browser/Device: ${userAgent}
• Lock Duration: 15 minutes
• Unlock Time: ${unlockTime}

If this was you:
Please wait 15 minutes before attempting to log in again. Make sure you're using the correct password.

If this wasn't you:
Someone may be trying to access your account. We recommend:
1. Changing your password immediately once the lockout expires
2. Enabling two-factor authentication if not already enabled
3. Reviewing your recent account activity

For assistance, contact support.

---
This is an automated security notification from Dan Pearson Admin Portal.
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .alert-box { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .details { background: #f8f9fa; border-radius: 4px; padding: 15px; margin: 15px 0; }
    .warning { color: #856404; font-weight: bold; }
    h1 { color: #dc3545; }
    ul { margin: 10px 0; padding-left: 20px; }
  </style>
</head>
<body>
  <h1>🔒 Security Alert - Account Temporarily Locked</h1>

  <div class="alert-box">
    <p class="warning">Your admin account (${email}) has been temporarily locked due to ${attemptCount} failed login attempts.</p>
  </div>

  <div class="details">
    <h3>Lockout Details:</h3>
    <ul>
      <li><strong>Time:</strong> ${lockoutTime}</li>
      <li><strong>IP Address:</strong> ${ip}</li>
      <li><strong>Browser/Device:</strong> ${userAgent}</li>
      <li><strong>Lock Duration:</strong> 15 minutes</li>
      <li><strong>Unlock Time:</strong> ${unlockTime}</li>
    </ul>
  </div>

  <h3>If this was you:</h3>
  <p>Please wait 15 minutes before attempting to log in again. Make sure you're using the correct password.</p>

  <h3>If this wasn't you:</h3>
  <p>Someone may be trying to access your account. We recommend:</p>
  <ol>
    <li>Changing your password immediately once the lockout expires</li>
    <li>Enabling two-factor authentication if not already enabled</li>
    <li>Reviewing your recent account activity</li>
  </ol>

  <p>For assistance, contact support.</p>

  <hr>
  <p style="color: #666; font-size: 12px;">This is an automated security notification from Dan Pearson Admin Portal.</p>
</body>
</html>
    `.trim();

    await client.send({
      from: smtpUsername,
      to: email,
      subject: subject,
      content: body,
      html: htmlBody,
    });

    await client.close();

    // Track that we sent this notification
    lockoutNotificationsSent.set(email, Date.now());

    console.log(`Lockout notification sent to ${email}`);

    // Log the event to the database
    await logLockoutEvent(email, ip, userAgent, attemptCount, true);

  } catch (error) {
    console.error('Failed to send lockout notification:', error);
    // Still log the event even if email fails
    await logLockoutEvent(email, ip, userAgent, attemptCount, false);
  }
}

/**
 * Log lockout event to the database for audit trail
 */
async function logLockoutEvent(
  email: string,
  ip: string,
  userAgent: string,
  attemptCount: number,
  notificationSent: boolean
): Promise<void> {
  try {
    await supabase.from('security_events').insert({
      event_type: 'account_lockout',
      email: email,
      ip_address: ip,
      user_agent: userAgent,
      metadata: {
        attempt_count: attemptCount,
        lockout_duration_minutes: 15,
        notification_sent: notificationSent,
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Non-critical - just log
    console.error('Failed to log lockout event:', error);
  }
}

/**
 * Log login attempt to the database for security audit
 */
async function logLoginAttempt(
  email: string,
  ip: string,
  userAgent: string,
  success: boolean,
  failureReason?: string,
  userId?: string,
  authProvider: string = 'email'
): Promise<void> {
  try {
    // Get geolocation info from IP (using free API)
    let geoData: { country?: string; city?: string; region?: string } = {};
    try {
      if (ip !== 'unknown' && ip !== '::1' && ip !== '127.0.0.1') {
        const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`, {
          signal: AbortSignal.timeout(2000), // 2 second timeout
        });
        if (geoResponse.ok) {
          const geo = await geoResponse.json();
          geoData = {
            country: geo.country_name,
            city: geo.city,
            region: geo.region,
          };
        }
      }
    } catch {
      // Geolocation is best-effort, don't fail if it doesn't work
      console.log('Geolocation lookup skipped or failed');
    }

    // Parse user agent for device info
    const deviceInfo = parseUserAgent(userAgent);

    // Log to security_events table
    await supabase.from('security_events').insert({
      event_type: success ? 'login_success' : 'login_failure',
      email: email,
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      metadata: {
        auth_provider: authProvider,
        failure_reason: failureReason,
        geolocation: geoData,
        device: deviceInfo,
        timestamp_utc: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    // Also log to admin_activity_log for successful logins
    if (success && userId) {
      await supabase.from('admin_activity_log').insert({
        admin_id: userId,
        admin_email: email,
        action: 'LOGIN',
        action_category: 'authentication',
        ip_address: ip,
        user_agent: userAgent,
        success: true,
        metadata: {
          auth_provider: authProvider,
          geolocation: geoData,
          device: deviceInfo,
        },
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`Login attempt logged: ${email} - ${success ? 'SUCCESS' : 'FAILED'} - ${ip}`);
  } catch (error) {
    // Non-critical - just log
    console.error('Failed to log login attempt:', error);
  }
}

/**
 * Parse user agent string to extract device information
 */
function parseUserAgent(userAgent: string): {
  browser: string;
  os: string;
  device: string;
} {
  const ua = userAgent.toLowerCase();

  // Browser detection
  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

  // OS detection
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macos')) os = 'macOS';
  else if (ua.includes('linux') && !ua.includes('android')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  // Device type detection
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android') && !ua.includes('tablet')) device = 'Mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) device = 'Tablet';

  return { browser, os, device };
}

/**
 * Check if an account should be locked and send notification if so
 */
function checkAndHandleLockout(ip: string, email: string, userAgent: string): boolean {
  const attempts = loginAttempts.get(ip);

  if (attempts && attempts.count >= MAX_ATTEMPTS) {
    // Account is being locked - send notification
    sendLockoutNotification(email, ip, userAgent, attempts.count).catch(err => {
      console.error('Async lockout notification failed:', err);
    });
    return true;
  }

  return false;
}

// Export default handler for the edge functions server
export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

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
      const userAgent = req.headers.get("user-agent") || "unknown";

      console.log("Login attempt - Email:", email, "IP:", clientIP);

      // Check rate limiting
      if (!checkRateLimit(clientIP)) {
        console.log("Rate limit exceeded for IP:", clientIP);

        // Send lockout notification if email is provided
        if (email) {
          sendLockoutNotification(email, clientIP, userAgent, MAX_ATTEMPTS).catch(err => {
            console.error('Failed to send lockout notification:', err);
          });
        }

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

      // Check if email is in admin whitelist (database lookup)
      const isWhitelisted = await isEmailWhitelisted(email);
      if (!isWhitelisted) {
        console.log("Email not in admin whitelist:", email);
        recordFailedAttempt(clientIP);

        // Log failed attempt
        logLoginAttempt(email, clientIP, userAgent, false, 'not_whitelisted').catch(err => {
          console.error('Failed to log login attempt:', err);
        });

        // Check if this attempt triggered a lockout
        checkAndHandleLockout(clientIP, email, userAgent);

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

        // Log failed attempt
        logLoginAttempt(email, clientIP, userAgent, false, 'invalid_credentials').catch(err => {
          console.error('Failed to log login attempt:', err);
        });

        // Check if this attempt triggered a lockout
        checkAndHandleLockout(clientIP, email, userAgent);

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

      // Ensure user has admin role in user_roles table
      await ensureAdminRole(authData.user.id, email);

      // Get user roles and permissions
      const roles = await getUserRoles(authData.user.id);
      const permissions = await getUserPermissions(authData.user.id);

      // Clear failed attempts
      clearFailedAttempts(clientIP);

      // Log successful login
      logLoginAttempt(email, clientIP, userAgent, true, undefined, authData.user.id, 'email').catch(err => {
        console.error('Failed to log login attempt:', err);
      });

      console.log("Login successful for:", email);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: authData.user.id,
            email: authData.user.email,
            username: authData.user.email.split('@')[0],
            two_factor_enabled: false,
            roles,
            permissions
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
    // This is called both for email/password and OAuth logins
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

      // Determine auth provider (for logging and debugging)
      const authProvider = user.app_metadata?.provider || 'email';
      console.log(`Admin verification for ${user.email} (provider: ${authProvider})`);

      // Verify user is in admin whitelist (database lookup)
      const isWhitelisted = await isEmailWhitelisted(user.email || '');
      if (!isWhitelisted) {
        console.error(`User not in admin whitelist: ${user.email} (provider: ${authProvider})`);
        return new Response(
          JSON.stringify({ error: 'Forbidden - Not an admin' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Ensure user has admin role (auto-assign if whitelisted but missing role)
      const hasRole = await ensureAdminRole(user.id, user.email || '');
      if (!hasRole) {
        console.error('Failed to ensure admin role for:', user.email);
        return new Response(
          JSON.stringify({ error: 'Forbidden - Admin role not assigned' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user roles and permissions
      const roles = await getUserRoles(user.id);
      const permissions = await getUserPermissions(user.id);

      // Create/update admin session for OAuth users
      if (authProvider !== 'email') {
        const clientIP = req.headers.get("x-forwarded-for") || "unknown";
        const sessionToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await supabase
          .from("admin_sessions")
          .upsert({
            user_id: user.id,
            session_token: sessionToken,
            expires_at: expiresAt.toISOString(),
            ip_address: clientIP,
            user_agent: req.headers.get("user-agent") || ""
          }, {
            onConflict: 'user_id'
          });
      }

      console.log(`Admin authenticated successfully: ${user.email} (provider: ${authProvider})`);
      return new Response(
        JSON.stringify({
          id: user.id,
          email: user.email,
          username: user.email?.split('@')[0] || 'admin',
          auth_provider: authProvider,
          two_factor_enabled: false,
          last_login: new Date().toISOString(),
          created_at: user.created_at,
          roles,
          permissions
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

      // Check if email is in admin whitelist (database lookup)
      const isWhitelisted = await isEmailWhitelisted(email);
      if (!isWhitelisted) {
        // Return success to prevent email enumeration
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
    // Log full error details server-side only for debugging
    console.error("Request error:", error);

    // Return generic error message to client (security best practice)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};