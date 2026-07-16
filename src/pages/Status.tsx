import { useQuery } from '@tanstack/react-query';
import SEO from '../components/SEO';

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL || 'https://functions.danpearson.net';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface ServiceHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  lastChecked: string;
}

interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number;
  checks: ServiceHealth[];
}

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${FUNCTIONS_URL}/health-dashboard`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  // A 503 (unhealthy) still returns a valid body we want to display.
  const data = (await res.json()) as HealthResponse;
  return data;
}

const STATUS_META: Record<HealthStatus, { label: string; dot: string; text: string }> = {
  healthy: { label: 'All systems operational', dot: 'bg-green-500', text: 'text-green-600' },
  degraded: { label: 'Degraded performance', dot: 'bg-yellow-500', text: 'text-yellow-600' },
  unhealthy: { label: 'System outage', dot: 'bg-red-500', text: 'text-red-600' },
};

function StatusDot({ status }: { status: HealthStatus }) {
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${STATUS_META[status].dot}`}
      aria-hidden="true"
    />
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const Status = () => {
  const { data, error, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['health-dashboard'],
    queryFn: fetchHealth,
    refetchInterval: 60_000, // auto-refresh every 60 seconds
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const overall: HealthStatus = data?.status ?? 'unhealthy';
  const meta = STATUS_META[overall];

  return (
    <>
      <SEO
        title="System Status | Dan Pearson"
        description="Live operational status of the Dan Pearson platform services."
        url="https://danpearson.net/status"
      />
      <main className="min-h-[100dvh] bg-background px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold mb-2">System Status</h1>
          <p className="text-muted-foreground mb-8">Live health of platform services.</p>

          {/* Overall status banner */}
          <div className="flex items-center gap-3 rounded-lg border p-5 mb-6" role="status">
            {isLoading ? (
              <>
                <span className="inline-block h-3 w-3 rounded-full bg-muted-foreground/40 animate-pulse" />
                <span className="text-lg font-medium">Checking status…</span>
              </>
            ) : error ? (
              <>
                <StatusDot status="unhealthy" />
                <span className="text-lg font-medium text-red-600">
                  Unable to reach the status service
                </span>
              </>
            ) : (
              <>
                <StatusDot status={overall} />
                <span className={`text-lg font-medium ${meta.text}`}>{meta.label}</span>
              </>
            )}
          </div>

          {/* Individual services */}
          {data && (
            <ul className="divide-y rounded-lg border">
              {data.checks.map((check) => (
                <li key={check.name} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <StatusDot status={check.status} />
                    <span className="font-medium capitalize">{check.name.replace(/-/g, ' ')}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className={STATUS_META[check.status].text}>{check.status}</span>
                    {typeof check.latency === 'number' && <span> · {check.latency}ms</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Metadata */}
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {data && <span>Version {data.version}</span>}
            {data && <span>Uptime {formatUptime(data.uptime)}</span>}
            <span>
              Last checked{' '}
              {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">This page refreshes automatically every 60 seconds.</p>
        </div>
      </main>
    </>
  );
};

export default Status;
