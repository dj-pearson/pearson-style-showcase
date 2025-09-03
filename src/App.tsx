import { Toaster } from "@/components/ui/toaster";
import URLHandler from "./components/URLHandler";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Analytics from "./components/Analytics";
import ScrollTracker from "./components/ScrollTracker";
import Index from "./pages/Index";
import About from "./pages/About";
import Projects from "./pages/Projects";
import News from "./pages/News";
import Article from "./pages/Article";
import AITools from "./pages/AITools";
import Connect from "./pages/Connect";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import SitemapXML from "./pages/SitemapXML";
import RobotsTxt from "./pages/RobotsTxt";
import DateArchive from "./pages/DateArchive";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <URLHandler>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Analytics />
        <ScrollTracker />
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
        </BrowserRouter>
      </URLHandler>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
