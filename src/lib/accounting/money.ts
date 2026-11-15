/**
 * Integer-cent money helpers.
 *
 * Amounts come back from PostgREST as JS numbers (DECIMAL(15,2)), and adding
 * them as floats drifts: 50.10 + 50.20 is 100.30000000000001, so an equality
 * check against 100.30 fails. Convert to whole cents before summing or
 * comparing, and back to dollars only for display or writes.
 */

export type MoneyInput = number | string | null | undefined;

/** Dollars (number or numeric string) to whole cents. Non-numeric input is 0. */
export function toCents(value: MoneyInput): number {
  const n = typeof value === 'string' ? Number(value.trim()) : Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  // toPrecision(15) strips binary noise first, so 1.005 * 100 = 100.49999...
  // becomes 100.5 and rounds to 101 rather than 100.
  const scaled = Math.abs(Number((n * 100).toPrecision(15)));
  const cents = Math.round(scaled);
  return n < 0 ? -cents : cents;
}

/** Whole cents to dollars. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Sum dollar amounts exactly; returns whole cents. */
export function sumCents(values: Iterable<MoneyInput>): number {
  let total = 0;
  for (const v of values) total += toCents(v);
  return total;
}

/** Sum dollar amounts exactly; returns dollars. */
export function sumMoney(values: Iterable<MoneyInput>): number {
  return fromCents(sumCents(values));
}
