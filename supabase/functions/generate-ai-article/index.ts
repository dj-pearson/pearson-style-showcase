import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import { fetchWithTimeout, structuredErrorResponse } from '../_shared/fetch-with-timeout.ts';
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitResponse,
  initRateLimiter,
} from '../_shared/rate-limiter.ts';
import { getAIConfigs, callAIWithConfig, parseJSONResponse } from '../_shared/ai-helper.ts';
import { invokeFunctionAndForget } from '../_shared/invoke-function.ts';
import { triggerSiteRebuild } from '../_shared/site-publish.ts';
import {
  checkArticle,
  normalizeUrl,
  readTime,
  removeSection,
  restrictLinks,
  slugify,
  stripInvisible,
} from '../_shared/content-quality.ts';
import {
  buildSourcesSection,
  extractArticleText,
  parseFeed,
  selectCandidates,
  type FeedItem,
} from './news.ts';

/**
 * Daily AI news brief.
 *
 * Reads the configured AI news feeds, picks the one story from the last 36
 * hours that matters most to a business adopting AI, reads the source
 * article, and writes an analysis with its sources cited. Runs once a day from
 * maintenance-runner ("Daily AI News Brief"); an admin can also run it from
 * the dashboard.
 *
 * Body (all optional): { force, dryRun, feeds, author, auto_publish }
 *   force         run even if today's brief already exists
 *   dryRun        do everything except write the article
 */

initRateLimiter();

// Manual runs from the dashboard. The scheduler is exempt: it authenticates
// with the service-role key and the daily idempotency check bounds it.
const ARTICLE_GEN_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  burstAllowance: 1,
  keyPrefix: 'article-gen',
};

const PIPELINE = 'ai_news';
const CATEGORY = 'AI News';
const SITE = 'https://danpearson.net';
const USER_AGENT = 'Mozilla/5.0 (compatible; DanPearsonNewsBot/1.0; +https://danpearson.net)';

const DEFAULT_FEEDS = [
  'https://techcrunch.com/category/artificial-intelligence/feed/',
  'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
  'https://venturebeat.com/category/ai/feed/',
  'https://arstechnica.com/ai/feed/',
  'https://www.technologyreview.com/topic/artificial-intelligence/feed',
  'https://www.artificialintelligence-news.com/feed/',
  'https://openai.com/news/rss.xml',
  'https://blog.google/technology/ai/rss/',
  'https://huggingface.co/blog/feed.xml',
];

/** A source page shorter than this is a teaser or a paywall, not an article. */
const MIN_SOURCE_CHARS = 1500;

interface RequestOptions {
  force?: boolean;
  dryRun?: boolean;
  feeds?: string[];
  author?: string;
  auto_publish?: boolean;
}

interface GeneratedArticle {
  title: string;
  seo_title: string;
  seo_description: string;
  excerpt: string;
  target_keyword: string;
  seo_keywords: string[];
  tags: string[];
  content: string;
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchFeeds(feeds: string[]): Promise<{ items: FeedItem[]; failed: string[] }> {
  const failed: string[] = [];
  const results = await Promise.all(
    feeds.map(async (feed) => {
      try {
        const response = await fetchWithTimeout(
          feed,
          {
            headers: {
              'User-Agent': USER_AGENT,
              Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
            },
          },
          { timeoutMs: 15_000, maxRetries: 2, label: `feed:${feed}` }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return parseFeed(await response.text(), feed);
      } catch (error) {
        failed.push(`${feed}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    })
  );
  return { items: results.flat(), failed };
}

async function fetchSourceText(url: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(
      url,
      { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' } },
      { timeoutMs: 20_000, maxRetries: 2, label: 'news-source' }
    );
    if (!response.ok) return '';
    return extractArticleText(await response.text());
  } catch {
    return '';
  }
}

/** Source URLs and titles from recent briefs, so the same story is not covered twice. */
async function loadHistory(supabase: SupabaseClient) {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const { data: runs } = await supabase
    .from('content_automation_runs')
    .select('source_urls')
    .eq('pipeline', PIPELINE)
    .gte('run_date', since);

  const { data: recent } = await supabase
    .from('articles')
    .select('title')
    .eq('category', CATEGORY)
    .gte('created_at', new Date(Date.now() - 14 * 86400_000).toISOString());

  return {
    excludeUrls: new Set(
      (runs || [])
        .flatMap((r: { source_urls: string[] | null }) => r.source_urls || [])
        .map(normalizeUrl)
    ),
    recentTitles: (recent || []).map((a: { title: string }) => a.title),
  };
}

/** Evergreen articles the brief may link to, which is how it feeds the pillars. */
async function loadInternalLinks(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('articles')
    .select('slug, title, category')
    .eq('published', true)
    .neq('category', CATEGORY)
    .neq('category', 'Product Reviews')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(40);

  const links = (data || []).map((a: { slug: string; title: string }) => ({
    path: `/news/${a.slug}`,
    title: a.title,
  }));
  links.push({
    path: '/ai-crm-automation',
    title: 'AI CRM automation consulting and the 12-point audit',
  });
  return links;
}

interface Selection {
  lead: number;
  related: number[];
  angle: string;
}

async function selectStory(
  candidates: FeedItem[],
  configs: Awaited<ReturnType<typeof getAIConfigs>>
): Promise<Selection> {
  const list = candidates
    .map(
      (c, i) =>
        `${i}. ${c.title} (${c.source}${c.publishedAt ? `, ${c.publishedAt.toISOString()}` : ''})\n   ${c.summary.slice(0, 280)}`
    )
    .join('\n');

  const prompt = `These are AI news items from the last 36 hours:

${list}

Readers are owners and operators of small and mid-sized businesses, and the people who run their sales and operations teams. They want to know which AI developments change what they should buy, build, or stop doing.

Pick the ONE item that matters most to them. Prefer, in order: a product or pricing change they can act on this month; a model or platform release that changes what is practical to automate; regulation or security news that creates an obligation; a well-sourced adoption result with numbers. Avoid funding rounds, executive moves, opinion pieces and items that only matter to AI researchers, unless nothing better exists.

Then pick up to 3 other items worth a one-line mention, about different stories.

Return JSON only:
{"lead": <index>, "related": [<index>, ...], "angle": "<one sentence: what this means for those readers>"}`;

  try {
    const { response } = await callAIWithConfig(
      configs,
      'You are the news editor for a business-focused AI publication. You return only JSON.',
      prompt,
      { temperature: 0.2, maxTokens: 400, jsonMode: true }
    );
    const parsed = parseJSONResponse(response);
    const lead = Number(parsed.lead);
    if (!Number.isInteger(lead) || lead < 0 || lead >= candidates.length)
      throw new Error('bad lead');
    const related = (Array.isArray(parsed.related) ? parsed.related : [])
      .map(Number)
      .filter((i: number) => Number.isInteger(i) && i >= 0 && i < candidates.length && i !== lead)
      .slice(0, 3);
    return { lead, related, angle: String(parsed.angle || '').slice(0, 300) };
  } catch (error) {
    console.warn('[ai-news] story selection failed, using newest item:', error);
    return { lead: 0, related: [1, 2, 3].filter((i) => i < candidates.length), angle: '' };
  }
}

function writingPrompt(
  lead: FeedItem,
  leadText: string,
  related: FeedItem[],
  angle: string,
  internalLinks: { path: string; title: string }[],
  date: string
): string {
  return `Write today's AI news brief (${date}) for danpearson.net.

READERS: owners and operators of small and mid-sized businesses, and the people who run their sales, service and operations teams. Smart, busy, not AI researchers. They want to know what changed and what to do about it.

LEAD STORY
Title: ${lead.title}
Source: ${lead.source}
URL: ${lead.url}
Published: ${lead.publishedAt?.toISOString() ?? 'unknown'}
Editor's angle: ${angle || 'decide the business implication yourself'}

Source text (the only facts you may use about this story):
"""
${leadText}
"""

OTHER STORIES (mention each in one or two sentences, linked to its URL):
${related.map((r) => `- ${r.title} (${r.source}) ${r.url}\n  ${r.summary.slice(0, 300)}`).join('\n') || '- none'}

EXISTING ARTICLES YOU MAY LINK TO (at most two, and only where genuinely relevant; use the path exactly):
${internalLinks.map((l) => `- ${l.path} : ${l.title}`).join('\n')}

STRUCTURE (markdown, in this order, no H1):
1. Opening paragraph. The first sentence is bold and states what happened and why it matters in plain words, so it can be quoted on its own. Two to four sentences total.
2. "## Key takeaways": 3 to 5 bullets. Each is a complete, specific sentence with the names and numbers from the source. No bullet depends on another.
3. "## What happened": the facts, attributed to the source ("according to ${lead.source}"). Link the lead story URL once here.
4. "## Why it matters for your business": your analysis. Be concrete about who is affected, what it costs or saves, and what it changes. Take a position.
5. "## What to do about it": 2 to 4 concrete actions a reader could take this week or this quarter. Say who should do each one.
6. "## Also worth knowing today": one bullet per other story, each linking its URL. Omit this section if there are none.
7. "## Frequently asked questions": 3 or 4 questions a reader would type into a search engine or ask an AI assistant about this news. Format each question as its own bold line ending in "?", then the answer as a paragraph of 2 to 4 sentences that stands alone.

Do NOT write a Sources section; the system appends one.

FACTS
- Use only facts from the source text and the story summaries above. Do not invent numbers, quotes, dates, prices, customers or benchmark results.
- If the source does not say something, do not guess at it. "It is not yet clear whether..." is fine.
- Only link to the URLs and paths given above.

STYLE
- 800 to 1300 words. State the point first, then support it. Vary sentence length. Use contractions.
- Use real names and numbers, not categories. Have an opinion.
- Never use: delve, dive into, deep dive, unpack, shed light on, pave the way, usher in, tap into, supercharge, unlock, elevate, empower, streamline, curate, showcase, groundbreaking, cutting-edge, transformative, game-changing, innovative, pivotal, invaluable, meticulous, bespoke, vibrant, multifaceted, holistic, testament, tapestry, synergy, cornerstone, treasure trove, plethora, myriad, moreover, furthermore, additionally.
- Never use: "In today's...", "It's worth noting", "When it comes to", "At its core", "At the end of the day", "plays a crucial role", "not just X, it's Y", rhetorical questions as transitions, or a closing summary paragraph.
- At most one em dash in the whole article. Straight quotes only.

Return ONLY this JSON object:
{
  "title": "Specific headline under 70 characters that names the company or product",
  "seo_title": "Search title under 60 characters, main keyword first",
  "seo_description": "140 to 160 characters, states the news and the takeaway",
  "excerpt": "One or two sentences, under 220 characters, the answer-first summary",
  "target_keyword": "the phrase someone would search for this news",
  "seo_keywords": ["5 search phrases, including one question"],
  "tags": ["3 to 5 tags: the company, the product, the topic"],
  "content": "the markdown article"
}`;
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Spends AI credits and publishes with the service role, so it checks its
  // own caller. allowServiceRole is how maintenance-runner schedules it.
  const auth = await requireAdmin(req, corsHeaders, { allowServiceRole: true });
  if (!auth.ok) return auth.response!;

  if (!auth.internal) {
    const rateLimitResult = checkRateLimit(getClientIdentifier(req), ARTICLE_GEN_RATE_LIMIT);
    if (!rateLimitResult.allowed) return createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  const options: RequestOptions = await req.json().catch(() => ({}));
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const date = todayUtc();

  // One brief a day. A retry, a second scheduler or a double click must not
  // publish twice; force is for an admin who deleted today's and wants another.
  if (!options.force) {
    const { data: existing } = await supabase
      .from('content_automation_runs')
      .select('id, status, started_at, article_id')
      .eq('pipeline', PIPELINE)
      .eq('run_date', date)
      .in('status', ['published', 'draft', 'running']);

    const done = (existing || []).find((r: { status: string }) => r.status !== 'running');
    const inFlight = (existing || []).find(
      (r: { status: string; started_at: string }) =>
        r.status === 'running' && Date.now() - new Date(r.started_at).getTime() < 20 * 60_000
    );
    if (done || inFlight) {
      return json(
        {
          success: true,
          skipped: true,
          reason: done ? `today's brief already exists (${done.status})` : 'a run is in progress',
        },
        200,
        corsHeaders
      );
    }
  }

  const { data: run, error: runError } = await supabase
    .from('content_automation_runs')
    .insert({ pipeline: PIPELINE, run_date: date, status: 'running' })
    .select('id')
    .single();
  if (runError) {
    console.error('[ai-news] could not create run record:', runError);
    return structuredErrorResponse(
      'Could not create run record',
      'RUN_RECORD_FAILED',
      500,
      corsHeaders
    );
  }

  const finishRun = (fields: Record<string, unknown>) =>
    supabase
      .from('content_automation_runs')
      .update({ ...fields, finished_at: new Date().toISOString() })
      .eq('id', run.id);

  try {
    const writerConfigs = await getAIConfigs(supabase, 'normal', 'article_generation');
    const editorConfigs = await getAIConfigs(supabase, 'lightweight', 'article_generation');

    // 1. Gather today's candidates.
    const feeds = options.feeds?.length ? options.feeds : DEFAULT_FEEDS;
    const { items, failed } = await fetchFeeds(feeds);
    if (failed.length) console.warn('[ai-news] feeds failed:', failed);
    if (!items.length) throw new Error(`No feed returned any items (${failed.length} failed)`);

    const history = await loadHistory(supabase);
    let candidates = selectCandidates(items, {
      now: new Date(),
      maxAgeHours: 36,
      limit: 30,
      ...history,
    });
    if (candidates.length < 3) {
      candidates = selectCandidates(items, {
        now: new Date(),
        maxAgeHours: 72,
        limit: 30,
        ...history,
      });
    }
    if (!candidates.length) throw new Error('No new stories in the last 72 hours');

    // 2. Let the editor model choose, then find a lead whose source is readable.
    const selection = await selectStory(candidates, editorConfigs);
    const order = [selection.lead, ...selection.related, ...candidates.map((_, i) => i)];
    let leadIndex = -1;
    let leadText = '';
    for (const index of [...new Set(order)].slice(0, 5)) {
      const text = await fetchSourceText(candidates[index].url);
      if (text.length >= MIN_SOURCE_CHARS) {
        leadIndex = index;
        leadText = text;
        break;
      }
    }

    const thinSource = leadIndex === -1;
    if (thinSource) {
      // Every candidate page was blocked or too short. Write from the feed
      // summary, but the quality gate below will hold it as a draft.
      leadIndex = selection.lead;
      leadText = candidates[leadIndex].summary;
    }

    const lead = candidates[leadIndex];
    const related = selection.related.filter((i) => i !== leadIndex).map((i) => candidates[i]);
    const internalLinks = await loadInternalLinks(supabase);

    // 3. Write.
    const { response, usedConfig } = await callAIWithConfig(
      writerConfigs,
      'You are a business technology journalist who writes plainly, cites sources, and never invents facts. You return only valid JSON.',
      writingPrompt(lead, leadText, related, selection.angle, internalLinks, date),
      { temperature: 0.6, maxTokens: 6000, jsonMode: true }
    );
    const generated = parseJSONResponse(response) as GeneratedArticle;
    if (!generated?.title || !generated?.content)
      throw new Error('Model returned no title or content');

    // 4. Post-process: the pipeline owns links and citations, not the model.
    const sources = [lead, ...related];
    const cleaned = stripInvisible(removeSection(generated.content, /sources|references/i));
    const { content: linked, removed } = restrictLinks(
      cleaned,
      sources.map((s) => s.url),
      internalLinks.map((l) => l.path)
    );
    const content = `${linked}\n\n${buildSourcesSection(sources)}\n\n*This brief was compiled with AI assistance from the sources above.*`;

    const title = stripInvisible(generated.title).trim();
    const excerpt = stripInvisible(generated.excerpt || generated.seo_description || '').trim();
    const seoTitle = stripInvisible(generated.seo_title || title).trim();
    const seoDescription = stripInvisible(generated.seo_description || excerpt).trim();

    const report = checkArticle(
      { title, content, excerpt, seoTitle, seoDescription },
      {
        minWords: 650,
        maxWords: 1900,
        requiredHeadings: ['Key takeaways', 'What happened', 'Why it matters', 'Frequently asked'],
        minFaqs: 3,
      }
    );
    if (thinSource) {
      report.issues.push({
        code: 'thin_source',
        message: 'No candidate source page could be read; written from the feed summary only',
        blocking: true,
      });
      report.ok = false;
    }
    if (removed.length) {
      report.issues.push({
        code: 'links_removed',
        message: `Removed ${removed.length} link(s) the pipeline did not supply: ${removed.slice(0, 5).join(', ')}`,
        blocking: false,
      });
    }

    const autoPublish = options.auto_publish !== false;
    const publish = autoPublish && report.ok;

    // 5. Save.
    let slug = slugify(title);
    const { data: clash } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (clash) slug = `${slug}-${date}`;

    const tags = [
      CATEGORY,
      ...(Array.isArray(generated.tags) ? generated.tags.map(String) : []),
    ].filter((t, i, all) => t && all.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);

    const quality = {
      ok: report.ok,
      wordCount: report.wordCount,
      issues: report.issues,
      model: `${usedConfig.provider} - ${usedConfig.model_name}`,
      feedsFailed: failed.length,
      candidates: candidates.length,
    };

    if (options.dryRun) {
      await finishRun({
        status: 'skipped',
        topic: lead.title,
        source_urls: sources.map((s) => s.url),
        quality,
      });
      return json({ success: true, dryRun: true, title, slug, content, quality }, 200, corsHeaders);
    }

    const { data: article, error: insertError } = await supabase
      .from('articles')
      .insert({
        title,
        slug,
        excerpt,
        content,
        category: CATEGORY,
        tags: tags.slice(0, 8),
        author: options.author || 'Dan Pearson',
        read_time: readTime(content),
        published: publish,
        seo_title: seoTitle,
        seo_description: seoDescription,
        target_keyword: generated.target_keyword || null,
        seo_keywords: Array.isArray(generated.seo_keywords)
          ? generated.seo_keywords.slice(0, 8)
          : [],
      })
      .select('id, slug, title, excerpt, category, read_time, tags, published')
      .single();
    if (insertError) throw insertError;

    await finishRun({
      status: publish ? 'published' : 'draft',
      article_id: article.id,
      topic: lead.title,
      source_urls: sources.map((s) => s.url),
      quality,
    });

    let rebuild = null;
    if (publish) {
      await invokeFunctionAndForget('send-article-webhook', {
        articleId: article.id,
        isTest: false,
      });
      rebuild = await triggerSiteRebuild(`AI news brief ${article.slug}`);
    }

    return json(
      {
        success: true,
        published: publish,
        article: { ...article, url: `${SITE}/news/${article.slug}` },
        lead: { title: lead.title, url: lead.url },
        quality,
        rebuild,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ai-news] run failed:', message);
    await finishRun({ status: 'failed', error: message.slice(0, 2000) });
    return structuredErrorResponse(
      message || 'Internal server error',
      'ARTICLE_GENERATION_FAILED',
      500,
      corsHeaders
    );
  }
};
