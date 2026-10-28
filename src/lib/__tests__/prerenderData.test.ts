import { afterEach, describe, expect, it } from 'vitest';
import {
  PRERENDER_DATA_ID,
  articlePrerenderKey,
  readPrerenderData,
  resetPrerenderDataCache,
  selectTopicArticles,
  topicPrerenderKey,
  TOPIC_HUBS,
} from '@/lib/prerenderData';

function embed(text: string) {
  const script = document.createElement('script');
  script.type = 'application/json';
  script.id = PRERENDER_DATA_ID;
  script.textContent = text;
  document.body.appendChild(script);
}

afterEach(() => {
  document.getElementById(PRERENDER_DATA_ID)?.remove();
  resetPrerenderDataCache();
});

describe('readPrerenderData', () => {
  it('returns the data and timestamp when the key matches', () => {
    embed(
      JSON.stringify({
        key: articlePrerenderKey('a-slug'),
        updatedAt: 1234,
        data: { slug: 'a-slug', title: 'Closing </script> tags' },
      }).replace(/</g, '\\u003c')
    );

    expect(readPrerenderData(articlePrerenderKey('a-slug'))).toEqual({
      data: { slug: 'a-slug', title: 'Closing </script> tags' },
      updatedAt: 1234,
    });
  });

  it('keeps a null payload distinct from no payload', () => {
    embed(JSON.stringify({ key: 'article:gone', updatedAt: 0, data: null }));
    expect(readPrerenderData('article:gone')).toEqual({ data: null, updatedAt: 0 });
  });

  it('returns undefined for another route', () => {
    embed(JSON.stringify({ key: articlePrerenderKey('a-slug'), updatedAt: 1, data: {} }));

    expect(readPrerenderData(articlePrerenderKey('other-slug'))).toBeUndefined();
    expect(readPrerenderData(topicPrerenderKey('a-slug'))).toBeUndefined();
  });

  it('returns undefined for malformed JSON', () => {
    embed('{"key": "article:a-slug", ');
    expect(readPrerenderData(articlePrerenderKey('a-slug'))).toBeUndefined();
  });

  it('returns undefined for JSON without the payload fields', () => {
    embed(JSON.stringify({ key: articlePrerenderKey('a-slug') }));
    expect(readPrerenderData(articlePrerenderKey('a-slug'))).toBeUndefined();
  });

  it('returns undefined when nothing is embedded', () => {
    expect(readPrerenderData(articlePrerenderKey('a-slug'))).toBeUndefined();
  });

  it('parses the block once per page load', () => {
    embed(JSON.stringify({ key: 'topic:x', updatedAt: 5, data: [1] }));
    expect(readPrerenderData('topic:x')?.data).toEqual([1]);

    document.getElementById(PRERENDER_DATA_ID)!.textContent = JSON.stringify({
      key: 'topic:x',
      updatedAt: 6,
      data: [2],
    });
    expect(readPrerenderData('topic:x')?.data).toEqual([1]);
  });
});

describe('selectTopicArticles', () => {
  it('keeps a database row over the built-in copy and filters to the topic', () => {
    const config = TOPIC_HUBS['ai-crm-automation'];
    const unrelated = {
      slug: 'cooking',
      category: 'Food',
      tags: ['Recipes'],
      featured: false,
      created_at: '2026-01-01T00:00:00Z',
    };
    const related = { ...unrelated, slug: 'crm-row', category: 'CRM' };

    const result = selectTopicArticles([unrelated, related], config);
    const slugs = result.map((article) => article.slug);

    expect(slugs).toContain('crm-row');
    expect(slugs).not.toContain('cooking');
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
