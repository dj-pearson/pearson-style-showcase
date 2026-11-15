/**
 * Run under several zones, e.g.
 *   TZ=America/Chicago npx vitest run src/lib/accounting/__tests__/dates.test.ts
 *   TZ=Asia/Tokyo npx vitest run src/lib/accounting/__tests__/dates.test.ts
 * The assertions hold in any zone; that is the point of the helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  defaultTaxYear,
  formatDateOnly,
  monthKeyOfDateOnly,
  parseDateOnly,
  toDateOnly,
  todayDateOnly,
} from '../dates';

describe('parseDateOnly', () => {
  it('keeps the calendar day of a DATE value in local time', () => {
    const d = parseDateOnly('2026-03-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it('round-trips through toDateOnly', () => {
    for (const s of ['2026-01-01', '2026-02-28', '2026-12-31', '2024-02-29']) {
      expect(toDateOnly(parseDateOnly(s))).toBe(s);
    }
  });

  it('returns an Invalid Date for garbage', () => {
    expect(Number.isNaN(parseDateOnly('not a date').getTime())).toBe(true);
  });
});

describe('formatDateOnly', () => {
  it('shows the stored day, not the day before', () => {
    expect(formatDateOnly('2026-01-01')).toBe('Jan 1, 2026');
  });

  it('handles empty and unparseable values', () => {
    expect(formatDateOnly(null)).toBe('');
    expect(formatDateOnly('bad')).toBe('bad');
  });
});

describe('monthKeyOfDateOnly', () => {
  it('groups the first of the month into that month', () => {
    expect(monthKeyOfDateOnly('2026-03-01')).toBe('2026-03');
    expect(monthKeyOfDateOnly('2026-01-01')).toBe('2026-01');
  });
});

describe('todayDateOnly', () => {
  it('formats the local calendar day', () => {
    // 23:30 local on Dec 31 is still Dec 31 locally, whatever UTC says.
    expect(todayDateOnly(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
    expect(todayDateOnly(new Date(2026, 0, 1, 0, 15))).toBe('2026-01-01');
  });
});

describe('defaultTaxYear', () => {
  it('uses the previous year until April 15', () => {
    expect(defaultTaxYear(new Date(2026, 0, 10))).toBe(2025);
    expect(defaultTaxYear(new Date(2026, 3, 14))).toBe(2025);
  });

  it('uses the current year from April 15 on', () => {
    expect(defaultTaxYear(new Date(2026, 3, 15))).toBe(2026);
    expect(defaultTaxYear(new Date(2026, 10, 15))).toBe(2026);
  });
});
