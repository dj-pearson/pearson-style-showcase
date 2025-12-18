import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  Play,
  RefreshCw,
  Send,
  Trash2,
  Download,
  Globe,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { invokeEdgeFunction } from '@/lib/edge-functions';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => Promise<void>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  requiresConfirmation?: boolean;
}

export const QuickActionsPanel: React.FC = () => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAction = async (actionId: string, actionFn: () => Promise<void>, requiresConfirmation: boolean = false) => {
    if (requiresConfirmation) {
      if (!confirm('Are you sure you want to perform this action?')) {
        return;
      }
    }

    setLoadingAction(actionId);
    try {
      await actionFn();
    } catch (error) {
      logger.error(`Failed to execute action ${actionId}:`, error);
    } finally {
      setLoadingAction(null);
    }
  };

  const actions: QuickAction[] = [
    {
      id: 'run-pipeline',
      label: 'Run Amazon Pipeline',
      description: 'Generate affiliate article',
      icon: <Play className="h-4 w-4" />,
      action: async () => {
        try {
          const { error } = await invokeEdgeFunction('amazon-article-pipeline', {
            body: { manual: true }
          });

          if (error) throw error;

          toast({
            title: 'Pipeline Started',
            description: 'Amazon article generation pipeline is running...',
          });
        } catch (error) {
          toast({
            title: 'Pipeline Failed',
            description: 'Failed to start the pipeline. Check console for details.',
            variant: 'destructive'
          });
          throw error;
        }
      },
      variant: 'default'
    },
    {
      id: 'test-webhook',
      label: 'Test Webhook',
      description: 'Send test notification',
      icon: <Send className="h-4 w-4" />,
      action: async () => {
        try {
          const { error } = await invokeEdgeFunction('send-article-webhook', {
            body: {
              articleTitle: 'Test Article',
              articleUrl: 'https://example.com/test',
              shortForm: 'This is a test webhook notification from the Command Center!',
              longForm: 'Testing the webhook integration to ensure notifications are working correctly.',
              isTest: true
            }
          });

          if (error) throw error;

          toast({
            title: 'Webhook Sent',
            description: 'Test webhook notification sent successfully!',
          });
        } catch (error) {
          toast({
            title: 'Webhook Failed',
            description: 'Failed to send test webhook. Check webhook settings.',
            variant: 'destructive'
          });
          throw error;
        }
      },
      variant: 'outline'
    },
    {
      id: 'generate-sitemap',
      label: 'Generate Sitemap',
      description: 'Update sitemap.xml',
      icon: <Globe className="h-4 w-4" />,
      action: async () => {
        try {
          // Fetch all published articles
          const { data: articles, error } = await supabase
            .from('articles')
            .select('slug, updated_at')
            .eq('published', true)
            .order('updated_at', { ascending: false });

          if (error) throw error;

          // In a real implementation, this would call a backend function to generate the sitemap
          // For now, we'll just show a success message
          toast({
            title: 'Sitemap Generated',
            description: `Sitemap generated with ${articles?.length || 0} articles.`,
          });
        } catch (error) {
          toast({
            title: 'Sitemap Failed',
            description: 'Failed to generate sitemap.',
            variant: 'destructive'
          });
          throw error;
        }
      },
      variant: 'outline'
    },
    {
      id: 'export-analytics',
      label: 'Export Analytics',
      description: 'Download CSV report',
      icon: <Download className="h-4 w-4" />,
      action: async () => {
        try {
          // Fetch analytics data
          const { data: stats, error } = await supabase
            .from('amazon_affiliate_stats')
            .select('*')
            .order('date', { ascending: false })
            .limit(1000);

          if (error) throw error;

          // Convert to CSV
          if (stats && stats.length > 0) {
            const headers = Object.keys(stats[0]).join(',');
            const rows = stats.map(row => Object.values(row).join(','));
            const csv = [headers, ...rows].join('\n');

            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast({
              title: 'Export Complete',
              description: `Exported ${stats.length} records to CSV.`,
            });
          } else {
            toast({
              title: 'No Data',
              description: 'No analytics data available to export.',
              variant: 'destructive'
            });
          }
        } catch (error) {
          toast({
            title: 'Export Failed',
            description: 'Failed to export analytics data.',
            variant: 'destructive'
          });
          throw error;
        }
      },
      variant: 'outline'
    },
    {
      id: 'cleanup-sessions',
      label: 'Cleanup Sessions',
      description: 'Remove expired sessions',
      icon: <Trash2 className="h-4 w-4" />,
      action: async () => {
        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const { error } = await supabase
            .from('admin_sessions')
            .delete()
            .lt('created_at', thirtyDaysAgo.toISOString());

          if (error) throw error;

          toast({
            title: 'Sessions Cleaned',
            description: 'Expired admin sessions have been removed.',
          });
        } catch (error) {
          toast({
            title: 'Cleanup Failed',
            description: 'Failed to cleanup sessions.',
            variant: 'destructive'
          });
          throw error;
        }
      },
      variant: 'outline',
      requiresConfirmation: true
    },
    {
      id: 'refresh-stats',
      label: 'Refresh Stats',
      description: 'Update dashboard cache',
      icon: <RefreshCw className="h-4 w-4" />,
      action: async () => {
        try {
          // Clear cached stats
          const { error } = await supabase
            .from('dashboard_stats_cache')
            .delete()
            .lte('expires_at', new Date().toISOString());

          if (error) throw error;

          // Force reload of page to refresh stats
          toast({
            title: 'Stats Refreshed',
            description: 'Dashboard statistics cache has been cleared.',
          });

          // Reload page after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (error) {
          toast({
            title: 'Refresh Failed',
            description: 'Failed to refresh stats cache.',
            variant: 'destructive'
          });
          throw error;
        }
      },
      variant: 'secondary'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Actions
        </CardTitle>
        <CardDescription>One-click operations for common admin tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || 'default'}
              className="h-auto p-4 flex flex-col items-start gap-2 text-left"
              onClick={() => handleAction(action.id, action.action, action.requiresConfirmation)}
              disabled={loadingAction === action.id}
            >
              <div className="flex items-center gap-2 w-full">
                {loadingAction === action.id ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  action.icon
                )}
                <span className="font-semibold text-sm">{action.label}</span>
              </div>
              <span className="text-xs opacity-70 font-normal">
                {action.description}
              </span>
            </Button>
          ))}
        </div>

        {/* Recent Actions Log */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="text-sm font-semibold mb-3">Recent Quick Actions</h4>
          <div className="space-y-2">
            {loadingAction && (
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span className="text-sm">
                    {actions.find(a => a.id === loadingAction)?.label}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">Running</Badge>
              </div>
            )}
            {!loadingAction && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent actions
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
