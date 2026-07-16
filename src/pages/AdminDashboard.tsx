import { useState, useEffect, lazy, Suspense } from 'react';
import { logger } from '@/lib/logger';
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
  Server,
  Globe,
  ChevronDown,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { hasUnsavedChanges } from '@/lib/unsaved-changes';
import UnsavedChangesDialog from '@/components/UnsavedChangesDialog';

// Lazy load all admin modules for better performance
// This reduces initial bundle size by ~60-80%
const ArticleManager = lazy(() =>
  import('@/components/admin/ArticleManager').then((m) => ({ default: m.ArticleManager }))
);
const ProjectManager = lazy(() =>
  import('@/components/admin/ProjectManager').then((m) => ({ default: m.ProjectManager }))
);
const TaskManagementDashboard = lazy(() =>
  import('@/components/admin/TaskManagementDashboard').then((m) => ({
    default: m.TaskManagementDashboard,
  }))
);
const AIToolsManager = lazy(() =>
  import('@/components/admin/AIToolsManager').then((m) => ({ default: m.AIToolsManager }))
);
const AIArticleGenerator = lazy(() =>
  import('@/components/admin/AIArticleGenerator').then((m) => ({ default: m.AIArticleGenerator }))
);
const AmazonPipelineManager = lazy(() =>
  import('@/components/admin/AmazonPipelineManager').then((m) => ({
    default: m.AmazonPipelineManager,
  }))
);
const AnalyticsSettings = lazy(() => import('@/components/admin/AnalyticsSettings'));
const SEOManager = lazy(() => import('@/components/admin/SEOManager'));
const NewsletterManager = lazy(() => import('@/components/admin/NewsletterManager'));
const WebhookSettings = lazy(() =>
  import('@/components/admin/WebhookSettings').then((m) => ({ default: m.WebhookSettings }))
);
const CommandCenterDashboard = lazy(() =>
  import('@/components/admin/CommandCenterDashboard').then((m) => ({
    default: m.CommandCenterDashboard,
  }))
);
const SupportTicketDashboard = lazy(() =>
  import('@/components/admin/SupportTicketDashboard').then((m) => ({
    default: m.SupportTicketDashboard,
  }))
);
const MaintenanceDashboard = lazy(() =>
  import('@/components/admin/MaintenanceDashboard').then((m) => ({
    default: m.MaintenanceDashboard,
  }))
);
const TestimonialsManager = lazy(() => import('@/components/admin/TestimonialsManager'));
const VenturesManager = lazy(() => import('@/components/admin/VenturesManager'));
const ProfileSettingsManager = lazy(() => import('@/components/admin/ProfileSettingsManager'));
const AccountingDashboard = lazy(() =>
  import('@/components/admin/AccountingDashboard').then((m) => ({ default: m.AccountingDashboard }))
);
const AIModelConfigManager = lazy(() =>
  import('@/components/admin/AIModelConfigManager').then((m) => ({
    default: m.AIModelConfigManager,
  }))
);
const SecureVaultDashboard = lazy(() =>
  import('@/components/admin/vault/SecureVaultDashboard').then((m) => ({
    default: m.SecureVaultDashboard,
  }))
);
const ServerHealthDashboard = lazy(() =>
  import('@/components/admin/ServerHealthDashboard').then((m) => ({
    default: m.ServerHealthDashboard,
  }))
);
const OddTrafficMonitor = lazy(() => import('@/components/admin/OddTrafficMonitor'));

// Loading fallback for lazy-loaded modules. After 10s of loading it surfaces a
// "taking longer than expected" message with a retry button, since a stuck
// dynamic import (e.g. a chunk load failure) otherwise spins forever.
const ModuleLoader = () => {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, []);

  if (timedOut) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <span className="text-sm font-medium">This module is taking longer than expected</span>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading module...</span>
      </div>
    </div>
  );
};

interface DashboardStats {
  projects: number;
  articles: number;
  aiTools: number;
  totalViews: number;
}

// localStorage key for the sidebar group expand/collapse state.
const SIDEBAR_GROUPS_KEY = 'admin_sidebar_open_groups';

// Which stat cards are backed by which underlying query, so a single failed
// query only marks its own card(s) as errored.
type StatKey = 'projects' | 'articles' | 'aiTools' | 'totalViews';

const AdminDashboard = () => {
  const { adminUser, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    projects: 0,
    articles: 0,
    aiTools: 0,
    totalViews: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  // Per-stat error flags so one failed query only errors its own card(s).
  const [statErrors, setStatErrors] = useState<Record<StatKey, boolean>>({
    projects: false,
    articles: false,
    aiTools: false,
    totalViews: false,
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [activeView, setActiveView] = useState('overview');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Standalone top-level item (dashboard home), shown above the groups.
  const overviewItem = { id: 'overview', label: 'Overview', icon: LayoutDashboard };

  // Menu items organized into logical, collapsible groups so 18+ items stay
  // navigable (especially on mobile).
  const menuGroups = [
    {
      id: 'content',
      label: 'Content',
      items: [
        { id: 'articles', label: 'Articles', icon: FileText },
        { id: 'projects', label: 'Projects', icon: FolderKanban },
        { id: 'tools', label: 'AI Tools', icon: Wrench },
        { id: 'seo', label: 'SEO', icon: Search },
        { id: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
        { id: 'ventures', label: 'Ventures', icon: Rocket },
      ],
    },
    {
      id: 'operations',
      label: 'Operations',
      items: [
        { id: 'amazon', label: 'Amazon Pipeline', icon: ShoppingCart },
        { id: 'traffic-watch', label: 'Traffic Watch', icon: Globe },
        { id: 'newsletter', label: 'Newsletter', icon: Mail },
        { id: 'tasks', label: 'Task Management', icon: Database },
      ],
    },
    {
      id: 'finance',
      label: 'Finance',
      items: [{ id: 'accounting', label: 'Accounting', icon: Calculator }],
    },
    {
      id: 'security',
      label: 'Security',
      items: [{ id: 'vault', label: 'Secure Vault', icon: Shield }],
    },
    {
      id: 'system',
      label: 'System',
      items: [
        { id: 'command-center', label: 'Command Center', icon: Activity },
        { id: 'server-health', label: 'Server Health', icon: Server },
        { id: 'support', label: 'Support Tickets', icon: MessageSquare },
        { id: 'ai-config', label: 'AI Configuration', icon: Activity },
        { id: 'maintenance', label: 'Maintenance', icon: Zap },
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  // Persisted expand/collapse state for the sidebar groups. On first load with
  // no stored preference: expand everything on desktop, but on mobile (<640px)
  // collapse all groups except the one containing the active view.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_GROUPS_KEY);
      if (stored) return JSON.parse(stored) as Record<string, boolean>;
    } catch {
      /* ignore malformed storage */
    }
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const activeGroupId = menuGroups.find((g) => g.items.some((i) => i.id === activeView))?.id;
    const initial: Record<string, boolean> = {};
    for (const g of menuGroups) {
      initial[g.id] = isMobile ? g.id === activeGroupId : true;
    }
    return initial;
  });

  // Persist expand/collapse state across sessions.
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(openGroups));
    } catch {
      /* ignore storage failures */
    }
  }, [openGroups]);

  const toggleGroup = (id: string) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  // Guard sidebar tab switches: if a mounted form has unsaved changes, confirm
  // before changing views (tab switches are state changes, not route nav).
  const [pendingView, setPendingView] = useState<string | null>(null);
  const requestView = (id: string) => {
    if (id === activeView) return;
    if (hasUnsavedChanges()) {
      setPendingView(id);
    } else {
      setActiveView(id);
    }
  };
  const confirmViewChange = () => {
    if (pendingView) setActiveView(pendingView);
    setPendingView(null);
  };
  const cancelViewChange = () => setPendingView(null);

  // Aggregate error flag (true if any stat query failed) for the overview
  // system-status card.
  const hasError = Object.values(statErrors).some(Boolean);

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
    // Run the three stat queries independently so one failure doesn't wipe out
    // the other cards. The articles query backs both the Articles and Views
    // cards, so those two share its success/failure.
    const [projectsRes, articlesRes, aiToolsRes] = await Promise.allSettled([
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('articles').select('view_count', { count: 'exact' }),
      supabase.from('ai_tools').select('id', { count: 'exact', head: true }),
    ]);

    const projectsOk = projectsRes.status === 'fulfilled' && !projectsRes.value.error;
    const articlesOk = articlesRes.status === 'fulfilled' && !articlesRes.value.error;
    const aiToolsOk = aiToolsRes.status === 'fulfilled' && !aiToolsRes.value.error;

    const nextStats: DashboardStats = { ...stats };
    if (projectsOk) {
      nextStats.projects = projectsRes.value.count || 0;
    }
    if (articlesOk) {
      const articleRows = articlesRes.value.data as { view_count: number | null }[] | null;
      nextStats.articles = articlesRes.value.count || 0;
      nextStats.totalViews = articleRows?.reduce((sum, a) => sum + (a.view_count || 0), 0) || 0;
    }
    if (aiToolsOk) {
      nextStats.aiTools = aiToolsRes.value.count || 0;
    }

    setStats(nextStats);
    setStatErrors({
      projects: !projectsOk,
      articles: !articlesOk,
      aiTools: !aiToolsOk,
      totalViews: !articlesOk,
    });

    if (!projectsOk || !articlesOk || !aiToolsOk) {
      logger.error('Error loading one or more dashboard stats', {
        projectsOk,
        articlesOk,
        aiToolsOk,
      });
      toast({
        variant: 'destructive',
        title: 'Some dashboard stats failed to load',
        description: 'Only the affected cards show an error. Click a card’s retry to try again.',
      });
    } else {
      setLastRefreshed(new Date());
    }

    setIsLoading(false);
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
        title: 'Logged out successfully',
        description: 'You have been securely logged out',
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
                  <div
                    className={`w-3 h-3 rounded-full ${hasError ? 'bg-yellow-500' : 'bg-green-500'}`}
                  ></div>
                  <span className="text-sm">
                    {hasError ? 'Database Error' : 'Database Connected'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Authentication Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${hasError ? 'bg-yellow-500' : 'bg-green-500'}`}
                  ></div>
                  <span className="text-sm">
                    {hasError ? 'Some Services Degraded' : 'All Services Running'}
                  </span>
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
        case 'traffic-watch':
          return (
            <SectionErrorBoundary sectionName="Traffic Watch">
              <OddTrafficMonitor />
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
                      <Badge variant={adminUser ? 'default' : 'secondary'}>
                        {adminUser ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-medium">Account Information</h3>
                        <p className="text-sm text-muted-foreground">Email: {adminUser?.email}</p>
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

    return <Suspense fallback={<ModuleLoader />}>{lazyContent}</Suspense>;
  };

  return (
    <>
      <SEO title="Admin Dashboard | Dan Pearson" description="Admin dashboard" noIndex={true} />
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full bg-background">
          {/* Sidebar Navigation */}
          <Sidebar collapsible="icon" className="border-r">
            <SidebarContent>
              {/* Standalone dashboard home */}
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => requestView(overviewItem.id)}
                        isActive={activeView === overviewItem.id}
                        tooltip={overviewItem.label}
                      >
                        <overviewItem.icon className="h-4 w-4" />
                        <span>{overviewItem.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {/* Collapsible, grouped navigation */}
              {menuGroups.map((group) => {
                const isOpen = openGroups[group.id] ?? true;
                return (
                  <Collapsible
                    key={group.id}
                    open={isOpen}
                    onOpenChange={() => toggleGroup(group.id)}
                  >
                    <SidebarGroup>
                      <SidebarGroupLabel asChild>
                        <CollapsibleTrigger
                          className="flex w-full items-center justify-between gap-2"
                          aria-label={`${group.label} section, ${isOpen ? 'expanded' : 'collapsed'}`}
                        >
                          <span>{group.label}</span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                          />
                        </CollapsibleTrigger>
                      </SidebarGroupLabel>
                      <CollapsibleContent>
                        <SidebarGroupContent>
                          <SidebarMenu>
                            {group.items.map((item) => (
                              <SidebarMenuItem key={item.id}>
                                <SidebarMenuButton
                                  onClick={() => requestView(item.id)}
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
                      </CollapsibleContent>
                    </SidebarGroup>
                  </Collapsible>
                );
              })}
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
                      <Badge variant="secondary" className="hidden md:inline-flex">
                        Admin
                      </Badge>
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
                  {(
                    [
                      {
                        key: 'projects',
                        label: 'Projects',
                        value: stats.projects,
                        sub: 'Active',
                        icon: Database,
                      },
                      {
                        key: 'articles',
                        label: 'Articles',
                        value: stats.articles,
                        sub: 'Published',
                        icon: FileText,
                      },
                      {
                        key: 'aiTools',
                        label: 'AI Tools',
                        value: stats.aiTools,
                        sub: 'Available',
                        icon: Wrench,
                      },
                      {
                        key: 'totalViews',
                        label: 'Views',
                        value: stats.totalViews,
                        sub: 'Total',
                        icon: BarChart3,
                      },
                    ] as {
                      key: StatKey;
                      label: string;
                      value: number;
                      sub: string;
                      icon: typeof Database;
                    }[]
                  ).map(({ key, label, value, sub, icon: Icon }) => (
                    <Card key={label} className="p-0">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium truncate">
                          {label}
                        </CardTitle>
                        <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                        {isLoading ? (
                          <>
                            <div className="h-7 sm:h-8 w-12 bg-muted animate-pulse rounded mb-1" />
                            <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                          </>
                        ) : statErrors[key] ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-destructive">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              <span className="text-xs font-medium">Failed to load</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleRefresh}
                              disabled={isLoading}
                              className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                              Retry
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="text-xl sm:text-2xl font-bold">
                              {value.toLocaleString()}
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">{sub}</p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
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

        {/* Warn before switching tabs away from a form with unsaved changes */}
        <UnsavedChangesDialog
          open={pendingView !== null}
          onDiscard={confirmViewChange}
          onKeepEditing={cancelViewChange}
        />
      </SidebarProvider>
    </>
  );
};

export default AdminDashboard;
