// danpearson.net Self-Hosted Supabase Client
// Migrated from cloud Supabase to self-hosted infrastructure
import { createClient } from '@supabase/supabase-js';

// Self-hosted Supabase configuration
// API: api.danpearson.net
// Functions: functions.danpearson.net
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables - fail fast if not configured
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing required Supabase environment variables. ' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Enable OAuth callback detection for social logins (Google, GitHub, etc.)
    // The hash fragment with tokens is automatically parsed and the session is established
    detectSessionInUrl: true,
    // Use PKCE flow for enhanced security with OAuth
    flowType: 'pkce',
  }
});