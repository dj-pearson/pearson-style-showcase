import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { articleId, asin } = await req.json();

    if (!articleId || !asin) {
      return new Response(
        JSON.stringify({ error: 'articleId and asin are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user agent and referrer from headers
    const userAgent = req.headers.get('user-agent') || '';
    const referrer = req.headers.get('referer') || '';
    
    // Get IP (from Cloudflare or X-Forwarded-For)
    const ipAddress = req.headers.get('cf-connecting-ip') || 
                      req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      '';

    // Generate a simple session ID (could be improved with cookies)
    const sessionId = crypto.randomUUID();

    // Insert click record
    const { error: clickError } = await supabase
      .from('amazon_affiliate_clicks')
      .insert({
        article_id: articleId,
        asin: asin,
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
      .eq('article_id', articleId)
      .eq('asin', asin)
      .eq('date', today)
      .single();

    if (existingStat) {
      await supabase
        .from('amazon_affiliate_stats')
        .update({ clicks: existingStat.clicks + 1 })
        .eq('id', existingStat.id);
    } else {
      await supabase
        .from('amazon_affiliate_stats')
        .insert({
          article_id: articleId,
          asin: asin,
          date: today,
          clicks: 1,
        });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in track-affiliate-click:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});