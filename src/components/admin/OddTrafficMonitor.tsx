import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermission, PERMISSIONS } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Globe,
  Activity,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  Settings,
  Flag,
  TrendingUp,
  Save,
  Shield,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { DEFAULT_RULES, type TrafficMode } from '@/lib/traffic-detection';

// page_visits / traffic_rules are not yet in the generated Supabase types.
// Regenerate types.ts after applying the migration to drop this cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface PageVisit {
  country_code: string | null;
  ip_hash: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  path: string | null;
  created_at: string;
}

interface TrafficRulesRow {
  id: string;
  enabled: boolean;
  mode: TrafficMode;
  allowed_countries: string[];
  spike_threshold: number;
  spike_window_minutes: number;
}

interface RulesForm {
  enabled: boolean;
  mode: TrafficMode;
  allowedCountries: string; // comma-separated for editing
  spikeThreshold: number;
  spikeWindowMinutes: number;
}

const OddTrafficMonitor: React.FC = () => {
  const canView = usePermission(PERMISSIONS.ANALYTICS_VIEW);
  const canManage = usePermission(PERMISSIONS.ALERTS_MANAGE);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // ---- Data ----------------------------------------------------------------
  const {
    data: visits,
    isLoading: visitsLoading,
    refetch: refetchVisits,
  } = useQuery<PageVisit[]>({
    queryKey: ['odd-traffic-visits'],
    queryFn: async () => {
      const since = subDays(new Date(), 7).toISOString();
      const { data, error } = await db
        .from('page_visits')
        .select('country_code, ip_hash, is_flagged, flag_reason, path, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as PageVisit[];
    },
    enabled: canView,
    refetchInterval: 60000,
  });

  const { data: rules } = useQuery<TrafficRulesRow | null>({
    queryKey: ['odd-traffic-rules'],
    queryFn: async () => {
      const { data, error } = await db
        .from('traffic_rules')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TrafficRulesRow | null;
    },
    enabled: canView,
  });

  // ---- Rules editing form --------------------------------------------------
  const [form, setForm] = useState<RulesForm>({
    enabled: DEFAULT_RULES.enabled,
    mode: DEFAULT_RULES.mode,
    allowedCountries: DEFAULT_RULES.allowed_countries.join(', '),
    spikeThreshold: DEFAULT_RULES.spike_threshold,
    spikeWindowMinutes: DEFAULT_RULES.spike_window_minutes,
  });

  useEffect(() => {
    if (rules) {
      setForm({
        enabled: rules.enabled,
        mode: rules.mode,
        allowedCountries: (rules.allowed_countries ?? []).join(', '),
        spikeThreshold: rules.spike_threshold,
        spikeWindowMinutes: rules.spike_window_minutes,
      });
    }
  }, [rules]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!rules?.id) throw new Error('No rules row to update');
      const allowed = form.allowedCountries
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      const { error } = await db
        .from('traffic_rules')
        .update({
          enabled: form.enabled,
          mode: form.mode,
          allowed_countries: allowed,
          spike_threshold: Number(form.spikeThreshold) || 0,
          spike_window_minutes: Number(form.spikeWindowMinutes) || 1,
        })
        .eq('id', rules.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Traffic rules saved');
      queryClient.invalidateQueries({ queryKey: ['odd-traffic-rules'] });
    },
    onError: (err: unknown) => {
      toast.error(`Could not save rules: ${err instanceof Error ? err.message : 'unknown error'}`);
    },
  });

  // ---- Aggregations --------------------------------------------------------
  const analysis = useMemo(() => {
    const list = visits ?? [];
    const total = list.length;
    const flagged = list.filter((v) => v.is_flagged).length;
    const unexpectedCountry = list.filter((v) =>
      (v.flag_reason ?? '').includes('unexpected_country')
    ).length;

    // Country breakdown
    const byCountry: Record<string, { total: number; flagged: number }> = {};
    list.forEach((v) => {
      const code = v.country_code || 'Unknown';
      if (!byCountry[code]) byCountry[code] = { total: 0, flagged: 0 };
      byCountry[code].total += 1;
      if (v.is_flagged) byCountry[code].flagged += 1;
    });
    const countries = Object.entries(byCountry)
      .map(([code, c]) => ({ code, ...c }))
      .sort((a, b) => b.total - a.total);

    // Spike detection within the configured window
    const windowMin = rules?.spike_window_minutes ?? DEFAULT_RULES.spike_window_minutes;
    const threshold = rules?.spike_threshold ?? DEFAULT_RULES.spike_threshold;
    const windowStart = Date.now() - windowMin * 60_000;
    const recent = list.filter((v) => new Date(v.created_at).getTime() >= windowStart);

    const tally = (key: keyof PageVisit) => {
      const map: Record<string, number> = {};
      recent.forEach((v) => {
        const k = (v[key] as string) || 'Unknown';
        map[k] = (map[k] || 0) + 1;
      });
      return map;
    };
    const countrySpikes = Object.entries(tally('country_code'))
      .filter(([, n]) => n >= threshold)
      .map(([code, count]) => ({ kind: 'country' as const, label: code, count }));
    const ipSpikes = Object.entries(tally('ip_hash'))
      .filter(([, n]) => n >= threshold)
      .map(([hash, count]) => ({ kind: 'source' as const, label: hash, count }));

    const spikes = [...countrySpikes, ...ipSpikes].sort((a, b) => b.count - a.count);

    return { total, flagged, unexpectedCountry, countries, spikes, windowMin, threshold };
  }, [visits, rules]);

  const recentFlagged = useMemo(
    () => (visits ?? []).filter((v) => v.is_flagged).slice(0, 50),
    [visits]
  );

  if (!canView) {
    return (
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>You don't have permission to view traffic analytics.</AlertDescription>
      </Alert>
    );
  }

  const modeLabel = rules?.mode === 'monitor' ? 'Monitor only' : 'Soft handling';

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Traffic Watch
              </CardTitle>
              <CardDescription>
                Detect odd traffic (unexpected countries &amp; volume spikes) and soft-handle it —
                kept out of Google Analytics and served without heavy 3D assets.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => refetchVisits()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Visits (7d)</p>
                <p className="text-2xl font-bold">{analysis.total.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className={analysis.flagged > 0 ? 'border-yellow-500' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Flagged</p>
                <p className="text-2xl font-bold text-yellow-600">{analysis.flagged.toLocaleString()}</p>
              </div>
              <Flag className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unexpected country</p>
                <p className="text-2xl font-bold">{analysis.unexpectedCountry.toLocaleString()}</p>
              </div>
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className={analysis.spikes.length > 0 ? 'border-red-500' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active spikes</p>
                <p className="text-2xl font-bold text-red-600">{analysis.spikes.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={rules?.enabled ? 'default' : 'secondary'}>
          {rules?.enabled ? 'Detection ON' : 'Detection OFF'}
        </Badge>
        <Badge variant="outline">{modeLabel}</Badge>
        <span>
          Expecting: {(rules?.allowed_countries ?? DEFAULT_RULES.allowed_countries).join(', ') || '—'}
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Settings className="h-4 w-4 mr-2" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="block">
            <Shield className="h-4 w-4 mr-2" />
            Edge Blocking
          </TabsTrigger>
        </TabsList>

        {/* Overview ---------------------------------------------------------- */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Spike alerts */}
          {analysis.spikes.length > 0 && (
            <Alert className="border-l-4 border-l-red-500">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertTitle>Volume spike detected</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-sm">
                  {analysis.spikes.map((s) => (
                    <li key={`${s.kind}-${s.label}`}>
                      {s.count.toLocaleString()} visits from {s.kind === 'country' ? 'country' : 'source'}{' '}
                      <code className="font-mono">{s.label}</code> in the last {analysis.windowMin} min
                      (threshold {analysis.threshold}).
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Country breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Visits by country (7 days)</CardTitle>
              <CardDescription>Countries outside your allowlist are highlighted.</CardDescription>
            </CardHeader>
            <CardContent>
              {visitsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : analysis.countries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No visits recorded yet. Data appears here once the migration is applied and the site
                  receives traffic.
                </p>
              ) : (
                <ScrollArea className="h-[320px]">
                  <div className="space-y-1">
                    {analysis.countries.map((c) => {
                      const allowed = (rules?.allowed_countries ?? DEFAULT_RULES.allowed_countries).includes(
                        c.code
                      );
                      const pct = analysis.total ? Math.round((c.total / analysis.total) * 100) : 0;
                      return (
                        <div
                          key={c.code}
                          className={`flex items-center justify-between p-2 rounded ${
                            !allowed && c.code !== 'Unknown' ? 'bg-yellow-500/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium w-16">{c.code}</span>
                            {!allowed && c.code !== 'Unknown' && (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                unexpected
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            {c.flagged > 0 && (
                              <span className="text-yellow-600">{c.flagged} flagged</span>
                            )}
                            <span className="text-muted-foreground w-10 text-right">{pct}%</span>
                            <span className="font-medium w-16 text-right">{c.total.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Recent flagged visits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent flagged visits</CardTitle>
            </CardHeader>
            <CardContent>
              {recentFlagged.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No flagged visits.</p>
              ) : (
                <ScrollArea className="h-[260px]">
                  <div className="space-y-1">
                    {recentFlagged.map((v, i) => (
                      <div
                        key={`${v.created_at}-${i}`}
                        className="flex items-center justify-between text-sm p-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-medium w-10">{v.country_code || '??'}</span>
                          <span className="truncate text-muted-foreground">{v.path || '/'}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(v.created_at), 'MMM d, HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules ------------------------------------------------------------- */}
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detection rules</CardTitle>
              <CardDescription>
                Configure what counts as odd traffic and how the public site responds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Enable detection</h4>
                  <p className="text-sm text-muted-foreground">
                    Master switch for logging and flagging.
                  </p>
                </div>
                <Switch
                  checked={form.enabled}
                  disabled={!canManage}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Handling mode</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  {(['monitor', 'soft_handle'] as TrafficMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={!canManage}
                      onClick={() => setForm((f) => ({ ...f, mode: m }))}
                      className={`flex-1 text-left p-3 rounded-lg border transition-colors ${
                        form.mode === m ? 'border-primary bg-primary/5' : 'border-border'
                      } ${!canManage ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className="font-medium">
                        {m === 'monitor' ? 'Monitor only' : 'Soft handle'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {m === 'monitor'
                          ? 'Log & flag, but change nothing for visitors.'
                          : 'Also skip Google Analytics & heavy 3D assets for flagged visits.'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="allowed-countries">Expected countries (ISO codes, comma-separated)</Label>
                <Input
                  id="allowed-countries"
                  value={form.allowedCountries}
                  disabled={!canManage}
                  placeholder="US, CA"
                  onChange={(e) => setForm((f) => ({ ...f, allowedCountries: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Visits from countries not in this list are flagged. Leave empty to disable
                  country-based flagging. Use 2-letter codes (e.g. US, CA, GB).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="spike-threshold">Spike threshold (visits)</Label>
                  <Input
                    id="spike-threshold"
                    type="number"
                    min={1}
                    value={form.spikeThreshold}
                    disabled={!canManage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, spikeThreshold: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spike-window">Spike window (minutes)</Label>
                  <Input
                    id="spike-window"
                    type="number"
                    min={1}
                    value={form.spikeWindowMinutes}
                    disabled={!canManage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, spikeWindowMinutes: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                A spike alert fires when more than the threshold of visits arrive from a single country
                or source within the window.
              </p>

              <div className="flex justify-end">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!canManage || saveMutation.isPending || !rules?.id}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveMutation.isPending ? 'Saving…' : 'Save rules'}
                </Button>
              </div>
              {!canManage && (
                <p className="text-xs text-muted-foreground text-right">
                  You can view but not change these rules.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edge blocking guidance ------------------------------------------- */}
        <TabsContent value="block" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Truly preventing the visits (Cloudflare edge)
              </CardTitle>
              <CardDescription>
                This dashboard detects and soft-handles odd traffic in the browser. To stop the requests
                from reaching the site at all, add a firewall rule at the Cloudflare edge.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                The in-app layer can't block a request — the page is already served before JavaScript
                runs. Hard blocking lives in Cloudflare, in front of the site:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>Cloudflare dashboard → your domain → <strong>Security → WAF → Custom rules</strong>.</li>
                <li>Create a rule, e.g. <em>Block</em> when:</li>
              </ol>
              <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
{`(ip.geoip.country eq "SG") and not http.request.uri.path contains "/admin"`}
              </pre>
              <p className="text-muted-foreground">
                Or choose the <strong>Managed Challenge</strong> action instead of Block to let real
                people through a quick check while stopping bots. Pair it with{' '}
                <strong>Security → Bots</strong> (Bot Fight Mode) and a Rate Limiting rule to cover
                volume spikes from any country.
              </p>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Blocking an entire country also blocks real visitors there (travelers, VPN users).
                  For a portfolio, <strong>Managed Challenge</strong> is usually safer than an outright
                  block.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OddTrafficMonitor;
