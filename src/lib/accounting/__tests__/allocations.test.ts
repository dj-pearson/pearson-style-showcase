import { describe, it, expect } from 'vitest';
import { clampAllocationAmount, unallocatedCents, validateAllocations } from '../allocations';

const invoices = [
  { id: 'a', invoice_number: 'INV-A', amount_due: 60 },
  { id: 'b', invoice_number: 'INV-B', amount_due: 80 },
  { id: 'big', invoice_number: 'INV-BIG', amount_due: 1000 },
];

describe('validateAllocations', () => {
  it('accepts a split that adds up exactly in cents', () => {
    // 50.10 + 50.20 > 100.30 as floats.
    const result = validateAllocations({
      paymentAmount: 100.3,
      existingAllocations: [],
      rows: [
        { invoice_id: 'a', amount: '50.10' },
        { invoice_id: 'b', amount: '50.20' },
      ],
      invoices,
    });
    expect(result).toEqual({
      ok: true,
      allocations: [
        { invoice_id: 'a', amount_allocated: 50.1 },
        { invoice_id: 'b', amount_allocated: 50.2 },
      ],
    });
  });

  it('counts allocations already saved against the payment', () => {
    // $500 payment, $500 already allocated: allocating it again must fail.
    const result = validateAllocations({
      paymentAmount: 500,
      existingAllocations: [300, 200],
      rows: [{ invoice_id: 'big', amount: '500' }],
      invoices,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/\$0\.00 of this payment is unallocated/);
  });

  it('allows the unallocated remainder', () => {
    const result = validateAllocations({
      paymentAmount: 500,
      existingAllocations: [300],
      rows: [{ invoice_id: 'big', amount: '200' }],
      invoices,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects more than an invoice has due, summing duplicate rows', () => {
    const result = validateAllocations({
      paymentAmount: 500,
      existingAllocations: [],
      rows: [
        { invoice_id: 'a', amount: '40' },
        { invoice_id: 'a', amount: '30' },
      ],
      invoices,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('INV-A has only $60.00 due.');
  });

  it('merges duplicate rows for one invoice into one allocation', () => {
    const result = validateAllocations({
      paymentAmount: 500,
      existingAllocations: [],
      rows: [
        { invoice_id: 'a', amount: '20.05' },
        { invoice_id: 'a', amount: '30.05' },
      ],
      invoices,
    });
    expect(result).toEqual({
      ok: true,
      allocations: [{ invoice_id: 'a', amount_allocated: 50.1 }],
    });
  });

  it('needs at least one filled row', () => {
    const result = validateAllocations({
      paymentAmount: 10,
      existingAllocations: [],
      rows: [
        { invoice_id: '', amount: '5' },
        { invoice_id: 'a', amount: '0' },
      ],
      invoices,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an invoice that is no longer in the unpaid list', () => {
    const result = validateAllocations({
      paymentAmount: 10,
      existingAllocations: [],
      rows: [{ invoice_id: 'gone', amount: '5' }],
      invoices,
    });
    expect(result.ok).toBe(false);
  });
});

describe('clampAllocationAmount', () => {
  it('caps at the invoice amount due', () => {
    expect(clampAllocationAmount('75', 60, 10000)).toBe('60.00');
  });

  it('caps at what is left on the payment', () => {
    expect(clampAllocationAmount('75', 1000, 2550)).toBe('25.50');
  });

  it('leaves amounts within both limits alone apart from formatting', () => {
    expect(clampAllocationAmount('12.5', 60, 10000)).toBe('12.50');
  });

  it('passes through empty or non-positive input', () => {
    expect(clampAllocationAmount('', 60, 100)).toBe('');
    expect(clampAllocationAmount('-3', 60, 100)).toBe('-3');
  });
});

describe('unallocatedCents', () => {
  it('subtracts saved allocations exactly', () => {
    expect(unallocatedCents(100.3, [50.1, 50.2])).toBe(0);
    expect(unallocatedCents('500', [0.1, 0.2])).toBe(49970);
  });
});
