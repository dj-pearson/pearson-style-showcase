import { describe, it, expect } from 'vitest';
// The scheduler's cron evaluator lives with the edge functions but is pure TS,
// so it can be unit-tested here (it is the logic that decides which scheduled
// maintenance tasks fire).
import {
  parseCronField,
  matchesCron,
  computeNextRun,
  isTaskDue,
} from '../../../supabase/functions/_shared/cron';

describe('cron field parsing', () => {
  it('expands wildcards, steps, ranges and lists', () => {
    expect(parseCronField('*', 0, 5)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(parseCronField('*/15', 0, 59)).toEqual(new Set([0, 15, 30, 45]));
    expect(parseCronField('1-3', 0, 59)).toEqual(new Set([1, 2, 3]));
    expect(parseCronField('0,30', 0, 59)).toEqual(new Set([0, 30]));
  });
});

describe('matchesCron', () => {
  it('matches "0 2 * * *" (daily at 02:00 UTC)', () => {
    expect(matchesCron('0 2 * * *', new Date('2026-06-01T02:00:00Z'))).toBe(true);
    expect(matchesCron('0 2 * * *', new Date('2026-06-01T02:01:00Z'))).toBe(false);
    expect(matchesCron('0 2 * * *', new Date('2026-06-01T03:00:00Z'))).toBe(false);
  });

  it('matches "*/15 * * * *" (every 15 minutes)', () => {
    expect(matchesCron('*/15 * * * *', new Date('2026-06-01T10:30:00Z'))).toBe(true);
    expect(matchesCron('*/15 * * * *', new Date('2026-06-01T10:31:00Z'))).toBe(false);
  });

  it('matches "0 0 * * 0" (Sunday midnight)', () => {
    // 2026-06-07 is a Sunday.
    expect(matchesCron('0 0 * * 0', new Date('2026-06-07T00:00:00Z'))).toBe(true);
    // 2026-06-08 is a Monday.
    expect(matchesCron('0 0 * * 0', new Date('2026-06-08T00:00:00Z'))).toBe(false);
  });

  it('rejects malformed expressions', () => {
    expect(matchesCron('0 2 * *', new Date())).toBe(false); // only 4 fields
  });
});

describe('computeNextRun', () => {
  it('finds the next daily 02:00 occurrence', () => {
    const next = computeNextRun('0 2 * * *', new Date('2026-06-01T05:00:00Z'));
    expect(next?.toISOString()).toBe('2026-06-02T02:00:00.000Z');
  });

  it('finds the next 15-minute boundary', () => {
    const next = computeNextRun('*/15 * * * *', new Date('2026-06-01T10:07:00Z'));
    expect(next?.toISOString()).toBe('2026-06-01T10:15:00.000Z');
  });
});

describe('isTaskDue', () => {
  it('is always due when it has never run', () => {
    expect(isTaskDue('0 2 * * *', null, new Date('2026-06-01T02:00:00Z'))).toBe(true);
  });

  it('is due once the next scheduled time has passed', () => {
    const lastRun = new Date('2026-06-01T02:00:00Z');
    // Next run is 2026-06-02T02:00. now is after that -> due.
    expect(isTaskDue('0 2 * * *', lastRun, new Date('2026-06-02T02:05:00Z'))).toBe(true);
  });

  it('is not due before the next scheduled time', () => {
    const lastRun = new Date('2026-06-01T02:00:00Z');
    // Still the same day, before the next 02:00 -> not due.
    expect(isTaskDue('0 2 * * *', lastRun, new Date('2026-06-01T18:00:00Z'))).toBe(false);
  });
});
