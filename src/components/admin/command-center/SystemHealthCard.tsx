import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Database,
  Zap,
  Server,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

interface HealthStatus {
  database: 'healthy' | 'warning' | 'critical';
  api: 'healthy' | 'warning' | 'critical';
  errors: number;
  errorRate: number;
  apiLatency: number;
  activeConnections: number;
  lastChecked: Date;
}

export const SystemHealthCard: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus>({
    database: 'healthy',
    api: 'healthy',
    errors: 0,
    errorRate: 0,
    apiLatency: 0,
    activeConnections: 0,
    lastChecked: new Date()
  });
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSystemHealth();

    // Refresh every 30 seconds
    const interval = setInterval(loadSystemHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadSystemHealth = async () => {
    try {
      // Check database connectivity
      const dbStart = performance.now();
      const { error: dbError } = await supabase.from('articles').select('count', { count: 'exact', head: true });
      const dbLatency = performance.now() - dbStart;

      // Get error metrics from last hour
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { data: errorMetrics, error: metricsError } = await supabase
        .from('system_metrics')
        .select('*')
        .eq('metric_type', 'error_rate')
        .gte('recorded_at', oneHourAgo.toISOString());

      const errorCount = errorMetrics?.length || 0;
      const errorRate = errorCount / 60; // Errors per minute

      // Get API latency metrics
      const { data: latencyMetrics } = await supabase
        .from('system_metrics')
        .select('value')
        .eq('metric_type', 'api_latency')
        .gte('recorded_at', oneHourAgo.toISOString())
        .order('recorded_at', { ascending: false })
        .limit(10);

      const avgLatency = latencyMetrics && latencyMetrics.length > 0
        ? latencyMetrics.reduce((sum, m) => sum + Number(m.value), 0) / latencyMetrics.length
        : dbLatency;

      // Determine health status
      const dbHealth: 'healthy' | 'warning' | 'critical' =
        dbError ? 'critical' :
        dbLatency > 1000 ? 'warning' :
        'healthy';

      const apiHealth: 'healthy' | 'warning' | 'critical' =
        avgLatency > 2000 ? 'critical' :
        avgLatency > 1000 ? 'warning' :
        'healthy';

      setHealth({
        database: dbHealth,
        api: apiHealth,
        errors: errorCount,
        errorRate: Math.round(errorRate * 100) / 100,
        apiLatency: Math.round(avgLatency),
        activeConnections: 0, // Would need backend support
        lastChecked: new Date()
      });

      // Build metrics array
      setMetrics([
        {
          name: 'Error Rate',
          value: errorRate,
          unit: '/min',
          status: errorRate > 5 ? 'critical' : errorRate > 2 ? 'warning' : 'healthy',
          trend: 'stable'
        },
        {
          name: 'API Latency',
          value: Math.round(avgLatency),
          unit: 'ms',
          status: avgLatency > 2000 ? 'critical' : avgLatency > 1000 ? 'warning' : 'healthy',
          trend: 'stable'
        },
        {
          name: 'DB Response',
          value: Math.round(dbLatency),
          unit: 'ms',
          status: dbLatency > 1000 ? 'critical' : dbLatency > 500 ? 'warning' : 'healthy',
          trend: 'stable'
        }
      ]);

      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to load system health:', error);
      setHealth(prev => ({
        ...prev,
        database: 'critical',
        api: 'critical',
        lastChecked: new Date()
      }));
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
    }
  };

  const getStatusBadge = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Healthy</Badge>;
      case 'warning': return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Warning</Badge>;
      case 'critical': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Critical</Badge>;
    }
  };

  const getStatusIcon = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4" />;
      case 'warning': return <AlertCircle className="h-4 w-4" />;
      case 'critical': return <AlertCircle className="h-4 w-4" />;
    }
  };

  const overallStatus =
    health.database === 'critical' || health.api === 'critical' ? 'critical' :
    health.database === 'warning' || health.api === 'warning' ? 'warning' :
    'healthy';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
            <CardDescription>Real-time system monitoring</CardDescription>
          </div>
          {getStatusBadge(overallStatus)}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Service Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <Database className={`h-5 w-5 ${getStatusColor(health.database)}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Database</span>
                    <div className={`flex items-center gap-1 ${getStatusColor(health.database)}`}>
                      {getStatusIcon(health.database)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Response time: {metrics.find(m => m.name === 'DB Response')?.value || 0}ms
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <Server className={`h-5 w-5 ${getStatusColor(health.api)}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">API Services</span>
                    <div className={`flex items-center gap-1 ${getStatusColor(health.api)}`}>
                      {getStatusIcon(health.api)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Avg latency: {health.apiLatency}ms
                  </p>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Key Metrics (Last Hour)</h4>
              {metrics.map((metric, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Zap className={`h-4 w-4 ${getStatusColor(metric.status)}`} />
                    <span className="text-sm">{metric.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-mono ${getStatusColor(metric.status)}`}>
                      {metric.value}{metric.unit}
                    </span>
                    {metric.trend && (
                      <span className="text-xs text-muted-foreground">
                        {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Error Summary */}
            {health.errors > 0 && (
              <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {health.errors} error{health.errors !== 1 ? 's' : ''} detected in the last hour
                  </span>
                </div>
              </div>
            )}

            {/* Last Updated */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Last checked: {health.lastChecked.toLocaleTimeString()}</span>
              </div>
              <button
                onClick={loadSystemHealth}
                className="text-primary hover:underline"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
