import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/** How long a reader has to stay before the visit counts as a read. */
const DWELL_MS = 5000;

const storageKey = (slug: string) => `article-view:${slug}`;

/**
 * Whether this browser session has already counted a view of this article.
 * sessionStorage rather than localStorage: coming back tomorrow is a new visit,
 * flipping between two tabs in one sitting is not.
 */
function alreadyCounted(slug: string): boolean {
  try {
    return sessionStorage.getItem(storageKey(slug)) !== null;
  } catch {
    // Private mode, or storage disabled. Treat it as counted rather than
    // counting the same reader on every re-render.
    return true;
  }
}

function markCounted(slug: string): void {
  try {
    sessionStorage.setItem(storageKey(slug), '1');
  } catch {
    // Nothing to do: the guard above already treats a failing store as counted.
  }
}

/**
 * Counts one view of an article, five seconds after it opens.
 *
 * The delay keeps a bounce - a wrong click, a crawler that renders and leaves -
 * out of the number, and the per-session guard keeps a reader who scrolls back
 * up and reloads from counting twice. Failures are swallowed: a view counter is
 * never worth an error in front of a reader, and the RPC is absent until the
 * migration lands.
 */
export function useArticleView(slug: string | null | undefined, enabled = true): void {
  useEffect(() => {
    if (!slug || !enabled) return;
    if (alreadyCounted(slug)) return;

    const timer = setTimeout(async () => {
      // Mark first: a slow or failing request must not leave the door open for
      // a second attempt on the next render.
      markCounted(slug);

      const { error } = await supabase.rpc('increment_article_view', {
        article_slug: slug,
      });

      if (error) logger.warn('Article view not counted:', error);
    }, DWELL_MS);

    return () => clearTimeout(timer);
  }, [slug, enabled]);
}
