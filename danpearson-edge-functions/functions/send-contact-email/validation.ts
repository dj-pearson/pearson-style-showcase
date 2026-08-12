/**
 * Pure input validation / sanitization for the contact form.
 *
 * Extracted from index.ts so it can be unit-tested without the Resend/Supabase
 * imports. Also adds escapeHtml(): the submitted fields are interpolated into
 * an HTML email body, so they must be HTML-escaped to prevent a submitter from
 * injecting markup/script into the email the site owner receives.
 */

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/** Trim and hard-cap the length of a free-text field. */
export function sanitizeInput(input: string, maxLength: number): string {
  return input.trim().slice(0, maxLength);
}

/** Escape the five HTML-significant characters so values are inert in HTML. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a message and convert newlines to <br> for safe HTML rendering. */
export function messageToHtml(message: string): string {
  return escapeHtml(message).replace(/\n/g, '<br>');
}
