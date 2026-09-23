/**
 * Side effects that make a newly published article visible to crawlers.
 *
 * The site is a client-rendered SPA. A database article only gets real HTML,
 * a sitemap entry and an RSS item when scripts/prerender.mjs runs, and that
 * only runs on a Cloudflare Pages build. Without a rebuild, the day's post is
 * an empty <div id="root"> to every crawler that does not execute JavaScript,
 * which includes GPTBot, ClaudeBot and PerplexityBot.
 *
 * CLOUDFLARE_PAGES_DEPLOY_HOOK_URL is a Pages deploy hook (Pages project >
 * Settings > Builds > Deploy hooks). It is a bearer credential in URL form, so
 * it lives in the edge-function environment, never in the repo.
 */

export interface RebuildResult {
  triggered: boolean;
  reason?: string;
}

export async function triggerSiteRebuild(reason: string): Promise<RebuildResult> {
  const hook = Deno.env.get('CLOUDFLARE_PAGES_DEPLOY_HOOK_URL');
  if (!hook) {
    console.warn(
      `[site-publish] CLOUDFLARE_PAGES_DEPLOY_HOOK_URL not set; ${reason} will not be prerendered until the next deploy`
    );
    return { triggered: false, reason: 'deploy hook not configured' };
  }

  try {
    const response = await fetch(hook, { method: 'POST' });
    if (!response.ok) {
      console.error(`[site-publish] deploy hook returned ${response.status}`);
      return { triggered: false, reason: `deploy hook returned ${response.status}` };
    }
    console.log(`[site-publish] rebuild triggered: ${reason}`);
    return { triggered: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[site-publish] deploy hook failed:', message);
    return { triggered: false, reason: message };
  }
}
