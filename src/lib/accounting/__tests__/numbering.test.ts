import { describe, it, expect, vi } from 'vitest';
import { insertWithNextSequence, nextSequence } from '../numbering';

describe('nextSequence', () => {
  it('does not reuse a number after a deletion', () => {
    // DRAW-001..003 existed and 002 was deleted. Counting rows gives 3 again,
    // which payments.payment_number UNIQUE rejects.
    const remaining = ['DRAW-2026-001', 'DRAW-2026-003'];
    expect(remaining.length + 1).toBe(3);
    expect(nextSequence(remaining, 'DRAW-2026')).toBe(4);
  });

  it('starts at 1 with nothing on file', () => {
    expect(nextSequence([], 'DRAW-2026')).toBe(1);
  });

  it('ignores other years and malformed numbers', () => {
    expect(nextSequence(['DRAW-2025-009', 'DRAW-2026-002', 'DRAW-2026-x', null], 'DRAW-2026')).toBe(
      3
    );
  });

  it('treats an old unsuffixed estimated-tax number as the first payment', () => {
    expect(nextSequence(['EST-2026-Q1'], 'EST-2026-Q1')).toBe(2);
    expect(nextSequence(['EST-2026-Q1', 'EST-2026-Q1-2'], 'EST-2026-Q1')).toBe(3);
    expect(nextSequence(['EST-2026-Q2'], 'EST-2026-Q1')).toBe(1);
  });
});

describe('insertWithNextSequence', () => {
  it('retries with a fresh number when a concurrent save took it', async () => {
    const taken = ['DRAW-2026-001'];
    const insert = vi
      .fn()
      .mockImplementationOnce(async () => {
        taken.push('DRAW-2026-002'); // someone else won the race
        return { error: { code: '23505', message: 'duplicate key' } };
      })
      .mockImplementation(async () => ({ error: null }));

    const seq = await insertWithNextSequence({
      prefix: 'DRAW-2026',
      fetchNumbers: async () => [...taken],
      insert,
    });

    expect(seq).toBe(3);
    expect(insert.mock.calls.map((c) => c[0])).toEqual([2, 3]);
  });

  it('throws other errors without retrying', async () => {
    const insert = vi.fn(async () => ({ error: { code: '42501', message: 'denied' } }));
    await expect(
      insertWithNextSequence({ prefix: 'P', fetchNumbers: async () => [], insert })
    ).rejects.toMatchObject({ message: 'denied' });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('gives up after the attempt limit', async () => {
    const insert = vi.fn(async () => ({ error: { code: '23505', message: 'dup' } }));
    await expect(
      insertWithNextSequence({ prefix: 'P', fetchNumbers: async () => [], insert, attempts: 2 })
    ).rejects.toMatchObject({ message: 'dup' });
    expect(insert).toHaveBeenCalledTimes(2);
  });
});
