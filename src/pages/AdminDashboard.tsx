import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  LogOut, 
  Shield, 
  Database, 
  Users, 
  FileText, 
  Wrench,
  BarChart3,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  two_factor_enabled: boolean;
  last_login: string | null;
  created_at: string;
}

interface DashboardStats {
  projects: number;
  articles: number;
  aiTools: number;
  totalViews: number;
}

const AdminDashboard = () => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    projects: 0,
    articles: 0,
    aiTools: 0,
    totalViews: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAuth();
    loadDashboardData();
  }, []);

  const checkAdminAuth = async () => {
    try {
      const response = await fetch(`https://qazhdcqvjppbbjxzvisp.supabase.co/functions/v1/admin-auth/me`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhemhkY3F2anBwYmJqeHp2aXNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MTM5NzEsImV4cCI6MjA2ODA4OTk3MX0.-axZYOX3tBQDUy2EWuG5kNvswOc4iRq0QMFcGkQeRlM`
        }
      });
      
      if (!response.ok) {
        navigate('/admin/login');
        return;
      }
      
      const userData = await response.json();
      setAdminUser(userData);
    } catch (error) {
      navigate('/admin/login');
    }
  };

  const loadDashboardData = async () => {
    try {
      const [projectsData, articlesData, aiToolsData] = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact' }),
        supabase.from('articles').select('view_count', { count: 'exact' }),
        supabase.from('ai_tools').select('*', { count: 'exact' })
      ]);

      const totalViews = articlesData.data?.reduce((sum, article) => sum + (article.view_count || 0), 0) || 0;

      setStats({
        projects: projectsData.count || 0,
        articles: articlesData.count || 0,
        aiTools: aiToolsData.count || 0,
        totalViews
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`https://qazhdcqvjppbbjxzvisp.supabase.co/functions/v1/admin-auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhemhkY3F2anBwYmJqeHp2aXNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MTM5NzEsImV4cCI6MjA2ODA4OTk3MX0.-axZYOX3tBQDUy2EWuG5kNvswOc4iRq0QMFcGkQeRlM`
        }
      });
      
      toast({
        title: "Logged out successfully",
        description: "You have been securely logged out",
      });
      
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              </div>
              {adminUser?.two_factor_enabled && (
                <Badge variant="secondary">2FA Enabled</Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {adminUser?.username}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.projects}</div>
              <p className="text-xs text-muted-foreground">Active projects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Articles</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.articles}</div>
              <p className="text-xs text-muted-foreground">Published articles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Tools</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.aiTools}</div>
              <p className="text-xs text-muted-foreground">Available tools</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalViews}</div>
              <p className="text-xs text-muted-foreground">Article views</p>
            </CardContent>
          </Card>
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="articles">Articles</TabsTrigger>
            <TabsTrigger value="tools">AI Tools</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                  <CardDescription>Current system health and activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Database Connected</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Authentication Active</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm">All Services Running</span>
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
                    <div className="flex items-center space-x-3">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Dashboard accessed by {adminUser?.username}</span>
                      <span className="text-xs text-muted-foreground">Just now</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Database synchronized</span>
                      <span className="text-xs text-muted-foreground">5 minutes ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <Card>
              <CardHeader>
                <CardTitle>Project Management</CardTitle>
                <CardDescription>Manage your portfolio projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Project Management</h3>
                  <p className="text-muted-foreground mb-4">
                    Create, edit, and organize your portfolio projects
                  </p>
                  <Button>Add New Project</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="articles">
            <Card>
              <CardHeader>
                <CardTitle>Article Management</CardTitle>
                <CardDescription>Manage your blog articles and news</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Article Management</h3>
                  <p className="text-muted-foreground mb-4">
                    Create, edit, and publish articles and news posts
                  </p>
                  <Button>Create Article</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools">
            <Card>
              <CardHeader>
                <CardTitle>AI Tools Management</CardTitle>
                <CardDescription>Manage your AI tools and resources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">AI Tools Management</h3>
                  <p className="text-muted-foreground mb-4">
                    Add, edit, and organize your AI tools collection
                  </p>
                  <Button>Add AI Tool</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Admin Settings</CardTitle>
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
                    <Badge variant={adminUser?.two_factor_enabled ? "default" : "secondary"}>
                      {adminUser?.two_factor_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Account Information</h3>
                      <p className="text-sm text-muted-foreground">
                        Email: {adminUser?.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Last login: {adminUser?.last_login ? new Date(adminUser.last_login).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    <Button variant="outline">
                      <Settings className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;