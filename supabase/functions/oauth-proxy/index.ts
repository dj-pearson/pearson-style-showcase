/**
 * OAuth Proxy Edge Function
 * Bypasses GoTrue's GOTRUE_SITE_URL limitation for self-hosted Supabase
 *
 * Flow:
 * 1. Frontend redirects to ?action=authorize&provider=google
 * 2. This function redirects to Google/Apple OAuth
 * 3. Provider redirects back to ?action=callback with auth code
 * 4. This function exchanges code for tokens, creates/finds Supabase user
 * 5. Generates magic link and redirects to frontend /auth/callback
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { normalizedErrorResponse, classifyError } from "../_shared/error-normalizer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Configuration from environment variables
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://danpearson.net';
const FUNCTIONS_URL = Deno.env.get('FUNCTIONS_URL') || 'https://functions.danpearson.net';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://api.danpearson.net';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const APPLE_CLIENT_ID = Deno.env.get('APPLE_CLIENT_ID') || '';
const APPLE_CLIENT_SECRET = Deno.env.get('APPLE_CLIENT_SECRET') || '';
const OAUTH_STATE_SECRET = Deno.env.get('OAUTH_STATE_SECRET') || SUPABASE_SERVICE_ROLE_KEY;

/**
 * Sign the OAuth state with HMAC-SHA256 to prevent tampering.
 * Format: base64(json).signature
 */
async function signState(stateData: Record<string, unknown>): Promise<string> {
  const encoder = new TextEncoder();
  const payload = btoa(JSON.stringify(stateData));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(OAUTH_STATE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${payload}.${sigB64}`;
}

/**
 * Verify and decode HMAC-signed OAuth state.
 * Returns parsed state data or null if signature is invalid.
 */
async function verifyState(state: string): Promise<Record<string, unknown> | null> {
  const dotIndex = state.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const payload = state.substring(0, dotIndex);
  const sigB64 = state.substring(dotIndex + 1);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(OAUTH_STATE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Restore base64 padding for verification
  const normalizedSig = sigB64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalizedSig + '='.repeat((4 - normalizedSig.length % 4) % 4);
  const sigBytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));

  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload));
  if (!valid) return null;

  try {
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// Export handler for edge-functions-server
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const provider = url.searchParams.get('provider') || 'google';
    const redirectTo = url.searchParams.get('redirect_to') || '/admin/dashboard';
    const functionUrl = `${FUNCTIONS_URL}/oauth-proxy`;

    if (action === 'authorize') {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const stateData = await signState({
        verifier: codeVerifier,
        redirectTo: redirectTo,
        provider: provider,
      });

      let authUrl: URL;

      if (provider === 'google') {
        authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', `${functionUrl}?action=callback`);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'openid email profile');
        authUrl.searchParams.set('state', stateData);
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
      } else if (provider === 'apple') {
        authUrl = new URL('https://appleid.apple.com/auth/authorize');
        authUrl.searchParams.set('client_id', APPLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', `${functionUrl}?action=callback`);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'name email');
        authUrl.searchParams.set('state', stateData);
        authUrl.searchParams.set('response_mode', 'query');
      } else {
        return new Response(JSON.stringify({ error: 'Unsupported provider' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': authUrl.toString() },
      });
    }

    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        const errorUrl = new URL(`${FRONTEND_URL}/auth/callback`);
        errorUrl.searchParams.set('error', error);
        errorUrl.searchParams.set('error_description', url.searchParams.get('error_description') || '');
        return new Response(null, { status: 302, headers: { 'Location': errorUrl.toString() } });
      }

      if (!code || !state) {
        return new Response(JSON.stringify({ error: 'Missing code or state' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const stateData = await verifyState(state);
      if (!stateData) {
        return new Response(JSON.stringify({ error: 'Invalid or tampered state parameter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const verifier = stateData.verifier as string;
      const finalRedirect = stateData.redirectTo as string;
      const stateProvider = stateData.provider as string;
      let tokenData;

      // Exchange code for tokens
      if (stateProvider === 'google') {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code: code,
            code_verifier: verifier,
            grant_type: 'authorization_code',
            redirect_uri: `${functionUrl}?action=callback`,
          }),
        });
        tokenData = await tokenResponse.json();
      } else if (stateProvider === 'apple') {
        const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: APPLE_CLIENT_ID,
            client_secret: APPLE_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: `${functionUrl}?action=callback`,
          }),
        });
        tokenData = await tokenResponse.json();
      }

      if (tokenData.error) {
        console.error('Token error:', tokenData);
        const errorUrl = new URL(`${FRONTEND_URL}/auth/callback`);
        errorUrl.searchParams.set('error', tokenData.error);
        return new Response(null, { status: 302, headers: { 'Location': errorUrl.toString() } });
      }

      // Decode ID token to get user info
      const payload = JSON.parse(atob(tokenData.id_token.split('.')[1]));

      // Create Supabase admin client
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Check if user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === payload.email);

      if (!existingUser) {
        // Create new user
        const { error: createError } = await supabase.auth.admin.createUser({
          email: payload.email,
          email_confirm: true,
          user_metadata: {
            full_name: payload.name,
            avatar_url: payload.picture,
            provider: stateProvider,
          },
          app_metadata: {
            provider: stateProvider,
            providers: [stateProvider],
          },
        });
        if (createError) {
          console.error('Create user error:', createError);
          const errorUrl = new URL(`${FRONTEND_URL}/auth/callback`);
          errorUrl.searchParams.set('error', 'create_user_failed');
          return new Response(null, { status: 302, headers: { 'Location': errorUrl.toString() } });
        }
      }

      // Generate magic link for session
      const { data, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: payload.email,
        options: { redirectTo: `${FRONTEND_URL}${finalRedirect}` },
      });

      if (linkError) {
        console.error('Generate link error:', linkError);
        const errorUrl = new URL(`${FRONTEND_URL}/auth/callback`);
        errorUrl.searchParams.set('error', 'generate_link_failed');
        return new Response(null, { status: 302, headers: { 'Location': errorUrl.toString() } });
      }

      // Extract token and redirect to frontend
      const magicLinkUrl = new URL(data.properties.action_link);
      const token = magicLinkUrl.searchParams.get('token');
      const type = magicLinkUrl.searchParams.get('type');

      const successUrl = new URL(`${FRONTEND_URL}/auth/callback`);
      successUrl.searchParams.set('token', token || '');
      successUrl.searchParams.set('type', type || 'magiclink');
      successUrl.searchParams.set('redirect_to', finalRedirect);
      if (!existingUser) successUrl.searchParams.set('new_user', 'true');

      return new Response(null, { status: 302, headers: { 'Location': successUrl.toString() } });
    }

    // Default response
    return new Response(JSON.stringify({
      usage: 'Call with ?action=authorize&provider=google to start OAuth flow',
      providers: ['google', 'apple'],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return normalizedErrorResponse(classifyError(error), error, corsHeaders);
  }
}

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
