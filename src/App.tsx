import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import URLHandler from './components/URLHandler';
import SecurityWarningBanner from './components/SecurityWarningBanner';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

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
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { Sentry } from './lib/sentry';
import SuspenseFallback from './components/SuspenseFallback';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import AccessibilityWidget from './components/AccessibilityWidget';
import RouteAnnouncer from './components/RouteAnnouncer';

// Lazy load pages to reduce initial bundle and improve FID
import Index from './pages/Index';
const About = lazy(() => import('./pages/About'));
const Projects = lazy(() => import('./pages/Projects'));
const News = lazy(() => import('./pages/News'));
const Article = lazy(() => import('./pages/Article'));
const AITools = lazy(() => import('./pages/AITools'));
const Connect = lazy(() => import('./pages/Connect'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));
const SitemapXML = lazy(() => import('./pages/SitemapXML'));
const RobotsTxt = lazy(() => import('./pages/RobotsTxt'));
const DateArchive = lazy(() => import('./pages/DateArchive'));
const AuthCallback = lazy(() => import('./components/auth/AuthCallback'));
const FAQ = lazy(() => import('./pages/FAQ'));
const CategoryArchive = lazy(() => import('./pages/CategoryArchive'));
const TagArchive = lazy(() => import('./pages/TagArchive'));
const AuthorArchive = lazy(() => import('./pages/AuthorArchive'));
const TopicHub = lazy(() => import('./pages/TopicHub'));
const Topics = lazy(() => import('./pages/Topics'));
const RSSFeed = lazy(() => import('./pages/RSSFeed'));
const Search = lazy(() => import('./pages/Search'));
const Status = lazy(() => import('./pages/Status'));
const Accessibility = lazy(() => import('./pages/Accessibility'));

// Configure QueryClient with optimized defaults for better caching
const queryClient = new QueryClient({
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
        <Sonner />
        <BrowserRouter>
          <AccessibilityProvider>
            <AuthProvider>
              <SecurityWarningBanner />
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
                      <Route path="/" element={<Index />} errorElement={<RouteErrorBoundary />} />
                      <Route
                        path="/about"
                        element={<About />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/projects"
                        element={<Projects />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/news"
                        element={<News />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/news/category/:category"
                        element={<CategoryArchive />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/news/tag/:tag"
                        element={<TagArchive />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/author/:author"
                        element={<AuthorArchive />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/topics"
                        element={<Topics />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/topics/:topic"
                        element={<TopicHub />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/news/:slug"
                        element={<Article />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/ai-tools"
                        element={<AITools />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/connect"
                        element={<Connect />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/search"
                        element={<Search />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      {/* Public system status page (no auth required) */}
                      <Route
                        path="/status"
                        element={<Status />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route path="/faq" element={<FAQ />} errorElement={<RouteErrorBoundary />} />
                      <Route
                        path="/accessibility"
                        element={<Accessibility />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/admin/login"
                        element={<AdminLogin />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/auth/callback"
                        element={<AuthCallback />}
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route
                        path="/admin/dashboard"
                        element={
                          <ProtectedRoute requireAdmin={true}>
                            <AdminDashboard />
                          </ProtectedRoute>
                        }
                        errorElement={<RouteErrorBoundary />}
                      />
                      <Route path="/sitemap.xml" element={<SitemapXML />} />
                      <Route path="/robots.txt" element={<RobotsTxt />} />
                      <Route path="/rss.xml" element={<RSSFeed />} />
                      <Route path="/feed" element={<RSSFeed />} />

                      {/* Date archives - noindex and redirect */}
                      <Route path="/2023/*" element={<DateArchive />} />
                      <Route path="/2025/*" element={<DateArchive />} />
                      <Route path="/article/:slug" element={<Article />} />
                      <Route path="/article/*" element={<Navigate to="/news" replace />} />
                      <Route path="/product/*" element={<Navigate to="/ai-tools" replace />} />
                      <Route
                        path="/unveiling-the-future-of-ai-prompt-engineering"
                        element={<Navigate to="/news" replace />}
                      />
                      <Route path="/quest-ai" element={<Navigate to="/ai-tools" replace />} />
                      <Route path="/brandmark-ai" element={<Navigate to="/ai-tools" replace />} />
                      <Route
                        path="/what-is-prompt-engineering"
                        element={<Navigate to="/news" replace />}
                      />
                      <Route path="/news-tech-insights" element={<Navigate to="/news" replace />} />
                      <Route
                        path="/apollo-io-review"
                        element={<Navigate to="/ai-tools" replace />}
                      />
                      <Route path="/cliqly-email" element={<Navigate to="/ai-tools" replace />} />
                      <Route
                        path="/cloud-and-hybrid-printing"
                        element={<Navigate to="/news" replace />}
                      />
                      <Route
                        path="/basics-of-prompt-engineering"
                        element={<Navigate to="/news" replace />}
                      />
                      <Route path="/zendesk-ai" element={<Navigate to="/ai-tools" replace />} />
                      <Route
                        path="/ai-powered-threat-analysis"
                        element={<Navigate to="/news" replace />}
                      />
                      <Route
                        path="/apollo-conversations"
                        element={<Navigate to="/ai-tools" replace />}
                      />
                      <Route path="/financial-ai" element={<Navigate to="/ai-tools" replace />} />
                      <Route path="/finalscout-ai" element={<Navigate to="/ai-tools" replace />} />
                      <Route path="/fine-tuner-ai" element={<Navigate to="/ai-tools" replace />} />
                      <Route
                        path="/eco-friendly-printing"
                        element={<Navigate to="/news" replace />}
                      />
                      <Route path="/ai-prompt-engineer" element={<Navigate to="/news" replace />} />
                      <Route path="/ai-vs-human" element={<Navigate to="/news" replace />} />
                      <Route
                        path="/ai-predictive-analytics"
                        element={<Navigate to="/ai-tools" replace />}
                      />
                      <Route path="/intuitive-ai" element={<Navigate to="/ai-tools" replace />} />
                      <Route
                        path="/apollo-lead-generation"
                        element={<Navigate to="/ai-tools" replace />}
                      />
                      <Route path="/reel-fyi" element={<Navigate to="/ai-tools" replace />} />
                      <Route
                        path="/ai-sentiment-analysis"
                        element={<Navigate to="/ai-tools" replace />}
                      />
                      <Route
                        path="/cybersecurity-ai"
                        element={<Navigate to="/ai-tools" replace />}
                      />
                      <Route path="/ia-presenter" element={<Navigate to="/ai-tools" replace />} />
                      <Route path="/notion-ai" element={<Navigate to="/ai-tools" replace />} />
                      <Route path="/prompt-engineering" element={<Navigate to="/news" replace />} />
                      <Route
                        path="/secure-print-management"
                        element={<Navigate to="/news" replace />}
                      />
                      <Route
                        path="/impact-of-nfts-on-social-media"
                        element={<Navigate to="/news" replace />}
                      />
                      <Route
                        path="/prompt-engineering-for-chatbots"
                        element={<Navigate to="/news" replace />}
                      />
                      <Route
                        path="/ai-prompt-engineering-and-misinformation"
                        element={<Navigate to="/news" replace />}
                      />
                      <Route
                        path="/store-cryptocurrencies"
                        element={<Navigate to="/news" replace />}
                      />

                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Sentry.ErrorBoundary>
                </Suspense>
              </URLHandler>
            </AuthProvider>
            <AccessibilityWidget />
          </AccessibilityProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
