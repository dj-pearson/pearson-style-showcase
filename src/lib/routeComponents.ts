import { lazyWithPreload } from '@/lib/lazyWithPreload';

/**
 * Every lazily loaded route component, in one place so App.tsx (rendering),
 * main.tsx (preloading the prerendered entry route) and RoutePrefetcher
 * (idle-time prefetch) share the same cached modules.
 */
export const routeComponents = {
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
};

export type RouteComponentName = keyof typeof routeComponents;

/**
 * Paths that scripts/prerender.mjs fills with real HTML ('/' is Index, which
 * is bundled eagerly and needs no preload). /news/category/* and /news/tag/*
 * have an extra segment, so they don't match the article pattern.
 */
const PRERENDERED_ROUTES: Array<[RegExp, RouteComponentName]> = [
  [/^\/news\/[^/]+\/?$/, 'Article'],
  [/^\/ai-crm-automation\/?$/, 'AICrmAutomation'],
  [/^\/topics\/ai-crm-automation\/?$/, 'TopicHub'],
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
