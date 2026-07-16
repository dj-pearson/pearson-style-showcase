/**
 * Minimal, dependency-free cron schedule evaluator.
 *
 * Supports the standard 5-field crontab format:
 *   minute hour day-of-month month day-of-week
 * with wildcards, step syntax (slash-N), ranges (a-b), and lists (a,b,c) in
 * each field. Day-of-week is 0-6 with 0 = Sunday (7 is also accepted as Sunday).
 *
 * All evaluation is done in UTC so results are deterministic regardless of the
 * host timezone. This module is intentionally pure (no Deno/DOM globals, no
 * imports) so it can be used from Deno edge functions AND unit-tested with
 * Vitest.
 */

/** Expand a single cron field into the set of matching integer values. */
export function parseCronField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();

  for (const part of field.split(',')) {
    let step = 1;
    let range = part;

    const slash = part.indexOf('/');
    if (slash !== -1) {
      range = part.slice(0, slash);
      step = parseInt(part.slice(slash + 1), 10);
      if (!Number.isFinite(step) || step <= 0) step = 1;
    }

    let lo: number;
    let hi: number;
    if (range === '*') {
      lo = min;
      hi = max;
    } else if (range.includes('-')) {
      const [a, b] = range.split('-');
      lo = parseInt(a, 10);
      hi = parseInt(b, 10);
    } else {
      lo = hi = parseInt(range, 10);
    }

    if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    for (let v = lo; v <= hi; v += step) {
      if (v >= min && v <= max) values.add(v);
    }
  }

  return values;
}

/** Returns true if `date` (evaluated in UTC) satisfies the cron expression. */
export function matchesCron(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minF, hourF, domF, monF, dowF] = parts;
  const minutes = parseCronField(minF, 0, 59);
  const hours = parseCronField(hourF, 0, 23);
  const doms = parseCronField(domF, 1, 31);
  const months = parseCronField(monF, 1, 12);
  const dows = parseCronField(dowF, 0, 7);

  const M = date.getUTCMinutes();
  const H = date.getUTCHours();
  const D = date.getUTCDate();
  const Mo = date.getUTCMonth() + 1;
  const W = date.getUTCDay(); // 0 = Sunday

  if (!minutes.has(M) || !hours.has(H) || !months.has(Mo)) return false;

  const domRestricted = domF !== '*';
  const dowRestricted = dowF !== '*';
  const domMatch = doms.has(D);
  const dowMatch = dows.has(W) || (W === 0 && dows.has(7));

  // Standard cron semantics: when both day-of-month and day-of-week are
  // restricted, a match on EITHER is sufficient.
  if (domRestricted && dowRestricted) return domMatch || dowMatch;
  if (domRestricted) return domMatch;
  if (dowRestricted) return dowMatch;
  return true;
}

/**
 * Compute the next time (strictly after `from`) that the cron expression fires.
 * Scans minute-by-minute up to ~13 months ahead; returns null if no match or
 * the expression is invalid.
 */
export function computeNextRun(expr: string, from: Date): Date | null {
  if (expr.trim().split(/\s+/).length !== 5) return null;

  // Start at the top of the next minute.
  const d = new Date(Math.floor(from.getTime() / 60000) * 60000 + 60000);
  const maxIterations = 400 * 24 * 60; // ~13 months of minutes

  for (let i = 0; i < maxIterations; i++) {
    if (matchesCron(expr, d)) return new Date(d);
    d.setUTCMinutes(d.getUTCMinutes() + 1);
  }
  return null;
}

/**
 * Decide whether a scheduled task is due to run.
 * A task with no previous run is always due. Otherwise it is due when the next
 * cron-scheduled time after its last run is at or before `now`.
 */
export function isTaskDue(
  scheduleCron: string,
  lastRun: Date | null | undefined,
  now: Date
): boolean {
  if (!lastRun) return true;
  const next = computeNextRun(scheduleCron, lastRun);
  return next !== null && next.getTime() <= now.getTime();
}
