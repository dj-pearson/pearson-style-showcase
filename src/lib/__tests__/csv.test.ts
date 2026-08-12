import { describe, it, expect } from 'vitest';
import { escapeCsvField, toCsvRow } from '../csv';

describe('escapeCsvField', () => {
  it('leaves a plain value untouched', () => {
    expect(escapeCsvField('Consulting')).toBe('Consulting');
  });

  it('renders null and undefined as empty', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('quotes a value containing a comma', () => {
    expect(escapeCsvField('Acme, Inc.')).toBe('"Acme, Inc."');
  });

  it('doubles embedded quotes and wraps the field', () => {
    // Previously emitted "Bob "The Builder"", which breaks the column split.
    expect(escapeCsvField('Bob "The Builder"')).toBe('"Bob ""The Builder"""');
  });

  it('quotes values containing newlines', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
    expect(escapeCsvField('line one\r\nline two')).toBe('"line one\r\nline two"');
  });

  it('quotes values with leading or trailing whitespace', () => {
    expect(escapeCsvField('  padded')).toBe('"  padded"');
  });

  it('neutralises formula-leading values', () => {
    expect(escapeCsvField('=1+1')).toBe("'=1+1");
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvField('=HYPERLINK("http://evil","click")')).toBe(
      '"\'=HYPERLINK(""http://evil"",""click"")"'
    );
  });

  it('does not treat numbers as formulas, including negatives', () => {
    // A guarded -12.50 would become text and break downstream sums.
    expect(escapeCsvField('-12.50')).toBe('-12.50');
    expect(escapeCsvField(-12.5)).toBe('-12.5');
    expect(escapeCsvField('+3')).toBe('+3');
    expect(escapeCsvField((1234.5).toFixed(2))).toBe('1234.50');
  });

  it('still guards a formula that merely starts with a sign', () => {
    expect(escapeCsvField('-1+cmd|calc')).toBe("'-1+cmd|calc");
  });
});

describe('toCsvRow', () => {
  it('joins fields with commas, escaping each', () => {
    expect(toCsvRow(['INV-1', 'Acme, Inc.', '100.00'])).toBe('INV-1,"Acme, Inc.",100.00');
  });

  it('keeps column count stable when a field contains a comma', () => {
    const row = toCsvRow(['a', 'b,c', 'd']);
    // Naive interpolation produced 4 columns here; quoting keeps it at 3.
    expect(row).toBe('a,"b,c",d');
  });
});
