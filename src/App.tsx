import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import URLHandler from "./components/URLHandler";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Analytics from "./components/Analytics";
import ScrollTracker from "./components/ScrollTracker";
import LoadingSpinner from "./components/LoadingSpinner";

// Lazy load pages to reduce initial bundle and improve FID
import Index from "./pages/Index";
const About = lazy(() => import("./pages/About"));
const Projects = lazy(() => import("./pages/Projects"));
const News = lazy(() => import("./pages/News"));
const Article = lazy(() => import("./pages/Article"));
const AITools = lazy(() => import("./pages/AITools"));
const Connect = lazy(() => import("./pages/Connect"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SitemapXML = lazy(() => import("./pages/SitemapXML"));
const RobotsTxt = lazy(() => import("./pages/RobotsTxt"));
const DateArchive = lazy(() => import("./pages/DateArchive"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <URLHandler>
        <Analytics />
        <ScrollTracker />
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/news" element={<News />} />
            <Route path="/news/:slug" element={<Article />} />
            <Route path="/ai-tools" element={<AITools />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/sitemap.xml" element={<SitemapXML />} />
            <Route path="/robots.txt" element={<RobotsTxt />} />
            
            {/* Date archives - noindex and redirect */}
            <Route path="/2023/*" element={<DateArchive />} />
            <Route path="/2025/*" element={<DateArchive />} />
            <Route path="/article/:slug" element={<Article />} />
            <Route path="/article/*" element={<Navigate to="/news" replace />} />
            <Route path="/product/*" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/unveiling-the-future-of-ai-prompt-engineering" element={<Navigate to="/news" replace />} />
            <Route path="/quest-ai" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/brandmark-ai" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/what-is-prompt-engineering" element={<Navigate to="/news" replace />} />
            <Route path="/news-tech-insights" element={<Navigate to="/news" replace />} />
            <Route path="/apollo-io-review" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/cliqly-email" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/cloud-and-hybrid-printing" element={<Navigate to="/news" replace />} />
            <Route path="/basics-of-prompt-engineering" element={<Navigate to="/news" replace />} />
            <Route path="/zendesk-ai" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/ai-powered-threat-analysis" element={<Navigate to="/news" replace />} />
            <Route path="/apollo-conversations" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/financial-ai" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/finalscout-ai" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/fine-tuner-ai" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/eco-friendly-printing" element={<Navigate to="/news" replace />} />
            <Route path="/ai-prompt-engineer" element={<Navigate to="/news" replace />} />
            <Route path="/ai-vs-human" element={<Navigate to="/news" replace />} />
            <Route path="/ai-predictive-analytics" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/intuitive-ai" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/apollo-lead-generation" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/reel-fyi" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/ai-sentiment-analysis" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/cybersecurity-ai" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/ia-presenter" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/notion-ai" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/prompt-engineering" element={<Navigate to="/news" replace />} />
            <Route path="/secure-print-management" element={<Navigate to="/news" replace />} />
            <Route path="/impact-of-nfts-on-social-media" element={<Navigate to="/news" replace />} />
            <Route path="/prompt-engineering-for-chatbots" element={<Navigate to="/news" replace />} />
            <Route path="/ai-prompt-engineering-and-misinformation" element={<Navigate to="/news" replace />} />
            <Route path="/store-cryptocurrencies" element={<Navigate to="/news" replace />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </URLHandler>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
