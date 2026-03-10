import { useState, useEffect, lazy, Suspense } from 'react';
import { logger } from "@/lib/logger";
import SEO from '@/components/SEO';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';
import {
  Settings,
  LogOut,
  Shield,
  Database,
  FileText,
  Wrench,
  BarChart3,
  Activity,
  Search,
  Mail,
  LayoutDashboard,
  FolderKanban,
  ShoppingCart,
  MessageSquare,
  Zap,
  Keyboard,
  MessageSquareQuote,
  Rocket,
  User,
  Calculator,
  Loader2,
  RefreshCw,
  AlertCircle,
  Server
} from 'lucide-react';
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from '@/components/admin/KeyboardShortcutsHelp';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Lazy load all admin modules for better performance
// This reduces initial bundle size by ~60-80%
const ArticleManager = lazy(() => import('@/components/admin/ArticleManager').then(m => ({ default: m.ArticleManager })));
const ProjectManager = lazy(() => import('@/components/admin/ProjectManager').then(m => ({ default: m.ProjectManager })));
const TaskManagementDashboard = lazy(() => import('@/components/admin/TaskManagementDashboard').then(m => ({ default: m.TaskManagementDashboard })));
const AIToolsManager = lazy(() => import('@/components/admin/AIToolsManager').then(m => ({ default: m.AIToolsManager })));
const AIArticleGenerator = lazy(() => import('@/components/admin/AIArticleGenerator').then(m => ({ default: m.AIArticleGenerator })));
const AmazonPipelineManager = lazy(() => import('@/components/admin/AmazonPipelineManager').then(m => ({ default: m.AmazonPipelineManager })));
const AnalyticsSettings = lazy(() => import('@/components/admin/AnalyticsSettings'));
const SEOManager = lazy(() => import('@/components/admin/SEOManager'));
const NewsletterManager = lazy(() => import('@/components/admin/NewsletterManager'));
const WebhookSettings = lazy(() => import('@/components/admin/WebhookSettings').then(m => ({ default: m.WebhookSettings })));
const CommandCenterDashboard = lazy(() => import('@/components/admin/CommandCenterDashboard').then(m => ({ default: m.CommandCenterDashboard })));
const SupportTicketDashboard = lazy(() => import('@/components/admin/SupportTicketDashboard').then(m => ({ default: m.SupportTicketDashboard })));
const MaintenanceDashboard = lazy(() => import('@/components/admin/MaintenanceDashboard').then(m => ({ default: m.MaintenanceDashboard })));
const TestimonialsManager = lazy(() => import('@/components/admin/TestimonialsManager'));
const VenturesManager = lazy(() => import('@/components/admin/VenturesManager'));
const ProfileSettingsManager = lazy(() => import('@/components/admin/ProfileSettingsManager'));
const AccountingDashboard = lazy(() => import('@/components/admin/AccountingDashboard').then(m => ({ default: m.AccountingDashboard })));
const AIModelConfigManager = lazy(() => import('@/components/admin/AIModelConfigManager').then(m => ({ default: m.AIModelConfigManager })));
const SecureVaultDashboard = lazy(() => import('@/components/admin/vault/SecureVaultDashboard').then(m => ({ default: m.SecureVaultDashboard })));
const ServerHealthDashboard = lazy(() => import('@/components/admin/ServerHealthDashboard').then(m => ({ default: m.ServerHealthDashboard })));

// Loading fallback for lazy-loaded modules
const ModuleLoader = () => (
  <div className="flex items-center justify-center py-12">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">Loading module...</span>
    </div>
  </div>
);

interface DashboardStats {
  projects: number;
  articles: number;
  aiTools: number;
  totalViews: number;
}

const AdminDashboard = () => {
  const { adminUser, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    projects: 0,
    articles: 0,
    aiTools: 0,
    totalViews: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [activeView, setActiveView] = useState('overview');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'command-center', label: 'Command Center', icon: Activity },
    { id: 'server-health', label: 'Server Health', icon: Server },
    { id: 'support', label: 'Support Tickets', icon: MessageSquare },
    { id: 'vault', label: 'Secure Vault', icon: Shield },
    { id: 'ai-config', label: 'AI Configuration', icon: Activity },
    { id: 'maintenance', label: 'Maintenance', icon: Zap },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
    { id: 'ventures', label: 'Ventures', icon: Rocket },
    { id: 'tasks', label: 'Task Management', icon: Database },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'articles', label: 'Articles', icon: FileText },
    { id: 'tools', label: 'AI Tools', icon: Wrench },
    { id: 'accounting', label: 'Accounting', icon: Calculator },
    { id: 'amazon', label: 'Amazon', icon: ShoppingCart },
    { id: 'newsletter', label: 'Newsletter', icon: Mail },
    { id: 'seo', label: 'SEO', icon: Search },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Keyboard shortcuts configuration
  const shortcuts: KeyboardShortcut[] = [
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      action: () => setShowShortcuts(true),
    },
    {
      key: 'o',
      ctrlKey: true,
      description: 'Go to Overview',
      action: () => setActiveView('overview'),
      preventDefault: true,
    },
    {
      key: 'p',
      ctrlKey: true,
      description: 'Go to Projects',
      action: () => setActiveView('projects'),
      preventDefault: true,
    },
    {
      key: 'a',
      ctrlKey: true,
      description: 'Go to Articles',
      action: () => setActiveView('articles'),
      preventDefault: true,
    },
    {
      key: 's',
      ctrlKey: true,
      description: 'Go to Settings',
      action: () => setActiveView('settings'),
      preventDefault: true,
    },
    {
      key: 'Escape',
      description: 'Close dialogs / Return to Overview',
      action: () => {
        setShowShortcuts(false);
        setActiveView('overview');
      },
    },
  ];

  // Initialize keyboard shortcuts
  useKeyboardShortcuts(shortcuts, !isLoading);

  useEffect(() => {
    // Auth is now handled by AuthContext and ProtectedRoute
    // Just load dashboard data
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setHasError(false);
    try {
      // Optimized queries: only select fields needed for counts and stats
      const [projectsData, articlesData, aiToolsData] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('articles').select('view_count', { count: 'exact' }),
        supabase.from('ai_tools').select('id', { count: 'exact', head: true })
      ]);

      if (projectsData.error) throw projectsData.error;
      if (articlesData.error) throw articlesData.error;
      if (aiToolsData.error) throw aiToolsData.error;

      const totalViews = articlesData.data?.reduce((sum, article) => sum + (article.view_count || 0), 0) || 0;

      setStats({
        projects: projectsData.count || 0,
        articles: articlesData.count || 0,
        aiTools: aiToolsData.count || 0,
        totalViews
      });
      setLastRefreshed(new Date());
    } catch (error) {
      logger.error('Error loading dashboard data:', error);
      setHasError(true);
      toast({
        variant: "destructive",
        title: "Failed to load dashboard data",
        description: "Could not fetch stats. Click refresh to try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    loadDashboardData();
  };

  const handleLogout = async () => {
    try {
      // Use AuthContext signOut method
      await signOut();

      toast({
        title: "Logged out successfully",
        description: "You have been securely logged out",
      });

      navigate('/admin/login');
    } catch (error) {
      logger.error('Logout error:', error);
      navigate('/admin/login');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderContent = () => {
    // Overview doesn't need lazy loading as it's lightweight
    if (activeView === 'overview') {
      const formatRefreshed = () => {
        if (!lastRefreshed) return 'Not yet loaded';
        const now = new Date();
        const diffMs = now.getTime() - lastRefreshed.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 10) return 'Just now';
        if (diffSec < 60) return `${diffSec}s ago`;
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        return lastRefreshed.toLocaleTimeString();
      };

      return (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>System Status</CardTitle>
                  <CardDescription>Current system health and activity</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="shrink-0"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${hasError ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                  <span className="text-sm">{hasError ? 'Database Error' : 'Database Connected'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Authentication Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${hasError ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                  <span className="text-sm">{hasError ? 'Some Services Degraded' : 'All Services Running'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates and changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Dashboard accessed by {adminUser?.username}</span>
                  <span className="text-xs text-muted-foreground">Just now</span>
                </div>
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Stats last refreshed</span>
                  <span className="text-xs text-muted-foreground">{formatRefreshed()}</span>
                </div>
                {hasError && (
                  <div className="flex items-center gap-3 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Data fetch failed — click Refresh to retry</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // All other views use lazy-loaded components wrapped in Suspense and SectionErrorBoundary
    // SectionErrorBoundary prevents one failing module from crashing the entire dashboard
    const lazyContent = (() => {
      switch (activeView) {
        case 'command-center':
          return (
            <SectionErrorBoundary sectionName="Command Center">
              <CommandCenterDashboard />
            </SectionErrorBoundary>
          );
        case 'server-health':
          return (
            <SectionErrorBoundary sectionName="Server Health">
              <ServerHealthDashboard />
            </SectionErrorBoundary>
          );
        case 'support':
          return (
            <SectionErrorBoundary sectionName="Support Tickets">
              <SupportTicketDashboard />
            </SectionErrorBoundary>
          );
        case 'vault':
          return (
            <SectionErrorBoundary sectionName="Secure Vault">
              <SecureVaultDashboard />
            </SectionErrorBoundary>
          );
        case 'maintenance':
          return (
            <SectionErrorBoundary sectionName="Maintenance">
              <MaintenanceDashboard />
            </SectionErrorBoundary>
          );
        case 'profile':
          return (
            <SectionErrorBoundary sectionName="Profile Settings">
              <ProfileSettingsManager />
            </SectionErrorBoundary>
          );
        case 'testimonials':
          return (
            <SectionErrorBoundary sectionName="Testimonials">
              <TestimonialsManager />
            </SectionErrorBoundary>
          );
        case 'ventures':
          return (
            <SectionErrorBoundary sectionName="Ventures">
              <VenturesManager />
            </SectionErrorBoundary>
          );
        case 'tasks':
          return (
            <SectionErrorBoundary sectionName="Task Management">
              <TaskManagementDashboard />
            </SectionErrorBoundary>
          );
        case 'projects':
          return (
            <SectionErrorBoundary sectionName="Projects">
              <ProjectManager />
            </SectionErrorBoundary>
          );
        case 'articles':
          return (
            <div className="space-y-6">
              <SectionErrorBoundary sectionName="AI Article Generator" compact>
                <AIArticleGenerator />
              </SectionErrorBoundary>
              <SectionErrorBoundary sectionName="Article Manager">
                <ArticleManager />
              </SectionErrorBoundary>
            </div>
          );
        case 'tools':
          return (
            <SectionErrorBoundary sectionName="AI Tools">
              <AIToolsManager />
            </SectionErrorBoundary>
          );
        case 'accounting':
          return (
            <SectionErrorBoundary sectionName="Accounting">
              <AccountingDashboard />
            </SectionErrorBoundary>
          );
        case 'ai-config':
          return (
            <SectionErrorBoundary sectionName="AI Configuration">
              <AIModelConfigManager />
            </SectionErrorBoundary>
          );
        case 'amazon':
          return (
            <SectionErrorBoundary sectionName="Amazon Pipeline">
              <AmazonPipelineManager />
            </SectionErrorBoundary>
          );
        case 'newsletter':
          return (
            <SectionErrorBoundary sectionName="Newsletter">
              <NewsletterManager />
            </SectionErrorBoundary>
          );
        case 'seo':
          return (
            <SectionErrorBoundary sectionName="SEO Manager">
              <SEOManager />
            </SectionErrorBoundary>
          );
        case 'settings':
          return (
            <div className="space-y-6">
              <SectionErrorBoundary sectionName="Webhook Settings" compact>
                <WebhookSettings />
              </SectionErrorBoundary>
              <SectionErrorBoundary sectionName="Analytics Settings" compact>
                <AnalyticsSettings />
              </SectionErrorBoundary>

              <Card>
                <CardHeader>
                  <CardTitle>Admin Account Settings</CardTitle>
                  <CardDescription>Configure your admin account and security</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">Two-Factor Authentication</h3>
                        <p className="text-sm text-muted-foreground">
                          Secure your account with TOTP authentication
                        </p>
                      </div>
                      <Badge variant={adminUser ? "default" : "secondary"}>
                        {adminUser ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-medium">Account Information</h3>
                        <p className="text-sm text-muted-foreground">
                          Email: {adminUser?.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Last login: {adminUser?.username ? 'Recently' : 'Never'}
                        </p>
                      </div>
                      <Button variant="outline" aria-label="Edit profile settings">
                        <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
                        Edit Profile
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        default:
          return null;
      }
    })();

    return (
      <Suspense fallback={<ModuleLoader />}>
        {lazyContent}
      </Suspense>
    );
  };

  return (
    <>
    <SEO
      title="Admin Dashboard | Dan Pearson"
      description="Admin dashboard"
      noIndex={true}
    />
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        {/* Sidebar Navigation */}
        <Sidebar collapsible="icon" className="border-r">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => setActiveView(item.id)}
                        isActive={activeView === item.id}
                        tooltip={item.label}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="px-3 sm:px-4 py-3 sm:py-4">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                  <SidebarTrigger className="shrink-0 h-9 w-9 min-h-[44px] min-w-[44px] flex items-center justify-center" />
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
                    <h1 className="text-base sm:text-lg md:text-2xl font-bold truncate">Admin</h1>
                  </div>
                  {adminUser && (
                    <Badge variant="secondary" className="hidden md:inline-flex">Admin</Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0">
                  <span className="text-xs sm:text-sm text-muted-foreground hidden lg:inline">
                    Welcome, {adminUser?.username}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowShortcuts(true)}
                    title="Keyboard Shortcuts (Press ?)"
                    aria-label="Show keyboard shortcuts"
                    className="hidden sm:inline-flex min-h-[44px] min-w-[44px]"
                  >
                    <Keyboard className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="min-h-[44px] px-3 sm:px-4"
                  >
                    <LogOut className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-auto -webkit-overflow-scrolling-touch">
            <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
              {/* Stats Cards with loading skeletons and error recovery */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
                {hasError ? (
                  <Card className="col-span-full p-0">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                          <div>
                            <p className="text-sm font-medium">Failed to load dashboard stats</p>
                            <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRefresh}
                          disabled={isLoading}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                          Retry
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {[
                      { label: 'Projects', value: stats.projects, sub: 'Active', icon: Database },
                      { label: 'Articles', value: stats.articles, sub: 'Published', icon: FileText },
                      { label: 'AI Tools', value: stats.aiTools, sub: 'Available', icon: Wrench },
                      { label: 'Views', value: stats.totalViews, sub: 'Total', icon: BarChart3 },
                    ].map(({ label, value, sub, icon: Icon }) => (
                      <Card key={label} className="p-0">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                          <CardTitle className="text-xs sm:text-sm font-medium truncate">{label}</CardTitle>
                          <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                          {isLoading ? (
                            <>
                              <div className="h-7 sm:h-8 w-12 bg-muted animate-pulse rounded mb-1" />
                              <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                            </>
                          ) : (
                            <>
                              <div className="text-xl sm:text-2xl font-bold">{value.toLocaleString()}</div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">{sub}</p>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </div>

              {/* Dynamic Content */}
              {renderContent()}
            </div>
          </main>
        </div>
      </div>

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsHelp
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
        shortcuts={shortcuts}
      />
    </SidebarProvider>
    </>
  );
};

export default AdminDashboard;