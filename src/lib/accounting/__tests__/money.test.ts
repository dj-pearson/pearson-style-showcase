import { describe, it, expect } from 'vitest';
import { fromCents, sumCents, sumMoney, toCents } from '../money';

describe('toCents', () => {
  it('converts dollars to whole cents', () => {
    expect(toCents(100.3)).toBe(10030);
    expect(toCents('50.10')).toBe(5010);
    expect(toCents(0)).toBe(0);
  });

  it('rounds half away from zero despite binary noise', () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents(-1.005)).toBe(-101);
    expect(toCents(0.125)).toBe(13);
  });

  it('treats missing or non-numeric input as zero', () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents('abc')).toBe(0);
    expect(toCents(Number.NaN)).toBe(0);
  });
});

describe('sumCents / sumMoney', () => {
  it('adds without float drift', () => {
    // 50.10 + 50.20 is 100.30000000000001 as floats.
    expect(50.1 + 50.2).not.toBe(100.3);
    expect(sumCents([50.1, 50.2])).toBe(10030);
    expect(sumMoney([50.1, 50.2])).toBe(100.3);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
  });

  it('round-trips through fromCents', () => {
    expect(fromCents(toCents(1234.56))).toBe(1234.56);
    expect(fromCents(-5)).toBe(-0.05);
  });
});
