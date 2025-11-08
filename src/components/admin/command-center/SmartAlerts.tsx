import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  Check
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  details: Record<string, any>;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export const SmartAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'critical'>('unacknowledged');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAlerts();

    // Set up real-time subscription for new alerts
    const subscription = supabase
      .channel('smart-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'automated_alerts'
      }, handleNewAlert)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'automated_alerts'
      }, handleAlertUpdate)
      .subscribe();

    // Refresh every minute
    const interval = setInterval(loadAlerts, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [filter]);

  const loadAlerts = async () => {
    try {
      let query = supabase
        .from('automated_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (filter === 'unacknowledged') {
        query = query.eq('acknowledged', false);
      } else if (filter === 'critical') {
        query = query.eq('severity', 'critical');
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      setAlerts(data || []);
      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to load alerts:', error);
      setIsLoading(false);
    }
  };

  const handleNewAlert = (payload: any) => {
    const newAlert = payload.new as Alert;

    // Show toast notification for critical alerts
    if (newAlert.severity === 'critical') {
      toast({
        title: '🚨 Critical Alert',
        description: newAlert.title,
        variant: 'destructive'
      });
    }

    setAlerts(prev => [newAlert, ...prev]);
  };

  const handleAlertUpdate = (payload: any) => {
    const updatedAlert = payload.new as Alert;
    setAlerts(prev => prev.map(alert => alert.id === updatedAlert.id ? updatedAlert : alert));
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('automated_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: user?.id || null,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: 'Alert Acknowledged',
        description: 'Alert has been marked as acknowledged.',
      });
    } catch (error) {
      logger.error('Failed to acknowledge alert:', error);
      toast({
        title: 'Failed to Acknowledge',
        description: 'Could not acknowledge the alert.',
        variant: 'destructive'
      });
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('automated_alerts')
        .update({
          resolved: true,
          resolved_by: user?.id || null,
          resolved_at: new Date().toISOString(),
          acknowledged: true,
          acknowledged_by: user?.id || null,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      // Remove from list
      setAlerts(prev => prev.filter(a => a.id !== alertId));

      toast({
        title: 'Alert Resolved',
        description: 'Alert has been marked as resolved.',
      });
    } catch (error) {
      logger.error('Failed to resolve alert:', error);
      toast({
        title: 'Failed to Resolve',
        description: 'Could not resolve the alert.',
        variant: 'destructive'
      });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'warning':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'info':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-red-500/10 text-red-500 border-red-500/20',
      warning: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      info: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    };

    return (
      <Badge variant="outline" className={colors[severity as keyof typeof colors]}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Smart Alerts
              {unacknowledgedCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unacknowledgedCount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Automated system alerts and notifications</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filter === 'unacknowledged' ? 'default' : 'outline'}
              onClick={() => setFilter('unacknowledged')}
            >
              Unacked
            </Button>
            <Button
              size="sm"
              variant={filter === 'critical' ? 'default' : 'outline'}
              onClick={() => setFilter('critical')}
            >
              Critical
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50 text-green-500" />
            <p>No active alerts</p>
            <p className="text-sm mt-1">All systems operating normally</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)} ${
                    alert.acknowledged ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-0.5">
                        {getSeverityIcon(alert.severity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold">{alert.title}</p>
                          {getSeverityBadge(alert.severity)}
                          {alert.acknowledged && (
                            <Badge variant="outline" className="text-xs">
                              Acknowledged
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>

                        {/* Alert Details */}
                        {alert.details && Object.keys(alert.details).length > 0 && (
                          <div className="mt-2 p-2 rounded bg-background/50 text-xs font-mono">
                            {Object.entries(alert.details).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-muted-foreground">{key}:</span>
                                <span>{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-1">
                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => acknowledgeAlert(alert.id)}
                          title="Acknowledge"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resolveAlert(alert.id)}
                        title="Resolve"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Alert Summary */}
        {!isLoading && alerts.length > 0 && (
          <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{alerts.length}</p>
              <p className="text-xs text-muted-foreground">Total Alerts</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-500">{unacknowledgedCount}</p>
              <p className="text-xs text-muted-foreground">Unacknowledged</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
