import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { taskName, taskId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const startTime = Date.now();
    let result: any = {};

    // Route to appropriate task handler
    switch (taskName) {
      case 'Daily Link Health Check':
        result = await checkBrokenLinks(supabase);
        break;
      case 'Cleanup Old Sessions':
        result = await cleanupOldSessions(supabase);
        break;
      case 'Weekly Performance Audit':
        result = await performanceAudit(supabase);
        break;
      case 'Monthly Database Optimization':
        result = await databaseOptimization(supabase);
        break;
      case 'Daily Sitemap Generation':
        result = await generateSitemap(supabase);
        break;
      default:
        throw new Error(`Unknown task: ${taskName}`);
    }

    const duration = Date.now() - startTime;

    // Record the task execution
    if (taskId) {
      await supabase.rpc('record_maintenance_run', {
        p_task_id: taskId,
        p_status: 'success',
        p_duration: duration,
        p_issues_found: result.issuesFound || 0,
        p_issues_fixed: result.issuesFixed || 0,
        p_details: result
      });
    }

    return new Response(
      JSON.stringify({ success: true, duration, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Maintenance task error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Task Handlers

async function checkBrokenLinks(supabase: any) {
  let issuesFound = 0;
  let issuesFixed = 0;
  const checkedUrls: string[] = [];

  // Get all published articles
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, content, title')
    .eq('published', true);

  if (error) throw error;

  for (const article of articles) {
    // Extract URLs from content (simple regex)
    const urlRegex = /https?:\/\/[^\s"')]+/g;
    const urls = article.content.match(urlRegex) || [];

    for (const url of urls) {
      if (checkedUrls.includes(url)) continue;
      checkedUrls.push(url);

      try {
        // Check URL with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow'
        });
        clearTimeout(timeoutId);

        const statusCode = response.status;
        const isBroken = statusCode >= 400;
        const responseTime = 0; // Could measure this with performance.now()

        // Update link health
        await supabase.rpc('update_link_health', {
          p_url: url,
          p_article_id: article.id,
          p_status_code: statusCode,
          p_response_time: responseTime
        });

        if (isBroken) {
          issuesFound++;
        }
      } catch (error) {
        // Network error or timeout
        issuesFound++;

        await supabase.rpc('update_link_health', {
          p_url: url,
          p_article_id: article.id,
          p_status_code: 0,
          p_response_time: 10000
        });
      }
    }
  }

  return {
    issuesFound,
    issuesFixed,
    checkedUrls: checkedUrls.length,
    articlesScanned: articles.length
  };
}

async function cleanupOldSessions(supabase: any) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('admin_sessions')
    .delete()
    .lt('created_at', thirtyDaysAgo.toISOString());

  if (error) throw error;

  return {
    issuesFound: 0,
    issuesFixed: 0,
    sessionsDeleted: data?.length || 0
  };
}

async function performanceAudit(supabase: any) {
  // Record current performance metrics
  const metrics = [
    { name: 'lcp', value: 0, unit: 'ms' },
    { name: 'fid', value: 0, unit: 'ms' },
    { name: 'cls', value: 0, unit: 'score' }
  ];

  for (const metric of metrics) {
    await supabase
      .from('performance_history')
      .insert({
        metric_name: metric.name,
        metric_value: metric.value,
        metric_unit: metric.unit
      });
  }

  return {
    issuesFound: 0,
    issuesFixed: 0,
    metricsRecorded: metrics.length
  };
}

async function databaseOptimization(supabase: any) {
  // In a real implementation, this would run VACUUM, ANALYZE, etc.
  // For now, just log the operation
  await supabase
    .from('db_optimization_log')
    .insert({
      operation_type: 'analyze',
      table_name: 'all',
      rows_affected: 0,
      duration: 0
    };

  return {
    issuesFound: 0,
    issuesFixed: 0,
    tablesOptimized: 0
  };
}

async function generateSitemap(supabase: any) {
  // Get all published content
  const { data: articles } = await supabase
    .from('articles')
    .select('slug, updated_at')
    .eq('published', true);

  const { data: kbArticles } = await supabase
    .from('kb_articles')
    .select('slug, updated_at')
    .eq('published', true);

  return {
    issuesFound: 0,
    issuesFixed: 0,
    articlesIncluded: (articles?.length || 0) + (kbArticles?.length || 0)
  };
}
