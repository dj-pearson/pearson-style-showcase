/**
 * Escape the five HTML-significant characters so a value is inert inside HTML
 * text or a quoted attribute. Use on every caller-controlled value that goes
 * into an email body or other HTML string.
 */
export function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape plain text, then turn newlines into <br> for an HTML body. */
export function textToHtml(input: unknown): string {
  return escapeHtml(input).replace(/\r?\n/g, '<br>');
}
