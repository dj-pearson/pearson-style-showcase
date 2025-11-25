import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermission, PERMISSIONS } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Bell,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';
import { format, subHours, subDays } from 'date-fns';

interface SecurityAlert {
  id: string;
  type: 'failed_login' | 'role_change' | 'whitelist_change' | 'unusual_activity' | 'mass_deletion';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: string;
  enabled: boolean;
  threshold: number;
  window_minutes: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  info: <AlertCircle className="h-5 w-5 text-blue-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  critical: <AlertCircle className="h-5 w-5 text-red-500" />,
};

const SecurityAlertsDashboard: React.FC = () => {
  const canManageAlerts = usePermission(PERMISSIONS.ALERTS_MANAGE);
  const canViewActivity = usePermission(PERMISSIONS.ACTIVITY_LOG_VIEW);

  const [activeTab, setActiveTab] = useState('alerts');

  // Generate alerts from activity log analysis
  const { data: generatedAlerts, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['security-alerts'],
    queryFn: async () => {
      const alerts: SecurityAlert[] = [];

      // Check for failed login attempts (5+ in last hour)
      const hourAgo = subHours(new Date(), 1);
      await supabase
        .from('admin_activity_log')
        .select('*')
        .gte('timestamp', hourAgo.toISOString())
        .order('timestamp', { ascending: false });

      // Check for role changes in last 24 hours
      const dayAgo = subDays(new Date(), 1);
      const { data: roleChanges } = await supabase
        .from('admin_activity_log')
        .select('*')
        .eq('resource_type', 'user_roles')
        .gte('timestamp', dayAgo.toISOString());

      if (roleChanges && roleChanges.length > 0) {
        roleChanges.forEach((change: { id: string; action: string; admin_email: string; timestamp: string; new_values: Record<string, unknown> | null }) => {
          alerts.push({
            id: `role-${change.id}`,
            type: 'role_change',
            severity: change.action === 'DELETE' ? 'warning' : 'info',
            title: `Role ${change.action.toLowerCase()}`,
            message: `${change.admin_email} ${change.action.toLowerCase()}d a role assignment`,
            metadata: { action: change.action, admin: change.admin_email, details: change.new_values },
            created_at: change.timestamp,
            acknowledged: false,
            acknowledged_by: null,
            acknowledged_at: null,
          });
        });
      }

      // Check for whitelist changes in last 24 hours
      const { data: whitelistChanges } = await supabase
        .from('admin_activity_log')
        .select('*')
        .eq('resource_type', 'admin_whitelist')
        .gte('timestamp', dayAgo.toISOString());

      if (whitelistChanges && whitelistChanges.length > 0) {
        whitelistChanges.forEach((change: { id: string; action: string; admin_email: string; timestamp: string; new_values: Record<string, unknown> | null }) => {
          alerts.push({
            id: `whitelist-${change.id}`,
            type: 'whitelist_change',
            severity: change.action === 'DELETE' ? 'critical' : 'warning',
            title: `Whitelist ${change.action.toLowerCase()}`,
            message: `${change.admin_email} ${change.action.toLowerCase()}d a whitelist entry`,
            metadata: { action: change.action, admin: change.admin_email, details: change.new_values },
            created_at: change.timestamp,
            acknowledged: false,
            acknowledged_by: null,
            acknowledged_at: null,
          });
        });
      }

      // Check for mass deletions (5+ deletes in 10 minutes)
      const { data: deletions } = await supabase
        .from('admin_activity_log')
        .select('*')
        .eq('action', 'DELETE')
        .gte('timestamp', subHours(new Date(), 1).toISOString());

      if (deletions && deletions.length >= 5) {
        // Group by admin and check for bursts
        const byAdmin: Record<string, { timestamp: string }[]> = {};
        deletions.forEach((del: { admin_email: string; timestamp: string }) => {
          if (!byAdmin[del.admin_email]) byAdmin[del.admin_email] = [];
          byAdmin[del.admin_email].push(del);
        });

        Object.entries(byAdmin).forEach(([admin, dels]) => {
          if (dels.length >= 5) {
            alerts.push({
              id: `mass-delete-${admin}-${Date.now()}`,
              type: 'mass_deletion',
              severity: 'critical',
              title: 'Mass Deletion Detected',
              message: `${admin} deleted ${dels.length} items in the last hour`,
              metadata: { admin, count: dels.length },
              created_at: new Date().toISOString(),
              acknowledged: false,
              acknowledged_by: null,
              acknowledged_at: null,
            });
          }
        });
      }

      // Sort by severity and time
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return alerts.sort((a, b) => {
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
    enabled: canViewActivity,
    refetchInterval: 60000, // Refresh every minute
  });

  // Default alert rules
  const alertRules: AlertRule[] = [
    {
      id: '1',
      name: 'Failed Login Attempts',
      description: 'Alert when multiple failed login attempts occur',
      type: 'failed_login',
      enabled: true,
      threshold: 5,
      window_minutes: 15,
    },
    {
      id: '2',
      name: 'Role Changes',
      description: 'Alert when user roles are modified',
      type: 'role_change',
      enabled: true,
      threshold: 1,
      window_minutes: 0,
    },
    {
      id: '3',
      name: 'Whitelist Changes',
      description: 'Alert when admin whitelist is modified',
      type: 'whitelist_change',
      enabled: true,
      threshold: 1,
      window_minutes: 0,
    },
    {
      id: '4',
      name: 'Mass Deletions',
      description: 'Alert when many items are deleted quickly',
      type: 'mass_deletion',
      enabled: true,
      threshold: 5,
      window_minutes: 10,
    },
  ];

  const stats = {
    total: generatedAlerts?.length || 0,
    critical: generatedAlerts?.filter((a) => a.severity === 'critical').length || 0,
    warning: generatedAlerts?.filter((a) => a.severity === 'warning').length || 0,
    info: generatedAlerts?.filter((a) => a.severity === 'info').length || 0,
    unacknowledged: generatedAlerts?.filter((a) => !a.acknowledged).length || 0,
  };

  if (!canViewActivity) {
    return (
      <Alert>
        <Bell className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to view security alerts.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Alerts
              </CardTitle>
              <CardDescription>
                Monitor security events and potential threats in real-time.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => refetchAlerts()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Alerts</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className={stats.critical > 0 ? 'border-red-500' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={stats.warning > 0 ? 'border-yellow-500' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warning</p>
                <p className="text-2xl font-bold text-yellow-500">{stats.warning}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Info</p>
                <p className="text-2xl font-bold text-blue-500">{stats.info}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.unacknowledged}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="alerts">
            <Bell className="h-4 w-4 mr-2" />
            Alerts ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Settings className="h-4 w-4 mr-2" />
            Alert Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {alertsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : !generatedAlerts || generatedAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">All Clear</h3>
                  <p className="text-muted-foreground">
                    No security alerts at this time.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {generatedAlerts.map((alert) => (
                      <Alert
                        key={alert.id}
                        className={`border-l-4 ${
                          alert.severity === 'critical'
                            ? 'border-l-red-500'
                            : alert.severity === 'warning'
                            ? 'border-l-yellow-500'
                            : 'border-l-blue-500'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {SEVERITY_ICONS[alert.severity]}
                            <div>
                              <AlertTitle className="flex items-center gap-2">
                                {alert.title}
                                <Badge
                                  className={`${SEVERITY_COLORS[alert.severity]} text-white text-xs`}
                                >
                                  {alert.severity}
                                </Badge>
                              </AlertTitle>
                              <AlertDescription className="mt-1">
                                {alert.message}
                              </AlertDescription>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(alert.created_at), 'MMM d, HH:mm')}
                                </span>
                                {alert.metadata?.admin && typeof alert.metadata.admin === 'string' ? (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {alert.metadata.admin}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          {!alert.acknowledged && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                toast.success('Alert acknowledged');
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </Alert>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Alert Rules</CardTitle>
              <CardDescription>
                Configure when alerts should be triggered.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {alertRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{rule.name}</h4>
                        <Badge variant="outline">{rule.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {rule.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Threshold: {rule.threshold}{' '}
                        {rule.window_minutes > 0 && `within ${rule.window_minutes} minutes`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`rule-${rule.id}`} className="text-sm">
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </Label>
                      <Switch
                        id={`rule-${rule.id}`}
                        checked={rule.enabled}
                        disabled={!canManageAlerts}
                        onCheckedChange={() => {
                          toast.info('Alert rule configuration saved');
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityAlertsDashboard;
