import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import Status from '../Status';

function healthPayload(overrides: Record<string, unknown> = {}) {
  return {
    status: 'healthy',
    timestamp: '2026-01-01T00:00:00.000Z',
    version: '1.2.3',
    uptime: 3720,
    checks: [
      { name: 'database', status: 'healthy', latency: 42, lastChecked: '2026-01-01T00:00:00.000Z' },
      { name: 'edge-runtime', status: 'healthy', lastChecked: '2026-01-01T00:00:00.000Z' },
    ],
    ...overrides,
  };
}

function stubFetch(payload: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      json: async () => payload,
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Status page', () => {
  it('renders the healthy state with individual service checks', async () => {
    stubFetch(healthPayload());
    render(<Status />, { initialEntries: ['/status'] });

    await waitFor(() => expect(screen.getByText('All systems operational')).toBeInTheDocument());
    expect(screen.getByText(/database/i)).toBeInTheDocument();
    expect(screen.getByText(/edge runtime/i)).toBeInTheDocument();
    expect(screen.getByText('Version 1.2.3')).toBeInTheDocument();
  });

  it('renders the degraded state', async () => {
    stubFetch(
      healthPayload({
        status: 'degraded',
        checks: [
          { name: 'database', status: 'degraded', latency: 1500, lastChecked: '2026-01-01T00:00:00.000Z' },
          { name: 'edge-runtime', status: 'healthy', lastChecked: '2026-01-01T00:00:00.000Z' },
        ],
      })
    );
    render(<Status />, { initialEntries: ['/status'] });
    await waitFor(() => expect(screen.getByText('Degraded performance')).toBeInTheDocument());
  });

  it('shows an error state when the status service is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    render(<Status />, { initialEntries: ['/status'] });
    // The component retries once (react-query ~1s backoff) before the error state.
    await waitFor(
      () => expect(screen.getByText(/Unable to reach the status service/i)).toBeInTheDocument(),
      { timeout: 4000 }
    );
  });

  it('shows the auto-refresh note and last-checked label', async () => {
    stubFetch(healthPayload());
    render(<Status />, { initialEntries: ['/status'] });
    await waitFor(() => expect(screen.getByText('All systems operational')).toBeInTheDocument());
    expect(screen.getByText(/refreshes automatically every 60 seconds/i)).toBeInTheDocument();
    expect(screen.getByText(/Last checked/i)).toBeInTheDocument();
  });
});
