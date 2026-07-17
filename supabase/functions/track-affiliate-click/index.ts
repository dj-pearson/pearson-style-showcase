import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitResponse,
  initRateLimiter,
} from '../_shared/rate-limiter.ts';
import { validateClickInput } from './validation.ts';

// Initialize rate limiter cleanup
initRateLimiter();

// 100 clicks per hour per IP
const CLICK_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 100,
  burstAllowance: 10,
  keyPrefix: 'affiliate-click',
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limit check
    const clientIp = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(clientIp, CLICK_RATE_LIMIT);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { articleId, asin } = body;

    // Validate inputs (extracted to ./validation.ts, US-012)
    const clickInput = validateClickInput(articleId, asin);
    if (!clickInput.valid) {
      return new Response(JSON.stringify({ error: clickInput.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { articleIdResult, asinResult } = clickInput;

    // Get user agent and referrer from headers
    const userAgent = req.headers.get('user-agent') || '';
    const referrer = req.headers.get('referer') || '';

    // Get IP (from Cloudflare or X-Forwarded-For)
    const ipAddress =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      '';

    // Generate a simple session ID (could be improved with cookies)
    const sessionId = crypto.randomUUID();

    // Insert click record
    const { error: clickError } = await supabase.from('amazon_affiliate_clicks').insert({
      article_id: articleIdResult.sanitized,
      asin: asinResult.sanitized,
      user_agent: userAgent,
      referrer: referrer,
      ip_address: ipAddress,
      session_id: sessionId,
    });

    if (clickError) {
      console.error('Error tracking click:', clickError);
      // Don't fail the request if tracking fails
    }

    // Update daily stats (increment click count)
    const today = new Date().toISOString().split('T')[0];
    const { data: existingStat } = await supabase
      .from('amazon_affiliate_stats')
      .select('*')
      .eq('article_id', articleIdResult.sanitized)
      .eq('asin', asinResult.sanitized)
      .eq('date', today)
      .single();

    if (existingStat) {
      await supabase
        .from('amazon_affiliate_stats')
        .update({ clicks: existingStat.clicks + 1 })
        .eq('id', existingStat.id);
    } else {
      await supabase.from('amazon_affiliate_stats').insert({
        article_id: articleIdResult.sanitized,
        asin: asinResult.sanitized,
        date: today,
        clicks: 1,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, ...rateLimitResult.headers, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in track-affiliate-click:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
