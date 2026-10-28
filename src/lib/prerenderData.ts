import type { StaticArticle } from '@/content/crm-articles.generated';
import type { Tables } from '@/integrations/supabase/types';
import { mergeStaticArticles, sortArticleListing } from '@/lib/static-articles';

/**
 * Build-time query data for the prerendered routes.
 *
 * scripts/prerender.mjs writes real HTML into #root, and main.tsx waits for
 * the route chunk so React's first commit is the page rather than Suspense.
 * That still left the page's own react-query fetch: with no data in the cache
 * the first commit was a loading skeleton, painted over content the visitor
 * was already reading. The prerenderer now embeds exactly what the page's
 * queryFn would return, and the page hands it to useQuery as initialData.
 *
 * The block is <script type="application/json">. A browser never executes a
 * script whose type is not a JavaScript MIME type, so CSP's script-src (which
 * has no 'unsafe-inline') does not apply to it, the same as the ld+json block
 * already in every prerendered head.
 *
 * scripts/prerender.mjs bundles this file with esbuild, so the key builders
 * and the shaping functions below are the only definition of the embedded
 * data. Keep it free of anything that needs a browser at import time.
 */

type Article = Tables<'articles'>;

export const PRERENDER_DATA_ID = 'prerender-data';

export interface PrerenderPayload<T = unknown> {
  /** Which route's query this answers, e.g. `article:<slug>`. */
  key: string;
  /**
   * When the data was read, in ms since the epoch. 0 means the build could not
   * check the database, so the data is shown at once and refetched on mount.
   */
  updatedAt: number;
  data: T;
}

export const articlePrerenderKey = (slug: string) => `article:${slug}`;
export const topicPrerenderKey = (topic: string) => `topic:${topic}`;

let cached: PrerenderPayload | null | undefined;

function loadPayload(): PrerenderPayload | null {
  if (cached !== undefined) return cached;
  cached = null;
  try {
    const text = document.getElementById(PRERENDER_DATA_ID)?.textContent;
    if (!text) return cached;
    const parsed: unknown = JSON.parse(text);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as PrerenderPayload).key === 'string' &&
      typeof (parsed as PrerenderPayload).updatedAt === 'number' &&
      'data' in parsed
    ) {
      cached = parsed as PrerenderPayload;
    }
  } catch {
    // Malformed JSON or no DOM: behave as if nothing was embedded.
  }
  return cached;
}

/**
 * The embedded data for `key`, or undefined when the page was not prerendered
 * for that route (a client-side navigation to another article, a route the
 * build does not cover, a missing or malformed block). The block is parsed
 * once per page load.
 */
export function readPrerenderData<T>(key: string): { data: T; updatedAt: number } | undefined {
  const payload = loadPayload();
  if (!payload || payload.key !== key) return undefined;
  return { data: payload.data as T, updatedAt: payload.updatedAt };
}

/** Test hook: forget the parsed block so the next read looks at the DOM again. */
export function resetPrerenderDataCache() {
  cached = undefined;
}

/**
 * A build-time markdown article shaped like a row of the articles table. This
 * is what the article page renders when no row exists for the slug (US-074).
 */
export function toStaticArticleRow(article: StaticArticle): Article {
  return {
    ...article,
    id: `static-${article.slug}`,
    published: true,
    created_at: `${article.published_at}T12:00:00.000Z`,
    updated_at: `${article.updated_at}T12:00:00.000Z`,
    image_url: null,
    social_image_url: null,
    view_count: 0,
  } as unknown as Article;
}

// --- topic hubs -------------------------------------------------------------

export interface TopicHubConfig {
  title: string;
  description: string;
  keywords: string[];
  relatedCategories: string[];
  relatedTags: string[];
  /** Slug of the main pillar article, if there is one. */
  pillarContent?: string;
}

/**
 * Topic hub configuration for the pillar content strategy. Lives here rather
 * than in TopicHub.tsx because the prerenderer has to apply the same matching
 * rules to build the hub's embedded article list.
 */
export const TOPIC_HUBS: Record<string, TopicHubConfig> = {
  'ai-crm-automation': {
    title: 'AI CRM Automation',
    description:
      'Research, teardowns and field notes on making the CRM run itself — capture-layer automation, agentic workflows, and why most AI CRM projects fail before they start.',
    keywords: [
      'AI CRM automation',
      'CRM automation',
      'sales automation',
      'agentic CRM',
      'CRM data quality',
      'RevOps',
    ],
    relatedCategories: ['CRM', 'Sales', 'AI'],
    relatedTags: [
      'CRM',
      'CRM Automation',
      'Sales Automation',
      'HubSpot',
      'Salesforce',
      'Pipeline',
      'RevOps',
      'AI Agents',
    ],
    pillarContent: 'ai-crm-automation-complete-guide',
  },
  'ai-automation': {
    title: 'AI Automation',
    description:
      'Complete guide to AI automation for business. Learn how to implement AI-powered workflows, reduce manual tasks, and transform your operations.',
    keywords: [
      'AI automation',
      'business automation',
      'workflow automation',
      'AI tools',
      'automation strategy',
    ],
    relatedCategories: ['AI', 'Technology', 'Business'],
    relatedTags: ['AI', 'Automation', 'Machine Learning', 'Workflow', 'Productivity'],
  },
  'business-optimization': {
    title: 'Business Optimization',
    description:
      'Strategies and insights for optimizing business operations, improving efficiency, and driving growth through technology and AI.',
    keywords: [
      'business optimization',
      'process improvement',
      'efficiency',
      'growth strategies',
      'business transformation',
    ],
    relatedCategories: ['Business', 'Strategy', 'Management'],
    relatedTags: ['Optimization', 'Efficiency', 'Growth', 'Strategy', 'ROI'],
  },
  'machine-learning': {
    title: 'Machine Learning',
    description:
      'Explore machine learning concepts, applications, and implementation strategies for business. From basics to advanced use cases.',
    keywords: ['machine learning', 'ML', 'AI', 'predictive analytics', 'data science'],
    relatedCategories: ['AI', 'Technology', 'Data'],
    relatedTags: [
      'Machine Learning',
      'AI',
      'Data Science',
      'Predictive Analytics',
      'Neural Networks',
    ],
  },
  'digital-transformation': {
    title: 'Digital Transformation',
    description:
      'Navigate your digital transformation journey with insights on technology adoption, change management, and modernizing business processes.',
    keywords: [
      'digital transformation',
      'modernization',
      'technology adoption',
      'change management',
      'digital strategy',
    ],
    relatedCategories: ['Technology', 'Business', 'Strategy'],
    relatedTags: ['Digital Transformation', 'Modernization', 'Cloud', 'Innovation'],
  },
};

/** The columns the topic hub selects, shared with the prerenderer's projection. */
export const TOPIC_HUB_COLUMNS =
  'id, slug, title, excerpt, category, tags, image_url, created_at, read_time, view_count, featured, author';

/**
 * The hub's article list from the database rows (already filtered to
 * published and ordered featured, view_count, created_at descending): built-in
 * articles merged in, re-sorted, then narrowed to the topic's categories and
 * tags.
 */
export function selectTopicArticles<
  T extends {
    slug: string;
    category?: string | null;
    tags?: string[] | null;
    featured?: boolean | null;
    created_at?: string | null;
  },
>(rows: T[] | null | undefined, config: Pick<TopicHubConfig, 'relatedCategories' | 'relatedTags'>) {
  return sortArticleListing(mergeStaticArticles(rows)).filter((article) => {
    const matchesCategory = config.relatedCategories.some(
      (cat) => article.category?.toLowerCase() === cat.toLowerCase()
    );
    const matchesTags = config.relatedTags.some((tag) =>
      article.tags?.some((t: string) => t.toLowerCase() === tag.toLowerCase())
    );
    return matchesCategory || matchesTags;
  });
}
