import { lazy, Suspense, type ComponentType } from 'react';
import { Toaster } from '@/components/ui/toaster';
import URLHandler from './components/URLHandler';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// React Query DevTools are loaded lazily and ONLY in development. In production
// import.meta.env.DEV is statically false, so the dynamic import is dropped and
// the devtools add zero bytes to the production bundle.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools }))
    )
  : (_props: { initialIsOpen?: boolean }) => null;
import Analytics from './components/Analytics';
import TrafficGuard from './components/TrafficGuard';
import ScrollTracker from './components/ScrollTracker';
import RoutePrefetcher from './components/RoutePrefetcher';
import ErrorBoundary from './components/ErrorBoundary';
import { Sentry } from './lib/sentry';
import SuspenseFallback from './components/SuspenseFallback';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import AccessibilityWidget from './components/AccessibilityWidget';
import RouteAnnouncer from './components/RouteAnnouncer';
import CookieConsentBanner from './components/CookieConsentBanner';

// Index is bundled eagerly; every other page is a lazy chunk with preload()
// (see src/lib/routeComponents.ts).
import Index from './pages/Index';
import { routeComponents } from '@/lib/routeComponents';
import { lazyWithPreload } from '@/lib/lazyWithPreload';
import { logger } from '@/lib/logger';

// Admin and OAuth routes share one lazy layout that owns AuthProvider and the
// sonner toaster, so neither ships in the public entry bundle. Both components
// come from the same chunk; resolving the layout also resolves the admin guard,
// so moving from /admin/login to /admin/dashboard renders without suspending.
const AdminOnlyOutlet = lazyWithPreload<object>(() =>
  import('./components/auth/AuthLayout').then((m) => ({ default: m.AdminOnlyOutlet }))
);
const AuthLayout = lazyWithPreload<object>(() =>
  import('./components/auth/AuthLayout').then((m): { default: ComponentType } => {
    void AdminOnlyOutlet.preload().catch(() => undefined);
    return m;
  })
);

const {
  About,
  Projects,
  News,
  Article,
  AITools,
  AICrmAutomation,
  Connect,
  AdminLogin,
  AdminDashboard,
  NotFound,
  SitemapXML,
  RobotsTxt,
  AuthCallback,
  FAQ,
  CategoryArchive,
  TagArchive,
  AuthorArchive,
  TopicHub,
  Topics,
  RSSFeed,
  Search,
  Status,
  Accessibility,
  Showcase,
  PrivacyPolicy,
  TermsOfService,
  CookiePolicy,
} = routeComponents;

// Configure QueryClient with optimized defaults for better caching
const queryClient = new QueryClient({
  // Log every failed query once, with its key, instead of relying on each
  // component to report its own error state.
  queryCache: new QueryCache({
    onError: (error, query) => {
      logger.error('Query failed:', query.queryKey, error);
    },
  }),
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes before considering it stale
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests up to 1 time instead of 3
      retry: 1,
      // Don't refetch on window focus for better performance
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AccessibilityProvider>
            <URLHandler>
              <RouteAnnouncer />
              <TrafficGuard />
              <Analytics />
              <ScrollTracker />
              <RoutePrefetcher />
              <Suspense fallback={<SuspenseFallback />}>
                <Sentry.ErrorBoundary
                  fallback={({ resetError }) => (
                    <div
                      role="alert"
                      className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center"
                    >
                      <h1 className="text-2xl font-bold">Something went wrong</h1>
                      <p className="text-muted-foreground max-w-md">
                        An unexpected error occurred and has been reported. Please try again.
                      </p>
                      <button
                        onClick={resetError}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground min-h-[44px]"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                >
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/news" element={<News />} />
                    <Route path="/news/category/:category" element={<CategoryArchive />} />
                    <Route path="/news/tag/:tag" element={<TagArchive />} />
                    <Route path="/author/:author" element={<AuthorArchive />} />
                    <Route path="/topics" element={<Topics />} />
                    <Route path="/topics/:topic" element={<TopicHub />} />
                    <Route path="/news/:slug" element={<Article />} />
                    <Route path="/ai-crm-automation" element={<AICrmAutomation />} />
                    <Route path="/ai-tools" element={<AITools />} />
                    <Route path="/connect" element={<Connect />} />
                    <Route path="/search" element={<Search />} />
                    {/* Public system status page (no auth required) */}
                    <Route path="/status" element={<Status />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/accessibility" element={<Accessibility />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/cookies" element={<CookiePolicy />} />
                    <Route path="/showcase" element={<Showcase />} />
                    <Route element={<AuthLayout />}>
                      <Route path="/admin/login" element={<AdminLogin />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      <Route element={<AdminOnlyOutlet />}>
                        <Route path="/admin/dashboard" element={<AdminDashboard />} />
                      </Route>
                    </Route>
                    <Route path="/sitemap.xml" element={<SitemapXML />} />
                    <Route path="/robots.txt" element={<RobotsTxt />} />
                    <Route path="/rss.xml" element={<RSSFeed />} />
                    {/* Legacy URLs (/article/*, /feed, /2023/*, old slugs) are 301s in
                        public/_redirects, answered before the app loads. */}

                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Sentry.ErrorBoundary>
              </Suspense>
            </URLHandler>
            <AccessibilityWidget />
            <CookieConsentBanner />
          </AccessibilityProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
