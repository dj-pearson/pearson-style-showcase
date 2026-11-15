import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { isTaskDue } from '../_shared/cron.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import { invokeFunction } from '../_shared/invoke-function.ts';
import { safeFetch, UrlGuardError } from '../_shared/url-guard.ts';
import { createEdgeFunctionLogger, type EdgeFunctionLogger } from '../_shared/production-logger.ts';
import { extractUrls, runPool, selectUrlsToCheck } from './link-check.ts';

const baseLogger = createEdgeFunctionLogger('maintenance-runner');

const SITE = 'https://danpearson.net';
// IndexNow keys are public by design: the search engine proves ownership by
// fetching this same value from public/<key>.txt on the site.
const INDEXNOW_KEY = Deno.env.get('INDEXNOW_KEY') || 'd90917c1bdd64177234048c4f1dc5ff0';

/** Functions a content task may dispatch to. Nothing outside this list runs. */
const CONTENT_FUNCTIONS = new Set(['generate-ai-article', 'amazon-article-pipeline']);

/**
 * Tasks that are seeded in maintenance_tasks but have no real implementation.
 * They used to "succeed" while doing nothing (or while writing zeros into
 * performance_history), which made the dashboard lie. They now record a
 * 'skipped' run with the reason, and migration 20261117000301 disables them.
 */
const NOT_IMPLEMENTED: Record<string, string> = {
  'Weekly Performance Audit':
    'Not implemented: no source of real Core Web Vitals is wired in, so there is nothing to record.',
  'Monthly Database Optimization':
    'Not implemented: VACUUM/ANALYZE cannot run through PostgREST; Postgres autovacuum covers it.',
  'Daily Sitemap Generation':
    'Not needed: sitemap.xml is generated at build time by scripts/prerender.mjs.',
};

type TaskOutcome = { status: 'success' | 'skipped'; result: any };

/**
 * Run a single maintenance task by name and return its outcome.
 * Shared by the manual dispatch path and the scheduled `run_due` path.
 */
async function runTask(
  taskName: string,
  supabase: any,
  config: any = {},
  log: EdgeFunctionLogger
): Promise<TaskOutcome> {
  if (NOT_IMPLEMENTED[taskName]) {
    return {
      status: 'skipped',
      result: { issuesFound: 0, issuesFixed: 0, reason: NOT_IMPLEMENTED[taskName] },
    };
  }
  switch (taskName) {
    case 'Daily AI News Brief':
    case 'Daily Amazon Product Guide':
      return { status: 'success', result: await runContentPipeline(config) };
    case 'IndexNow Submission':
      return { status: 'success', result: await submitToIndexNow(supabase, config) };
    case 'Daily Link Health Check':
      return { status: 'success', result: await checkBrokenLinks(supabase, config, log) };
    case 'Cleanup Old Sessions':
      return { status: 'success', result: await cleanupOldSessions(supabase) };
    default:
      throw new Error(`Unknown task: ${taskName}`);
  }
}

/**
 * Record a run via record_maintenance_run. Returns false (and logs) when the
 * RPC fails, instead of silently dropping the error as before.
 */
async function recordRun(
  supabase: any,
  log: EdgeFunctionLogger,
  params: {
    p_task_id: string;
    p_status: string;
    p_duration: number;
    p_issues_found?: number;
    p_issues_fixed?: number;
    p_details?: unknown;
    p_error_message?: string;
  }
): Promise<boolean> {
  const { error } = await supabase.rpc('record_maintenance_run', {
    p_issues_found: 0,
    p_issues_fixed: 0,
    p_details: {},
    ...params,
  });
  if (error) {
    log.error('record_maintenance_run failed', error, {
      task_id: params.p_task_id,
      status: params.p_status,
    });
    return false;
  }
  return true;
}

/**
 * Claim a due task so overlapping scheduler ticks can't run it twice.
 *
 * pg_cron fires every five minutes but a task's last_run_at used to move only
 * when record_maintenance_run ran at the end, so a link check that took longer
 * than five minutes was started again by every tick. This moves last_run_at
 * up front with a compare-and-set on the value we read; only one caller's
 * update matches, and everyone else sees no row back and skips.
 */
async function claimTask(supabase: any, task: { id: string; last_run_at: string | null }) {
  let query = supabase
    .from('maintenance_tasks')
    .update({ last_run_at: new Date().toISOString(), last_run_status: 'running' })
    .eq('id', task.id);
  query = task.last_run_at
    ? query.eq('last_run_at', task.last_run_at)
    : query.is('last_run_at', null);
  const { data, error } = await query.select('id');
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

/**
 * Scheduler entry point. Reads every enabled maintenance_tasks row, decides
 * which are due from its schedule_cron + last_run_at, runs each due task, and
 * records the outcome (success OR failure) via record_maintenance_run so that
 * failed scheduled runs land in maintenance_results and advance next_run_at.
 *
 * This is what a real scheduler (pg_cron, Cloudflare Cron Trigger, or external
 * cron) should invoke on an interval: POST { "action": "run_due" }.
 */
async function runDueTasks(supabase: any, log: EdgeFunctionLogger) {
  const now = new Date();

  const { data: tasks, error } = await supabase
    .from('maintenance_tasks')
    .select('id, task_name, schedule_cron, last_run_at, enabled, config')
    .eq('enabled', true);

  if (error) throw error;

  const due = (tasks || []).filter((t: any) =>
    isTaskDue(t.schedule_cron, t.last_run_at ? new Date(t.last_run_at) : null, now)
  );

  const results: Array<{ task: string; status: string; error?: string; recorded?: boolean }> = [];

  for (const task of due) {
    if (!(await claimTask(supabase, task))) {
      // Another tick claimed it between our read and our update.
      results.push({ task: task.task_name, status: 'already_claimed' });
      continue;
    }

    const startTime = Date.now();
    try {
      const { status, result } = await runTask(task.task_name, supabase, task.config || {}, log);
      const recorded = await recordRun(supabase, log, {
        p_task_id: task.id,
        p_status: status,
        p_duration: Date.now() - startTime,
        p_issues_found: result.issuesFound || 0,
        p_issues_fixed: result.issuesFixed || 0,
        p_details: result,
      });
      results.push({ task: task.task_name, status, recorded });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Monitoring: record the failure so it is visible in maintenance_results.
      const recorded = await recordRun(supabase, log, {
        p_task_id: task.id,
        p_status: 'failed',
        p_duration: Date.now() - startTime,
        p_error_message: message,
      });
      log.error('Scheduled maintenance task failed', err, { task: task.task_name });
      results.push({ task: task.task_name, status: 'failed', error: message, recorded });
    }
  }

  return { evaluated: (tasks || []).length, due: due.length, ran: results.length, results };
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Runs maintenance tasks with the service role, so it must check its own
  // caller. allowServiceRole keeps the pg_cron scheduler working: it posts
  // {"action":"run_due"} with the service-role key as its bearer token
  // (supabase/migrations/20260716000000_maintenance_scheduler.sql).
  const auth = await requireAdmin(req, corsHeaders, { allowServiceRole: true });
  if (!auth.ok) return auth.response!;
  const log = baseLogger.forRequest(req);

  try {
    const body = await req.json().catch(() => ({}));
    const { action, taskName, taskId } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Scheduler path: run every task that is due right now.
    if (action === 'run_due') {
      const summary = await runDueTasks(supabase, log);
      return new Response(JSON.stringify({ success: true, ...summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Manual path: run a single named task, with its stored config.
    const { data: taskRow, error: taskRowError } = await supabase
      .from('maintenance_tasks')
      .select('config')
      .eq('task_name', taskName)
      .maybeSingle();
    if (taskRowError) throw taskRowError;
    const startTime = Date.now();
    const { status, result } = await runTask(taskName, supabase, taskRow?.config || {}, log);
    const duration = Date.now() - startTime;

    // Record the task execution
    let recorded: boolean | undefined;
    if (taskId) {
      recorded = await recordRun(supabase, log, {
        p_task_id: taskId,
        p_status: status,
        p_duration: duration,
        p_issues_found: result.issuesFound || 0,
        p_issues_fixed: result.issuesFixed || 0,
        p_details: result,
      });
    }

    return new Response(JSON.stringify({ success: true, status, duration, recorded, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('Maintenance task error', error);

    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

// Task Handlers

const ARTICLE_PAGE_SIZE = 50;
const LINK_HEALTH_PAGE_SIZE = 1000;

/**
 * Check outbound links in published articles.
 *
 * Bounded so one run can't outlive the scheduler tick or the server deadline:
 * articles are read a page at a time, at most `max_urls_per_run` URLs are
 * checked (never-checked first, then the stalest; the rest wait for the next
 * run), five run in parallel, each has its own timeout, and no new check
 * starts once the run's time budget is spent. Config keys (all optional) live
 * in maintenance_tasks.config: max_urls_per_run, concurrency, timeout,
 * time_budget_ms.
 */
async function checkBrokenLinks(supabase: any, config: any, log: EdgeFunctionLogger) {
  const maxUrls = Math.min(Number(config?.max_urls_per_run) || 200, 1000);
  const concurrency = Math.min(Number(config?.concurrency) || 5, 10);
  const perUrlTimeout = Math.min(Number(config?.timeout) || 10_000, 30_000);
  const budgetMs = Math.min(Number(config?.time_budget_ms) || 120_000, 240_000);
  const deadline = Date.now() + budgetMs;

  // url -> first article it was found in (link_health is keyed by url+article)
  const urlArticle = new Map<string, string>();
  let articlesScanned = 0;
  for (let from = 0; ; from += ARTICLE_PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from('articles')
      .select('id, content')
      .eq('published', true)
      .order('id', { ascending: true })
      .range(from, from + ARTICLE_PAGE_SIZE - 1);
    if (error) throw error;
    for (const article of page || []) {
      articlesScanned++;
      for (const url of extractUrls(article.content)) {
        if (!urlArticle.has(url)) urlArticle.set(url, article.id);
      }
    }
    if (!page || page.length < ARTICLE_PAGE_SIZE) break;
  }

  const lastChecked = new Map<string, string>();
  for (let from = 0; ; from += LINK_HEALTH_PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from('link_health')
      .select('url, last_checked_at')
      .order('id', { ascending: true })
      .range(from, from + LINK_HEALTH_PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of page || []) {
      const prev = lastChecked.get(row.url);
      if (row.last_checked_at && (!prev || row.last_checked_at < prev)) {
        lastChecked.set(row.url, row.last_checked_at);
      }
    }
    if (!page || page.length < LINK_HEALTH_PAGE_SIZE) break;
  }

  const toCheck = selectUrlsToCheck(Array.from(urlArticle.keys()), lastChecked, maxUrls);

  let issuesFound = 0;
  let checked = 0;
  let recordFailures = 0;

  const record = async (url: string, statusCode: number, responseTime: number) => {
    const { error } = await supabase.rpc('update_link_health', {
      p_url: url,
      p_article_id: urlArticle.get(url),
      p_status_code: statusCode,
      p_response_time: responseTime,
    });
    if (error) {
      recordFailures++;
      if (recordFailures <= 3) log.error('update_link_health failed', error);
    }
  };

  const started = await runPool(
    toCheck,
    concurrency,
    async (url) => {
      const t0 = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), perUrlTimeout);
      try {
        // Article content is editable, so a link could point at an internal
        // host; safeFetch refuses private addresses, including via redirect.
        const response = await safeFetch(url, { method: 'HEAD', signal: controller.signal });
        await response.body?.cancel();
        checked++;
        if (response.status >= 400) issuesFound++;
        await record(url, response.status, Date.now() - t0);
      } catch (error) {
        // Not a link the checker may fetch; don't record it as broken.
        if (error instanceof UrlGuardError) return;
        checked++;
        issuesFound++;
        await record(url, 0, Date.now() - t0);
      } finally {
        clearTimeout(timeoutId);
      }
    },
    () => Date.now() < deadline
  );

  return {
    issuesFound,
    issuesFixed: 0,
    checkedUrls: checked,
    totalUrls: urlArticle.size,
    deferredUrls: urlArticle.size - started,
    budgetExhausted: started < toCheck.length,
    recordFailures,
    articlesScanned,
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
    sessionsDeleted: data?.length || 0,
  };
}

/**
 * Dispatch a daily content pipeline and wait for it, so a failed run lands in
 * maintenance_results like any other failed task. The pipelines are
 * idempotent per day, so a retry on the next five-minute tick is harmless.
 */
async function runContentPipeline(config: any) {
  const { function: fn, ...options } = config || {};
  if (!CONTENT_FUNCTIONS.has(fn)) {
    throw new Error(`Task config names no allowed content function (got ${fn ?? 'nothing'})`);
  }

  const { data, error } = await invokeFunction<any>(fn, options);
  if (error) throw error;
  if (data && data.success === false) {
    throw new Error(data.message || data.error || `${fn} reported failure`);
  }

  return {
    issuesFound: data?.quality?.issues?.filter((i: any) => i.blocking).length || 0,
    issuesFixed: 0,
    function: fn,
    skipped: Boolean(data?.skipped),
    reason: data?.reason,
    published: Boolean(data?.published),
    article: data?.article ? { slug: data.article.slug, url: data.article.url } : null,
  };
}

/**
 * Push recently published article URLs to IndexNow (Bing, Yandex, Seznam,
 * Naver). Bing's index also feeds ChatGPT search and Copilot, so this is the
 * fastest route for a daily brief to become citable there.
 *
 * Waits min_age_minutes after publication so the Cloudflare Pages rebuild the
 * pipeline triggered has finished and the URL serves prerendered HTML, not
 * the empty SPA shell. Each URL is submitted once, tracked in
 * indexnow_submissions.
 */
async function submitToIndexNow(supabase: any, config: any) {
  const minAge = Number(config?.min_age_minutes) || 20;
  const newest = new Date(Date.now() - minAge * 60_000).toISOString();
  const oldest = new Date(Date.now() - 48 * 3600_000).toISOString();

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, slug')
    .eq('published', true)
    .gte('created_at', oldest)
    .lte('created_at', newest);
  if (error) throw error;

  const urls = (articles || []).map((a: any) => ({ id: a.id, url: `${SITE}/news/${a.slug}` }));
  if (!urls.length) return { issuesFound: 0, issuesFixed: 0, submitted: 0 };

  const { data: done } = await supabase
    .from('indexnow_submissions')
    .select('url')
    .in(
      'url',
      urls.map((u: any) => u.url)
    );
  const already = new Set((done || []).map((d: any) => d.url));
  const pending = urls.filter((u: any) => !already.has(u.url));
  if (!pending.length) return { issuesFound: 0, issuesFixed: 0, submitted: 0 };

  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(SITE).host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: pending.map((p: any) => p.url),
    }),
  });

  // 200 and 202 both mean accepted. Anything else is left unrecorded so the
  // next run retries it.
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(
      `IndexNow returned ${response.status}: ${(await response.text()).slice(0, 200)}`
    );
  }

  await supabase
    .from('indexnow_submissions')
    .upsert(
      pending.map((p: any) => ({ url: p.url, article_id: p.id, status_code: response.status }))
    );

  return { issuesFound: 0, issuesFixed: pending.length, submitted: pending.length };
}
