import { lazyWithPreload } from '@/lib/lazyWithPreload';

/**
 * Every lazily loaded route component, in one place so App.tsx (rendering),
 * main.tsx (preloading the prerendered entry route) and RoutePrefetcher
 * (idle-time prefetch) share the same cached modules.
 */
export const routeComponents = {
  Index: lazyWithPreload(() => import('@/pages/Index')),
  About: lazyWithPreload(() => import('@/pages/About')),
  Projects: lazyWithPreload(() => import('@/pages/Projects')),
  News: lazyWithPreload(() => import('@/pages/News')),
  Article: lazyWithPreload(() => import('@/pages/Article')),
  AITools: lazyWithPreload(() => import('@/pages/AITools')),
  AICrmAutomation: lazyWithPreload(() => import('@/pages/AICrmAutomation')),
  Connect: lazyWithPreload(() => import('@/pages/Connect')),
  AdminLogin: lazyWithPreload(() => import('@/pages/AdminLogin')),
  AdminDashboard: lazyWithPreload(() => import('@/pages/AdminDashboard')),
  NotFound: lazyWithPreload(() => import('@/pages/NotFound')),
  SitemapXML: lazyWithPreload(() => import('@/pages/SitemapXML')),
  RobotsTxt: lazyWithPreload(() => import('@/pages/RobotsTxt')),
  DateArchive: lazyWithPreload(() => import('@/pages/DateArchive')),
  AuthCallback: lazyWithPreload(() => import('@/components/auth/AuthCallback')),
  FAQ: lazyWithPreload(() => import('@/pages/FAQ')),
  CategoryArchive: lazyWithPreload(() => import('@/pages/CategoryArchive')),
  TagArchive: lazyWithPreload(() => import('@/pages/TagArchive')),
  AuthorArchive: lazyWithPreload(() => import('@/pages/AuthorArchive')),
  TopicHub: lazyWithPreload(() => import('@/pages/TopicHub')),
  Topics: lazyWithPreload(() => import('@/pages/Topics')),
  RSSFeed: lazyWithPreload(() => import('@/pages/RSSFeed')),
  Search: lazyWithPreload(() => import('@/pages/Search')),
  Status: lazyWithPreload(() => import('@/pages/Status')),
  Accessibility: lazyWithPreload(() => import('@/pages/Accessibility')),
  Showcase: lazyWithPreload(() => import('@/pages/Showcase')),
  PrivacyPolicy: lazyWithPreload(() => import('@/pages/PrivacyPolicy')),
  TermsOfService: lazyWithPreload(() => import('@/pages/TermsOfService')),
  CookiePolicy: lazyWithPreload(() => import('@/pages/CookiePolicy')),
  NewsletterConfirm: lazyWithPreload(() => import('@/pages/NewsletterConfirm')),
  NewsletterUnsubscribe: lazyWithPreload(() => import('@/pages/NewsletterUnsubscribe')),
};

export type RouteComponentName = keyof typeof routeComponents;

/**
 * Paths that scripts/prerender.mjs fills with real HTML. That script also
 * parses this list to add modulepreload links for each route's chunk, so keep
 * every entry on one line in the `[/regex/, 'Name']` form. '/' is Index: lazy
 * like the rest, so gsap and the homepage code stay off the article pages.
 * /news/category/* and /news/tag/* have an extra segment, so they don't match
 * the article pattern.
 */
const PRERENDERED_ROUTES: Array<[RegExp, RouteComponentName]> = [
  [/^\/$/, 'Index'],
  [/^\/news\/[^/]+\/?$/, 'Article'],
  [/^\/ai-crm-automation\/?$/, 'AICrmAutomation'],
  [
    /^\/topics\/(ai-crm-automation|ai-automation|business-optimization|machine-learning|digital-transformation)\/?$/,
    'TopicHub',
  ],
  [/^\/about\/?$/, 'About'],
  [/^\/projects\/?$/, 'Projects'],
  [/^\/news\/?$/, 'News'],
  [/^\/connect\/?$/, 'Connect'],
  [/^\/ai-tools\/?$/, 'AITools'],
  [/^\/topics\/?$/, 'Topics'],
  [/^\/faq\/?$/, 'FAQ'],
  [/^\/showcase\/?$/, 'Showcase'],
  [/^\/privacy\/?$/, 'PrivacyPolicy'],
  [/^\/terms\/?$/, 'TermsOfService'],
  [/^\/cookies\/?$/, 'CookiePolicy'],
  [/^\/accessibility\/?$/, 'Accessibility'],
  [/^\/status\/?$/, 'Status'],
];

export function prerenderedRouteFor(pathname: string): RouteComponentName | undefined {
  return PRERENDERED_ROUTES.find(([pattern]) => pattern.test(pathname))?.[1];
}

/**
 * Loads the chunk for a prerendered entry route so the first commit renders
 * the page instead of the Suspense skeleton. Resolves after `timeoutMs` even if
 * the chunk is still in flight, and never rejects.
 */
export function preloadPrerenderedRoute(
  pathname: string,
  timeoutMs = 1500
): Promise<void> | undefined {
  const name = prerenderedRouteFor(pathname);
  if (!name) return undefined;
  return Promise.race([
    routeComponents[name].preload().then(
      () => undefined,
      () => undefined
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
