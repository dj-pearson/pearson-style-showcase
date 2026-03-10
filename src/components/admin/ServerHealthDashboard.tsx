import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import {
  RefreshCw,
  Server,
  Database,
  Globe,
  Boxes,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';

interface CoolifyServer {
  uuid: string;
  name: string;
  ip: string;
  description?: string;
  settings?: {
    is_reachable?: boolean;
    is_usable?: boolean;
  };
}

interface CoolifyApplication {
  uuid: string;
  name: string;
  description?: string;
  fqdn?: string;
  status?: string;
  type?: string;
  created_at?: string;
  updated_at?: string;
}

interface CoolifyDatabase {
  uuid: string;
  name: string;
  description?: string;
  type?: string;
  status?: string;
  created_at?: string;
}

interface CoolifyService {
  uuid: string;
  name: string;
  description?: string;
  type?: string;
  status?: string;
  created_at?: string;
}

interface CoolifyResources {
  servers: CoolifyServer[];
  applications: CoolifyApplication[];
  databases: CoolifyDatabase[];
  services: CoolifyService[];
}

function getStatusColor(status?: string): string {
  if (!status) return 'bg-gray-400';
  const s = status.toLowerCase();
  if (s.includes('running') || s.includes('healthy') || s.includes('started')) return 'bg-green-500';
  if (s.includes('stopped') || s.includes('exited')) return 'bg-red-500';
  if (s.includes('restarting') || s.includes('starting') || s.includes('building')) return 'bg-yellow-500';
  return 'bg-gray-400';
}

function getStatusBadge(status?: string) {
  if (!status) return <Badge variant="secondary">Unknown</Badge>;
  const s = status.toLowerCase();
  if (s.includes('running') || s.includes('healthy') || s.includes('started')) {
    return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">{status}</Badge>;
  }
  if (s.includes('stopped') || s.includes('exited')) {
    return <Badge variant="destructive">{status}</Badge>;
  }
  if (s.includes('restarting') || s.includes('starting') || s.includes('building')) {
    return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">{status}</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

function StatusIcon({ status }: { status?: string }) {
  if (!status) return <AlertTriangle className="h-4 w-4 text-gray-400" />;
  const s = status.toLowerCase();
  if (s.includes('running') || s.includes('healthy') || s.includes('started')) {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  }
  if (s.includes('stopped') || s.includes('exited')) {
    return <XCircle className="h-4 w-4 text-red-500" />;
  }
  return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
}

export const ServerHealthDashboard: React.FC = () => {
  const [resources, setResources] = useState<CoolifyResources | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  const loadResources = useCallback(async () => {
    try {
      const { data, error } = await invokeEdgeFunction<CoolifyResources>('coolify-health', {
        method: 'GET',
      });

      if (error) throw error;
      if (data) {
        setResources(data);
        setLastRefreshed(new Date());
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to fetch server health',
        description: error instanceof Error ? error.message : 'Could not connect to Coolify API',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadResources, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadResources]);

  const handleRefresh = () => {
    setIsLoading(true);
    loadResources();
  };

  const formatRefreshed = () => {
    if (!lastRefreshed) return 'Never';
    const diffSec = Math.floor((Date.now() - lastRefreshed.getTime()) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m ago`;
  };

  // Summary counts
  const totalApps = resources?.applications?.length ?? 0;
  const totalDbs = resources?.databases?.length ?? 0;
  const totalServices = resources?.services?.length ?? 0;
  const totalServers = resources?.servers?.length ?? 0;

  const runningApps = resources?.applications?.filter(a =>
    a.status?.toLowerCase().includes('running')
  ).length ?? 0;

  const runningDbs = resources?.databases?.filter(d =>
    d.status?.toLowerCase().includes('running')
  ).length ?? 0;

  const runningServices = resources?.services?.filter(s =>
    s.status?.toLowerCase().includes('running')
  ).length ?? 0;

  const stoppedItems = [
    ...(resources?.applications?.filter(a => {
      const s = a.status?.toLowerCase() ?? '';
      return s.includes('stopped') || s.includes('exited');
    }) ?? []),
    ...(resources?.databases?.filter(d => {
      const s = d.status?.toLowerCase() ?? '';
      return s.includes('stopped') || s.includes('exited');
    }) ?? []),
    ...(resources?.services?.filter(s => {
      const st = s.status?.toLowerCase() ?? '';
      return st.includes('stopped') || st.includes('exited');
    }) ?? []),
  ];

  if (isLoading && !resources) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Connecting to Coolify...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Server Health</h2>
          <p className="text-muted-foreground">Real-time Coolify container and service status</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Clock className="h-4 w-4 mr-2" />
            Auto: {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <span className="text-xs text-muted-foreground">{formatRefreshed()}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Server className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{totalServers}</p>
                <p className="text-xs text-muted-foreground">Servers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Globe className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{runningApps}/{totalApps}</p>
                <p className="text-xs text-muted-foreground">Applications</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{runningDbs}/{totalDbs}</p>
                <p className="text-xs text-muted-foreground">Databases</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Boxes className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{runningServices}/{totalServices}</p>
                <p className="text-xs text-muted-foreground">Services</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attention Required */}
      {stoppedItems.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Attention Required — {stoppedItems.length} Stopped
            </CardTitle>
            <CardDescription>These containers are not running and may need attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stoppedItems.map((item) => (
                <div key={item.uuid} className="flex items-center justify-between py-2 px-3 rounded-md bg-destructive/5">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Servers */}
      {resources?.servers && resources.servers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Servers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resources.servers.map((server) => (
                <div key={server.uuid} className="flex items-center justify-between py-2 px-3 rounded-md border">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${server.settings?.is_reachable ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <p className="font-medium">{server.name}</p>
                      <p className="text-xs text-muted-foreground">{server.ip}</p>
                    </div>
                  </div>
                  <Badge variant={server.settings?.is_reachable ? 'default' : 'destructive'}>
                    {server.settings?.is_reachable ? 'Reachable' : 'Unreachable'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Applications */}
      {resources?.applications && resources.applications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Applications ({resources.applications.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resources.applications
                .sort((a, b) => {
                  const aRunning = a.status?.toLowerCase().includes('running') ? 1 : 0;
                  const bRunning = b.status?.toLowerCase().includes('running') ? 1 : 0;
                  return aRunning - bRunning; // Stopped first
                })
                .map((app) => (
                  <div key={app.uuid} className="flex items-center justify-between py-2 px-3 rounded-md border">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={app.status} />
                      <div>
                        <p className="font-medium">{app.name}</p>
                        {app.fqdn && (
                          <p className="text-xs text-muted-foreground">{app.fqdn}</p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Databases */}
      {resources?.databases && resources.databases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Databases ({resources.databases.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resources.databases
                .sort((a, b) => {
                  const aRunning = a.status?.toLowerCase().includes('running') ? 1 : 0;
                  const bRunning = b.status?.toLowerCase().includes('running') ? 1 : 0;
                  return aRunning - bRunning;
                })
                .map((db) => (
                  <div key={db.uuid} className="flex items-center justify-between py-2 px-3 rounded-md border">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={db.status} />
                      <div>
                        <p className="font-medium">{db.name}</p>
                        {db.type && <p className="text-xs text-muted-foreground">{db.type}</p>}
                      </div>
                    </div>
                    {getStatusBadge(db.status)}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services */}
      {resources?.services && resources.services.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              Services ({resources.services.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resources.services
                .sort((a, b) => {
                  const aRunning = a.status?.toLowerCase().includes('running') ? 1 : 0;
                  const bRunning = b.status?.toLowerCase().includes('running') ? 1 : 0;
                  return aRunning - bRunning;
                })
                .map((svc) => (
                  <div key={svc.uuid} className="flex items-center justify-between py-2 px-3 rounded-md border">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={svc.status} />
                      <div>
                        <p className="font-medium">{svc.name}</p>
                        {svc.type && <p className="text-xs text-muted-foreground">{svc.type}</p>}
                      </div>
                    </div>
                    {getStatusBadge(svc.status)}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!resources && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Could not load server data</h3>
            <p className="text-muted-foreground mt-2">
              Make sure the COOLIFY_API_TOKEN and COOLIFY_BASE_URL environment variables are configured in your Edge Functions.
            </p>
            <Button onClick={handleRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
