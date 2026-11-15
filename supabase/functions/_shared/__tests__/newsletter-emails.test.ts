import { assert, assertEquals, assertStringIncludes } from '../test-asserts.ts';
import {
  confirmPageUrl,
  confirmationEmail,
  listUnsubscribeHeaders,
  oneClickUnsubscribeUrl,
  unsubscribePageUrl,
  welcomeEmail,
} from '../newsletter-emails.ts';

Deno.test('confirmation email links to the confirm page with the token', () => {
  const url = confirmPageUrl('abc_DEF-123');
  assertEquals(url, 'https://danpearson.net/newsletter/confirm?token=abc_DEF-123');
  const email = confirmationEmail(url);
  assertStringIncludes(email.html, `href="${url}"`);
  assertStringIncludes(email.text, url);
  assertStringIncludes(email.text, '7 days');
});

Deno.test('email HTML escapes interpolated URLs', () => {
  const email = confirmationEmail('https://danpearson.net/?a=1&b="><script>');
  assert(!email.html.includes('<script>'));
  assertStringIncludes(email.html, '&amp;b=&quot;&gt;&lt;script&gt;');
});

Deno.test('welcome email carries a real unsubscribe link, not a mailto', () => {
  const url = unsubscribePageUrl('id.sig');
  const email = welcomeEmail(url);
  assertStringIncludes(email.html, `href="${url}"`);
  assertStringIncludes(email.text, url);
  assert(!email.html.includes('mailto:'));
  assertStringIncludes(email.subject, "You're on the list");
});

Deno.test('one-click headers follow RFC 8058', () => {
  const url = oneClickUnsubscribeUrl('id.sig', 'https://functions.example.test');
  assertEquals(url, 'https://functions.example.test/newsletter-unsubscribe?token=id.sig');
  const headers = listUnsubscribeHeaders(url);
  assertEquals(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert(headers['List-Unsubscribe'].startsWith(`<${url}>`));
});
