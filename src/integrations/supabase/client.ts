// danpearson.net Self-Hosted Supabase Client
// Migrated from cloud Supabase to self-hosted infrastructure
import { createClient } from '@supabase/supabase-js';

// Self-hosted Supabase configuration
// API: api.danpearson.net
// Functions: functions.danpearson.net
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://api.danpearson.net';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NjAwMTU0MCwiZXhwIjo0OTIxNjc1MTQwLCJyb2xlIjoiYW5vbiJ9.smyKT5KYiVNCQLTvQR-r1V3auuuxr7eQznTYzSCThUY';

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required Supabase environment variables');
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