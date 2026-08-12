/**
 * CSV serialisation helpers.
 *
 * Exports are opened in Excel, Sheets and Numbers, which treat a field
 * beginning with =, +, - or @ as a formula. A contact or account name is
 * attacker-influenced in the same way any other stored string is, so fields are
 * neutralised on the way out as well as quoted correctly.
 */

/** Characters that make a spreadsheet treat a field as a formula. */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * True when the value is a plain number, including a negative one. Numbers must
 * not be formula-guarded: prefixing -12.50 turns an amount into text and breaks
 * every downstream sum.
 */
function isNumericLiteral(value: string): boolean {
  return value !== '' && Number.isFinite(Number(value));
}

/**
 * Render one value as a CSV field: formula-guarded, quote-escaped, and quoted
 * when it contains a delimiter, quote, newline or edge whitespace.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = String(value);

  if (!isNumericLiteral(text) && FORMULA_PREFIXES.some((p) => text.startsWith(p))) {
    // A leading apostrophe is the portable way to force text; the character is
    // consumed by the spreadsheet rather than shown in the cell.
    text = `'${text}`;
  }

  const needsQuoting =
    text.includes(',') ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r') ||
    text !== text.trim();

  return needsQuoting ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Join one record's values into a CSV line. */
export function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsvField).join(',');
}
