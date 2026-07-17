import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * error-tracking.ts reads several knobs from import.meta.env at MODULE LOAD
 * (sample rate, custom endpoint) and gates capture behind
 * VITE_ERROR_TRACKING_DEV in dev. To exercise those branches we load a fresh
 * module instance per test via resetModules + stubEnv, which also gives each
 * test isolated module state (error cache, breadcrumbs, session id).
 */
async function load(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  // Default: enable the capture path in the dev/test environment.
  vi.stubEnv('VITE_ERROR_TRACKING_DEV', 'true');
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('../error-tracking');
}

beforeEach(() => {
  // Silence the module's direct console diagnostics.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('error-tracking', () => {
  it('captures an exception and returns a report id', async () => {
    const m = await load();
    const id = m.captureException(new Error('boom'));
    expect(id).toBeTruthy();
    expect(m.getErrorTrackingStats().uniqueErrors).toBe(1);
  });

  it('returns null in dev when VITE_ERROR_TRACKING_DEV is not set', async () => {
    const m = await load({ VITE_ERROR_TRACKING_DEV: '' });
    expect(m.captureException(new Error('x'))).toBeNull();
  });

  it('deduplicates identical errors within the 5-minute window', async () => {
    const m = await load();
    const err = new Error('dup');
    err.stack = 'Error: dup\n    at foo (file.ts:1:1)';
    const id1 = m.captureException(err);
    const id2 = m.captureException(err);
    expect(id1).toBeTruthy();
    expect(id2).toBeNull(); // deduped
  });

  it('limits breadcrumbs to a 50-item buffer', async () => {
    const m = await load();
    for (let i = 0; i < 60; i++) {
      m.addBreadcrumb({ category: 'test', message: `crumb ${i}`, level: 'info' });
    }
    expect(m.getErrorTrackingStats().breadcrumbCount).toBe(50);
  });

  it('drops errors when the sample rate is 0', async () => {
    const m = await load({ VITE_ERROR_SAMPLE_RATE: '0' });
    expect(m.captureException(new Error('sampled out'))).toBeNull();
  });

  it('strips PII and sends a structured report to the configured endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const m = await load({ VITE_ERROR_TRACKING_ENDPOINT: 'https://track.test/report' });
    m.captureException(new Error('contact test@example.com now'));

    // sendErrorReport runs asynchronously (fire-and-forget).
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledWith('https://track.test/report', expect.any(Object));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);

    // PII masked.
    expect(body.message).not.toContain('test@example.com');
    expect(body.message).toContain('te***@example.com');

    // Report structure.
    for (const field of ['id', 'timestamp', 'severity', 'fingerprint', 'context', 'tags', 'breadcrumbs']) {
      expect(body).toHaveProperty(field);
    }
    expect(body.context).toHaveProperty('userAgent');
  });

  it('captureMessage records an informational event with an id', async () => {
    const m = await load();
    expect(m.captureMessage('just a message')).toBeTruthy();
  });
});
