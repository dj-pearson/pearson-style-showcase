import { assertEquals, assert } from '../_shared/test-asserts.ts';
import {
  buildSourcesSection,
  decodeEntities,
  extractArticleText,
  parseFeed,
  selectCandidates,
  similarTitles,
  type FeedItem,
} from './news.ts';

// The handler calls feeds, AI providers and Supabase (all blocked in-sandbox),
// so these cover the pure logic that decides which story gets written and
// what the model is shown: feed parsing, freshness and dedup, and source text
// extraction.

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>Example AI</title>
<item>
  <title><![CDATA[OpenAI cuts GPT pricing &amp; adds batch discounts]]></title>
  <link>https://example.com/openai-pricing?utm_source=rss</link>
  <pubDate>Tue, 22 Sep 2026 14:00:00 GMT</pubDate>
  <description><![CDATA[<p>Prices fall by half for <b>batch</b> jobs.</p>]]></description>
</item>
<item>
  <title>No link item</title>
  <pubDate>Tue, 22 Sep 2026 14:00:00 GMT</pubDate>
</item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry>
  <title>Google ships Gemini agents for Workspace</title>
  <link rel="alternate" href="https://blog.example.org/gemini-agents"/>
  <published>2026-09-22T09:30:00Z</published>
  <summary>Agents can now file expenses.</summary>
</entry>
</feed>`;

Deno.test('parseFeed reads RSS items, decodes CDATA and entities, skips items with no link', () => {
  const items = parseFeed(RSS, 'https://www.example.com/feed');
  assertEquals(items.length, 1);
  assertEquals(items[0].title, 'OpenAI cuts GPT pricing & adds batch discounts');
  assertEquals(items[0].source, 'example.com');
  assertEquals(items[0].summary, 'Prices fall by half for batch jobs.');
  assertEquals(items[0].publishedAt?.toISOString(), '2026-09-22T14:00:00.000Z');
});

Deno.test('parseFeed reads Atom entries using the alternate link', () => {
  const items = parseFeed(ATOM, 'https://blog.example.org/atom.xml');
  assertEquals(items.length, 1);
  assertEquals(items[0].url, 'https://blog.example.org/gemini-agents');
  assertEquals(items[0].summary, 'Agents can now file expenses.');
});

Deno.test('decodeEntities handles numeric and named entities', () => {
  assertEquals(decodeEntities('It&#8217;s &quot;fine&quot; &#x26; ok'), 'It\u2019s "fine" & ok');
});

const item = (title: string, url: string, hoursAgo: number | null): FeedItem => ({
  title,
  url,
  source: 'example.com',
  summary: '',
  publishedAt: hoursAgo === null ? null : new Date(Date.UTC(2026, 8, 23, 12) - hoursAgo * 3600_000),
});

const now = new Date(Date.UTC(2026, 8, 23, 12));

Deno.test('selectCandidates keeps fresh items newest first and drops stale ones', () => {
  const picked = selectCandidates(
    [
      item('Old story about robots', 'https://a.com/1', 80),
      item('Anthropic releases new model', 'https://a.com/2', 3),
      item('Microsoft Copilot pricing change', 'https://a.com/3', 1),
    ],
    { now, maxAgeHours: 36, excludeUrls: new Set(), recentTitles: [], limit: 10 }
  );
  assertEquals(
    picked.map((p) => p.url),
    ['https://a.com/3', 'https://a.com/2']
  );
});

Deno.test('selectCandidates drops already-used sources by normalised URL', () => {
  const picked = selectCandidates(
    [item('Anthropic releases new model', 'https://www.a.com/2/?utm_campaign=x', 3)],
    {
      now,
      maxAgeHours: 36,
      excludeUrls: new Set(['https://a.com/2']),
      recentTitles: [],
      limit: 10,
    }
  );
  assertEquals(picked.length, 0);
});

Deno.test(
  'selectCandidates drops the same story from a second outlet and recently covered stories',
  () => {
    const picked = selectCandidates(
      [
        item('OpenAI launches GPT-6 with longer context window', 'https://a.com/1', 2),
        item('OpenAI launches GPT-6 with a longer context window today', 'https://b.com/1', 1),
        item('Salesforce Agentforce pricing drops for small teams', 'https://c.com/1', 4),
      ],
      {
        now,
        maxAgeHours: 36,
        excludeUrls: new Set(),
        recentTitles: ['Salesforce Agentforce pricing drops for small teams: what changes'],
        limit: 10,
      }
    );
    assertEquals(picked.length, 1);
    assert(picked[0].title.startsWith('OpenAI launches GPT-6'));
  }
);

Deno.test('selectCandidates falls back to undated items only when nothing dated survives', () => {
  const picked = selectCandidates([item('Undated story on AI chips', 'https://a.com/u', null)], {
    now,
    maxAgeHours: 36,
    excludeUrls: new Set(),
    recentTitles: [],
    limit: 10,
  });
  assertEquals(picked.length, 1);
});

Deno.test('similarTitles ignores short words and case', () => {
  assert(similarTitles('Nvidia earnings beat estimates again', 'NVIDIA Earnings Beat Estimates'));
  assert(!similarTitles('Nvidia earnings beat estimates', 'Apple ships new Siri'));
});

Deno.test('extractArticleText keeps article paragraphs and drops navigation and scripts', () => {
  const html = `<html><body><nav><p>Home About Contact and other links here</p></nav>
    <article><h2>What changed</h2><p>OpenAI halved batch API prices on Monday for all tiers.</p>
    <script>track()</script><p>Short</p><p>Advertisement: buy our newsletter subscription now</p>
    <li>Batch jobs now cost $0.50 per million input tokens.</li></article>
    <footer><p>Copyright notice and legal text for the site</p></footer></body></html>`;
  const text = extractArticleText(html);
  assert(text.includes('What changed'));
  assert(text.includes('OpenAI halved batch API prices'));
  assert(text.includes('$0.50 per million'));
  assert(!text.includes('track()'));
  assert(!text.includes('Home About'));
  assert(!text.includes('Copyright'));
  assert(!text.includes('Advertisement'));
});

Deno.test('extractArticleText caps very long pages', () => {
  const html = `<article>${'<p>This sentence is long enough to be kept by the extractor.</p>'.repeat(500)}</article>`;
  const text = extractArticleText(html, 1000);
  assert(text.length <= 1003);
  assert(text.endsWith('...'));
});

Deno.test('buildSourcesSection lists each source with outlet and date', () => {
  const section = buildSourcesSection([item('A [bracketed] title', 'https://a.com/x', 2)]);
  assertEquals(
    section,
    '## Sources\n\n- [A bracketed title](https://a.com/x) (example.com, 2026-09-23)'
  );
});
