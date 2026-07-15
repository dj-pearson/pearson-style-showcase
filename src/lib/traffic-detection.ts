/**
 * Odd Traffic Detection
 * ---------------------
 * Lightweight, privacy-aware visitor classification for the public site.
 *
 * Why this exists: the site is a US-based portfolio, so a sudden flood of visits
 * from an unexpected country (or a single source) is almost certainly bots /
 * scrapers rather than real prospects. We can't truly *block* a request from a
 * client-side React app on Cloudflare Pages — by the time JS runs the page has
 * already been served — but we CAN:
 *   1. Detect the visitor's country/IP (via Cloudflare's same-origin
 *      `/cdn-cgi/trace`, which is CSP-safe — no external API call).
 *   2. Log the visit (country + a hashed IP, never the raw IP) for review.
 *   3. "Soft handle" flagged traffic: keep it out of Google Analytics and serve
 *      the page without heavy 3D assets, without affecting real visitors.
 *
 * True prevention (firewall-level blocking) belongs at the Cloudflare edge; see
 * the admin "Traffic Watch" panel for guidance. This module is the in-app layer.
 *
 * NOTE: `page_visits` / `traffic_rules` are not yet in the generated Supabase
 * types (`src/integrations/supabase/types.ts`). Regenerate types after applying
 * the migration to drop the `db` cast below.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type TrafficMode = 'monitor' | 'soft_handle';

export interface TrafficRules {
  enabled: boolean;
  mode: TrafficMode;
  /** ISO 3166-1 alpha-2 codes considered "expected" (e.g. ['US', 'CA']). */
  allowed_countries: string[];
  spike_threshold: number;
  spike_window_minutes: number;
}

export interface VisitorGeo {
  ip: string | null;
  ipHash: string | null;
  /** ISO 3166-1 alpha-2 country code, uppercased (e.g. 'US', 'SG'). */
  countryCode: string | null;
}

export interface TrafficEvaluation {
  /** True when the visit matches an "odd traffic" rule. */
  flagged: boolean;
  /** True when flagged AND rules say to soft-handle (skip GA / heavy assets). */
  suppress: boolean;
  reasons: string[];
  countryCode: string | null;
}

export const DEFAULT_RULES: TrafficRules = {
  enabled: true,
  mode: 'soft_handle',
  allowed_countries: ['US', 'CA'],
  spike_threshold: 100,
  spike_window_minutes: 60,
};

const GEO_CACHE_KEY = 'odd_traffic_geo';
const EVAL_CACHE_KEY = 'odd_traffic_eval';
const LOGGED_KEY = 'odd_traffic_logged';

/** Read a JSON value from sessionStorage, tolerating any failure. */
function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage may be unavailable (privacy mode) — fail open.
  }
}

/** SHA-256 hash of the IP, truncated to 16 hex chars. Never store the raw IP. */
async function hashIp(ip: string): Promise<string | null> {
  try {
    const data = new TextEncoder().encode(ip);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  } catch {
    return null;
  }
}

/** Stable-ish per-session id used to dedupe visit logging. */
function getSessionId(): string {
  const existing = readSession<string>('odd_traffic_session');
  if (existing) return existing;
  const id =
    typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  writeSession('odd_traffic_session', id);
  return id;
}

/**
 * Resolve the visitor's country + hashed IP.
 *
 * Uses Cloudflare's `/cdn-cgi/trace`, which is same-origin on Cloudflare Pages
 * (so it satisfies the site's `connect-src 'self'` CSP and needs no API key).
 * In local dev / non-Cloudflare hosts this 404s and we return nulls — detection
 * simply no-ops, which is the safe default.
 */
export async function getVisitorGeo(): Promise<VisitorGeo> {
  const cached = readSession<VisitorGeo>(GEO_CACHE_KEY);
  if (cached) return cached;

  const empty: VisitorGeo = { ip: null, ipHash: null, countryCode: null };

  try {
    const res = await fetch('/cdn-cgi/trace', { cache: 'no-store' });
    if (!res.ok) {
      writeSession(GEO_CACHE_KEY, empty);
      return empty;
    }
    const text = await res.text();
    const fields: Record<string, string> = {};
    text.split('\n').forEach((line) => {
      const idx = line.indexOf('=');
      if (idx > 0) fields[line.slice(0, idx)] = line.slice(idx + 1);
    });

    const ip = fields.ip || null;
    const loc = fields.loc ? fields.loc.toUpperCase() : null;
    const geo: VisitorGeo = {
      ip,
      ipHash: ip ? await hashIp(ip) : null,
      // 'XX' / 'T1' (Tor) are placeholders Cloudflare returns when unknown.
      countryCode: loc && loc !== 'XX' && loc !== 'T1' ? loc : null,
    };
    writeSession(GEO_CACHE_KEY, geo);
    return geo;
  } catch (err) {
    logger.log('[TrafficDetection] geo lookup unavailable', err);
    writeSession(GEO_CACHE_KEY, empty);
    return empty;
  }
}

/** Fetch the admin-configured rules, falling back to sane defaults. */
export async function fetchTrafficRules(): Promise<TrafficRules> {
  try {
    const { data, error } = await db
      .from('traffic_rules')
      .select('enabled, mode, allowed_countries, spike_threshold, spike_window_minutes')
      .limit(1)
      .maybeSingle();

    if (error || !data) return DEFAULT_RULES;

    return {
      enabled: data.enabled ?? DEFAULT_RULES.enabled,
      mode: (data.mode as TrafficMode) ?? DEFAULT_RULES.mode,
      allowed_countries: Array.isArray(data.allowed_countries)
        ? data.allowed_countries.map((c: string) => c.toUpperCase())
        : DEFAULT_RULES.allowed_countries,
      spike_threshold: data.spike_threshold ?? DEFAULT_RULES.spike_threshold,
      spike_window_minutes: data.spike_window_minutes ?? DEFAULT_RULES.spike_window_minutes,
    };
  } catch {
    return DEFAULT_RULES;
  }
}

/**
 * Classify a single visit against the rules.
 * Per-visitor signals only (country allowlist); volume-spike detection needs
 * cross-visitor aggregation and lives in the admin dashboard.
 */
export function evaluateTraffic(geo: VisitorGeo, rules: TrafficRules): TrafficEvaluation {
  const reasons: string[] = [];

  if (rules.enabled && geo.countryCode && rules.allowed_countries.length > 0) {
    if (!rules.allowed_countries.includes(geo.countryCode)) {
      reasons.push(`unexpected_country:${geo.countryCode}`);
    }
  }

  const flagged = reasons.length > 0;
  return {
    flagged,
    suppress: flagged && rules.enabled && rules.mode === 'soft_handle',
    reasons,
    countryCode: geo.countryCode,
  };
}

/** Record the visit once per session (anonymous insert; RLS allows it). */
async function logVisit(geo: VisitorGeo, evaluation: TrafficEvaluation): Promise<void> {
  if (readSession<boolean>(LOGGED_KEY)) return;
  writeSession(LOGGED_KEY, true);

  try {
    await db.from('page_visits').insert({
      path: window.location.pathname,
      country_code: geo.countryCode,
      ip_hash: geo.ipHash,
      session_id: getSessionId(),
      user_agent: navigator.userAgent?.slice(0, 500) ?? null,
      referrer: document.referrer ? document.referrer.slice(0, 500) : null,
      is_flagged: evaluation.flagged,
      flag_reason: evaluation.reasons.join(',') || null,
    });
  } catch (err) {
    // Logging is best-effort; never let it affect the visitor experience.
    logger.log('[TrafficDetection] visit log failed', err);
  }
}

/**
 * Run the full detection pass: resolve geo, load rules, classify, log, and
 * cache the result for the rest of the session. Returns the evaluation so the
 * caller (TrafficGuard) can react if needed.
 */
export async function runTrafficDetection(): Promise<TrafficEvaluation> {
  const cached = readSession<TrafficEvaluation>(EVAL_CACHE_KEY);
  if (cached) return cached;

  const [geo, rules] = await Promise.all([getVisitorGeo(), fetchTrafficRules()]);
  const evaluation = evaluateTraffic(geo, rules);

  writeSession(EVAL_CACHE_KEY, evaluation);
  // Fire-and-forget logging.
  void logVisit(geo, evaluation);

  return evaluation;
}

/**
 * Synchronous check used by Google Analytics and heavy-asset loaders to decide
 * whether to suppress for this visitor. Reads the cached evaluation; returns
 * false until detection has completed (fail-open: real visitors are never
 * blocked while we're still deciding).
 */
export function shouldSuppressForOddTraffic(): boolean {
  const evaluation = readSession<TrafficEvaluation>(EVAL_CACHE_KEY);
  return evaluation?.suppress ?? false;
}
