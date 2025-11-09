import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings as SettingsIcon,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Zap,
  Database,
  Link as LinkIcon,
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface MaintenanceTask {
  id: string;
  task_name: string;
  task_type: string;
  description: string;
  schedule_cron: string;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_duration: number | null;
  next_run_at: string | null;
}

interface MaintenanceResult {
  id: string;
  task_name: string;
  status: string;
  run_at: string;
  duration: number;
  issues_found: number;
  issues_fixed: number;
  details: any;
}

interface LinkHealth {
  id: string;
  url: string;
  article_id: string;
  status_code: number;
  is_broken: boolean;
  last_checked_at: string;
  consecutive_failures: number;
}

export const MaintenanceDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [recentResults, setRecentResults] = useState<MaintenanceResult[]>([]);
  const [brokenLinks, setBrokenLinks] = useState<LinkHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [tasksData, resultsData, linksData] = await Promise.all([
        supabase.from('maintenance_tasks').select('*').order('task_name'),
        supabase.from('maintenance_results').select('*').order('run_at', { ascending: false }).limit(20),
        supabase.from('link_health').select('*').eq('is_broken', true).limit(50)
      ]);

      setTasks(tasksData.data || []);
      setRecentResults(resultsData.data || []);
      setBrokenLinks(linksData.data || []);
      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to load maintenance data:', error);
      setIsLoading(false);
    }
  };

  const runTask = async (taskId: string, taskName: string) => {
    setRunningTask(taskId);
    toast({
      title: 'Task Started',
      description: `Running ${taskName}...`,
    });

    try {
      // In production, this would call an Edge Function
      // For now, we'll simulate a task run
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: 'Task Completed',
        description: `${taskName} completed successfully.`,
      });

      loadData();
    } catch (error) {
      logger.error('Task failed:', error);
      toast({
        title: 'Task Failed',
        description: 'An error occurred while running the task.',
        variant: 'destructive'
      });
    } finally {
      setRunningTask(null);
    }
  };

  const toggleTask = async (taskId: string, currentlyEnabled: boolean) => {
    try {
      await supabase
        .from('maintenance_tasks')
        .update({ enabled: !currentlyEnabled })
        .eq('id', taskId);

      toast({
        title: currentlyEnabled ? 'Task Disabled' : 'Task Enabled',
        description: 'Task schedule has been updated.',
      });

      loadData();
    } catch (error) {
      logger.error('Failed to toggle task:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not update task status.',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline" className="text-xs">Never run</Badge>;

    const config = {
      success: { label: 'Success', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
      failed: { label: 'Failed', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
      running: { label: 'Running', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' }
    };

    const { label, color } = config[status as keyof typeof config] || config.failed;
    return <Badge variant="outline" className={`text-xs ${color}`}>{label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCronDescription = (cron: string) => {
    const descriptions: Record<string, string> = {
      '0 2 * * *': 'Daily at 2:00 AM',
      '0 3 * * *': 'Daily at 3:00 AM',
      '0 * * * *': 'Every hour',
      '*/15 * * * *': 'Every 15 minutes',
      '0 4 * * 0': 'Weekly on Sunday at 4:00 AM',
      '0 0 1 * *': 'Monthly on the 1st at midnight',
      '0 5 * * *': 'Daily at 5:00 AM'
    };
    return descriptions[cron] || cron;
  };

  const stats = {
    totalTasks: tasks.length,
    enabledTasks: tasks.filter(t => t.enabled).length,
    successRate: recentResults.length > 0
      ? (recentResults.filter(r => r.status === 'success').length / recentResults.length * 100).toFixed(1)
      : '0',
    brokenLinksCount: brokenLinks.length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Maintenance Automation</h1>
        <p className="text-muted-foreground mt-1">
          Automated scheduled tasks and proactive system maintenance
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.enabledTasks}/{stats.totalTasks}</p>
                <p className="text-xs text-muted-foreground">Active Tasks</p>
              </div>
              <Zap className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.successRate}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.brokenLinksCount}</p>
                <p className="text-xs text-muted-foreground">Broken Links</p>
              </div>
              <LinkIcon className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{recentResults.length}</p>
                <p className="text-xs text-muted-foreground">Recent Runs</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tasks">Scheduled Tasks</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
          <TabsTrigger value="links">Link Health</TabsTrigger>
        </TabsList>

        {/* Scheduled Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automated Maintenance Tasks</CardTitle>
              <CardDescription>Configure and manage scheduled maintenance operations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{task.task_name}</h4>
                            {getStatusBadge(task.last_run_status)}
                            {task.enabled ? (
                              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500">Enabled</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Disabled</Badge>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground mb-3">{task.description}</p>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Schedule</p>
                              <p className="font-medium">{getCronDescription(task.schedule_cron)}</p>
                            </div>

                            {task.last_run_at && (
                              <div>
                                <p className="text-xs text-muted-foreground">Last Run</p>
                                <p className="font-medium">
                                  {formatDistanceToNow(new Date(task.last_run_at), { addSuffix: true })}
                                </p>
                              </div>
                            )}

                            {task.next_run_at && (
                              <div>
                                <p className="text-xs text-muted-foreground">Next Run</p>
                                <p className="font-medium">
                                  {formatDistanceToNow(new Date(task.next_run_at), { addSuffix: true })}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => runTask(task.id, task.task_name)}
                            disabled={runningTask === task.id}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Run Now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleTask(task.id, task.enabled)}
                          >
                            {task.enabled ? 'Disable' : 'Enable'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Execution History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
              <CardDescription>Historical record of maintenance task runs</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {recentResults.map((result) => (
                    <div
                      key={result.id}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-start gap-3">
                        {getStatusIcon(result.status)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-sm">{result.task_name}</h4>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(result.run_at), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Duration</p>
                              <p className="font-medium">{result.duration}ms</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Issues Found</p>
                              <p className="font-medium">{result.issues_found}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Issues Fixed</p>
                              <p className="font-medium">{result.issues_fixed}</p>
                            </div>
                          </div>

                          {result.details && Object.keys(result.details).length > 0 && (
                            <div className="mt-2 p-2 rounded bg-muted/50 text-xs font-mono max-h-32 overflow-auto">
                              <pre>{JSON.stringify(result.details, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Link Health Tab */}
        <TabsContent value="links">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Broken Links ({brokenLinks.length})
              </CardTitle>
              <CardDescription>URLs that need attention</CardDescription>
            </CardHeader>
            <CardContent>
              {brokenLinks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                  <p>No broken links detected!</p>
                  <p className="text-sm mt-1">All links are healthy</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {brokenLinks.map((link) => (
                      <div
                        key={link.id}
                        className="p-4 rounded-lg border bg-card border-red-500/20"
                      >
                        <div className="flex items-start gap-3">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:underline text-primary flex items-center gap-1 break-all"
                              >
                                {link.url}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                              <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500 shrink-0">
                                {link.status_code}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="text-muted-foreground">Last Checked</p>
                                <p>{formatDistanceToNow(new Date(link.last_checked_at), { addSuffix: true })}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Consecutive Failures</p>
                                <p>{link.consecutive_failures}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
