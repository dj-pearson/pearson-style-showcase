import { describe, it, expect } from 'vitest';
import {
  applyTicketFilters,
  buildTicketSearchFilter,
  escapeLikePattern,
  pageRange,
  quotePostgrestValue,
  type FilterableQuery,
  type TicketFilters,
} from '../ticketQuery';

class RecordingQuery implements FilterableQuery<RecordingQuery> {
  calls: Array<[string, ...unknown[]]> = [];
  eq(column: string, value: unknown) {
    this.calls.push(['eq', column, value]);
    return this;
  }
  in(column: string, values: readonly unknown[]) {
    this.calls.push(['in', column, [...values]]);
    return this;
  }
  not(column: string, operator: string, value: unknown) {
    this.calls.push(['not', column, operator, value]);
    return this;
  }
  or(filters: string) {
    this.calls.push(['or', filters]);
    return this;
  }
}

const base: TicketFilters = {
  search: '',
  status: 'all',
  category: 'all',
  priority: 'all',
  showArchived: true,
};

describe('ticket search escaping', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(escapeLikePattern('50%_off\\now')).toBe('50\\%\\_off\\\\now');
  });

  it('quotes values so , ( ) . : stay literal and escapes quotes', () => {
    expect(quotePostgrestValue('a,b(c).d:e')).toBe('"a,b(c).d:e"');
    expect(quotePostgrestValue('say "hi" \\ bye')).toBe('"say \\"hi\\" \\\\ bye"');
  });

  it('returns null for a blank search', () => {
    expect(buildTicketSearchFilter('')).toBeNull();
    expect(buildTicketSearchFilter('   ')).toBeNull();
  });

  it('builds one ilike per column with a quoted, escaped pattern', () => {
    expect(buildTicketSearchFilter('  TKT-0042 ')).toBe(
      [
        'ticket_number.ilike."%TKT-0042%"',
        'subject.ilike."%TKT-0042%"',
        'user_email.ilike."%TKT-0042%"',
        'user_name.ilike."%TKT-0042%"',
        'message.ilike."%TKT-0042%"',
      ].join(',')
    );
  });

  it('keeps user commas, parens and wildcards from breaking out of the filter', () => {
    const filter = buildTicketSearchFilter('a,b),status.eq.spam,(100%_')!;
    // The whole user string sits inside one quoted value per column.
    expect(filter.split(',ticket_number').length).toBe(1);
    expect(filter).toContain('subject.ilike."%a,b),status.eq.spam,(100\\\\%\\\\_%"');
  });

  it('sends a literal * as a single-character match, not a wildcard run', () => {
    expect(buildTicketSearchFilter('a*b')).toContain('subject.ilike."%a_b%"');
  });
});

describe('applyTicketFilters', () => {
  it('adds nothing for the widest filter set', () => {
    const q = applyTicketFilters(new RecordingQuery(), base);
    expect(q.calls).toEqual([]);
  });

  it('hides archived statuses and limits to active ones by default', () => {
    const q = applyTicketFilters(new RecordingQuery(), {
      ...base,
      status: 'active',
      showArchived: false,
    });
    expect(q.calls).toEqual([
      ['not', 'status', 'in', '(closed,resolved,disregard,spam)'],
      ['in', 'status', ['open', 'in_progress', 'waiting_for_user', 'waiting_for_agent']],
    ]);
  });

  it('pushes status, category, priority and search to the server', () => {
    const q = applyTicketFilters(new RecordingQuery(), {
      search: 'refund',
      status: 'resolved',
      category: 'billing',
      priority: '4',
      showArchived: true,
    });
    expect(q.calls).toEqual([
      ['eq', 'status', 'resolved'],
      ['eq', 'category', 'billing'],
      ['eq', 'priority', 4],
      ['or', buildTicketSearchFilter('refund')],
    ]);
  });

  it('ignores a non-numeric priority', () => {
    const q = applyTicketFilters(new RecordingQuery(), { ...base, priority: 'x' });
    expect(q.calls).toEqual([]);
  });
});

describe('pageRange', () => {
  it('returns inclusive ranges', () => {
    expect(pageRange(0)).toEqual([0, 49]);
    expect(pageRange(2)).toEqual([100, 149]);
    expect(pageRange(1, 10)).toEqual([10, 19]);
  });
});
