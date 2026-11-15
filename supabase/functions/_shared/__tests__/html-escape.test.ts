import { assertEquals } from '../test-asserts.ts';
import { escapeHtml, textToHtml } from '../html-escape.ts';

Deno.test('escapeHtml neutralises markup and quotes', () => {
  assertEquals(
    escapeHtml(`<img src=x onerror="alert('x')">&`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'
  );
});

Deno.test('escapeHtml stringifies null and undefined to empty', () => {
  assertEquals(escapeHtml(null), '');
  assertEquals(escapeHtml(undefined), '');
  assertEquals(escapeHtml(42), '42');
});

Deno.test('textToHtml escapes before converting newlines', () => {
  assertEquals(textToHtml('a<b>\nc\r\nd'), 'a&lt;b&gt;<br>c<br>d');
});
