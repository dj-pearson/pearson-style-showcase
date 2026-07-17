import { assertEquals, assert } from '../_shared/test-asserts.ts';
import {
  assertApiKeyConfigured,
  parseAiArticleJson,
  slugify,
  calculateReadTime,
} from './parse.ts';

// The handler calls the Claude API and Supabase (both blocked in-sandbox), so
// these tests cover the pure logic that shapes the generated article: the API
// key guard, response parsing, and the derived slug / read-time fields. No
// external network calls are made.

Deno.test('assertApiKeyConfigured throws when the key is missing (500 path)', () => {
  let threw = false;
  try {
    assertApiKeyConfigured(undefined);
  } catch (err) {
    threw = true;
    assert(String((err as Error).message).includes('CLAUDE_API_KEY'));
  }
  assert(threw);
  // Does not throw when configured.
  assertApiKeyConfigured('sk-ant-xxx');
});

Deno.test('parseAiArticleJson extracts a fenced ```json block into an article', () => {
  const response = 'Here is your article:\n```json\n{"title":"Hello World","content":"Body text here"}\n```';
  const article = parseAiArticleJson(response);
  assertEquals(article.title, 'Hello World');
  assertEquals(article.content, 'Body text here');
});

Deno.test('parseAiArticleJson extracts a bare JSON object embedded in prose', () => {
  const response = 'Sure! {"title":"T","content":"C"} done';
  const article = parseAiArticleJson(response);
  assertEquals(article.title, 'T');
});

Deno.test('parseAiArticleJson throws on malformed AI output', () => {
  let threw = false;
  try {
    parseAiArticleJson('this is not json at all');
  } catch (err) {
    threw = true;
    assert(String((err as Error).message).includes('Failed to parse'));
  }
  assert(threw);
});

Deno.test('slugify produces a URL-friendly, capped slug', () => {
  assertEquals(slugify('Hello, World! & More'), 'hello-world-more');
  assert(slugify('x'.repeat(200)).length <= 100);
});

Deno.test('calculateReadTime estimates minutes from the word count', () => {
  assertEquals(calculateReadTime('word '.repeat(200).trim()), '1 min read');
  assertEquals(calculateReadTime('word '.repeat(400).trim()), '2 min read');
});
