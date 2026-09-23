import { assertEquals, assert } from '../test-asserts.ts';
import {
  checkArticle,
  countFaqs,
  countWords,
  findBannedTerms,
  normalizeUrl,
  removeSection,
  restrictLinks,
  slugify,
  stripInvisible,
} from '../content-quality.ts';

Deno.test('countWords ignores markup, link targets and table rules', () => {
  assertEquals(
    countWords(
      '## Heading\n\n**Bold** text with a [link](https://example.com/very/long/path).\n\n| a | b |\n|---|---|'
    ),
    8
  );
});

Deno.test('slugify strips accents and punctuation and cuts on a word boundary', () => {
  assertEquals(slugify('Caf\u00e9 AI: What\u2019s New?'), 'cafe-ai-what-s-new');
  const long = slugify('word '.repeat(40));
  assert(long.length <= 80);
  assert(!long.endsWith('-'));
});

Deno.test('normalizeUrl drops tracking params, www, fragments and trailing slashes', () => {
  assertEquals(
    normalizeUrl('https://www.a.com/x/?utm_source=rss&id=3#top'),
    'https://a.com/x/?id=3'
  );
  assertEquals(normalizeUrl('https://a.com/x/'), 'https://a.com/x');
});

Deno.test('restrictLinks keeps supplied URLs and paths and unlinks everything else', () => {
  const { content, removed } = restrictLinks(
    'See [the source](https://www.a.com/story?utm_source=x), [a guess](https://made-up.com/page), [pillar](/news/pillar), [bad path](/news/nope) and ![img](https://img.com/i.png).',
    ['https://a.com/story'],
    ['/news/pillar']
  );
  assertEquals(
    content,
    'See [the source](https://www.a.com/story?utm_source=x), a guess, [pillar](/news/pillar), bad path and ![img](https://img.com/i.png).'
  );
  assertEquals(removed, ['https://made-up.com/page', '/news/nope']);
});

Deno.test('removeSection removes a heading and its body up to the next H2', () => {
  const md = 'Intro\n\n## Sources\n\n- one\n- two\n\n## FAQ\n\nq';
  assertEquals(removeSection(md, /sources/i), 'Intro\n\n## FAQ\n\nq');
});

Deno.test('countFaqs counts bold question lines under the FAQ heading only', () => {
  const md =
    '**Not a FAQ?**\ntext\n\n## Frequently asked questions\n\n**What is it?**\nAn answer.\n\n**Why now?**\nBecause.\n\n## Next';
  assertEquals(countFaqs(md), 2);
});

Deno.test(
  'stripInvisible removes zero-width, bidi and tag characters and normalises odd spaces',
  () => {
    const dirty = `a\u200Bb\u202Ec\u00A0d\u{E0041}e`;
    assertEquals(stripInvisible(dirty), 'abc de');
  }
);

Deno.test('findBannedTerms matches whole-word starts, case-insensitively', () => {
  assertEquals(findBannedTerms('We Delve into this. Moreover, it is fine.'), ['delve', 'moreover']);
  assertEquals(findBannedTerms('The model shelved the plan.'), []);
});

const goodBody = [
  '**OpenAI halved batch prices on Monday, which makes overnight document processing cheap enough for small teams.**',
  '',
  '## Key takeaways',
  '',
  '- Batch prices fell by half.',
  '',
  '## What happened',
  '',
  'word '.repeat(300),
  '',
  '## Why it matters for your business',
  '',
  'word '.repeat(300),
  '',
  '## Frequently asked questions',
  '',
  '**What changed?**',
  'Prices.',
  '',
  '**Who benefits?**',
  'Small teams.',
  '',
  '**When does it apply?**',
  'Now.',
].join('\n');

const draft = {
  title: 'OpenAI halves batch API prices',
  content: goodBody,
  excerpt: 'OpenAI halved batch prices, which changes the maths on overnight AI jobs.',
  seoTitle: 'OpenAI batch API price cut explained',
  seoDescription:
    'OpenAI halved batch API prices. Here is what the cut means for small teams running document processing, and what to change this quarter.',
};

const rules = {
  minWords: 500,
  maxWords: 2000,
  requiredHeadings: ['Key takeaways', 'What happened', 'Why it matters', 'Frequently asked'],
  minFaqs: 3,
};

Deno.test('checkArticle passes a well-formed draft', () => {
  const report = checkArticle(draft, rules);
  assert(report.ok, JSON.stringify(report.issues));
});

Deno.test('checkArticle blocks a draft missing a required section or FAQs', () => {
  const report = checkArticle(
    {
      ...draft,
      content: goodBody
        .replace('## What happened', '## Background')
        .replace(/\*\*When does it apply\?\*\*\nNow\./, ''),
    },
    rules
  );
  assert(!report.ok);
  const codes = report.issues.map((i) => i.code);
  assert(codes.includes('missing_section'));
  assert(codes.includes('few_faqs'));
});

Deno.test('checkArticle treats one banned term as a warning and three as blocking', () => {
  const one = checkArticle({ ...draft, content: `${goodBody}\nMoreover.` }, rules);
  assert(one.ok);
  assert(one.issues.some((i) => i.code === 'banned_terms' && !i.blocking));
  const three = checkArticle(
    { ...draft, content: `${goodBody}\nMoreover, we delve into a tapestry.` },
    rules
  );
  assert(!three.ok);
});

Deno.test('checkArticle blocks unfilled template placeholders', () => {
  const report = checkArticle(
    { ...draft, content: `${goodBody}\n[Buy]({{AMAZON:B000000000}})` },
    rules
  );
  assert(report.issues.some((i) => i.code === 'template_leak' && i.blocking));
});
