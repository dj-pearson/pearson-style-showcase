import { assertEquals, assert } from '../_shared/test-asserts.ts';
import { validateEmail, sanitizeInput, escapeHtml, messageToHtml } from './validation.ts';

// The handler sends email via Resend and rate-limits via the shared limiter
// (covered in rate-limiter.test.ts). These tests cover the contact form's input
// validation and the HTML-escaping that protects the email body from injected
// markup submitted through the form.

Deno.test('validateEmail accepts valid and rejects invalid / over-long addresses', () => {
  assertEquals(validateEmail('user@example.com'), true);
  assertEquals(validateEmail('not-an-email'), false);
  assertEquals(validateEmail('a@' + 'x'.repeat(260) + '.com'), false);
});

Deno.test('sanitizeInput trims and enforces a max length', () => {
  assertEquals(sanitizeInput('  hello  ', 100), 'hello');
  assertEquals(sanitizeInput('abcdef', 3), 'abc');
});

Deno.test('escapeHtml neutralizes XSS markup in submitted fields', () => {
  const escaped = escapeHtml('<script>alert("xss")</script>');
  assert(!escaped.includes('<script>'), 'raw script tag must not survive');
  assert(escaped.includes('&lt;script&gt;'), 'angle brackets must be entity-encoded');
});

Deno.test('messageToHtml escapes markup then converts newlines to <br>', () => {
  const html = messageToHtml('line1\n<b>bold</b>');
  assert(html.includes('<br>'), 'newlines become <br>');
  assert(!html.includes('<b>bold</b>'), 'the injected <b> tag must be escaped');
  assert(html.includes('&lt;b&gt;'), 'the tag is rendered inert');
});
