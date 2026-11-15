/**
 * Date-only (Postgres DATE) helpers.
 *
 * `new Date('2026-03-01')` parses a date-only string as UTC midnight, which is
 * the evening of Feb 28 anywhere west of Greenwich. Month grouping, display
 * and range filters then land on the wrong day. These helpers keep DATE
 * values in local time on the way in and out.
 */
import { format, isValid, parseISO } from 'date-fns';

/**
 * Parse a DATE column ('YYYY-MM-DD') as local midnight. Full ISO timestamps
 * are parsed as the instant they name. Returns an Invalid Date for bad input.
 */
export function parseDateOnly(value: string): Date {
  return parseISO(value);
}

/** Format a Date as 'YYYY-MM-DD' in local time. */
export function toDateOnly(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Today's local date as 'YYYY-MM-DD'. */
export function todayDateOnly(now: Date = new Date()): string {
  return toDateOnly(now);
}

/**
 * Display a DATE column, e.g. 'Mar 1, 2026'. Returns the raw value when it
 * can't be parsed, and '' for empty input.
 */
export function formatDateOnly(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
  if (!value) return '';
  const d = parseDateOnly(value);
  return isValid(d) ? d.toLocaleDateString('en-US', options) : value;
}

/** 'YYYY-MM' month key for a DATE column, without a UTC shift. */
export function monthKeyOfDateOnly(value: string): string {
  return toDateOnly(parseDateOnly(value)).slice(0, 7);
}

/**
 * Tax year to show by default: the previous year until the April 15 filing
 * deadline, the current year after it.
 */
export function defaultTaxYear(now: Date = new Date()): number {
  const year = now.getFullYear();
  const beforeDeadline = now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 15);
  return beforeDeadline ? year - 1 : year;
}
