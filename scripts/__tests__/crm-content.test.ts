import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs helper shared with the build scripts, no types
import { readArticles, extractFaqs } from '../lib/content.mjs';

interface Article {
  meta: {
    slug: string;
    title: string;
    category: string;
    tags: string[];
    excerpt: string;
    seo_description: string;
    seo_keywords: string[];
    target_keyword: string;
    published: boolean;
  };
  body: string;
}

const articles: Article[] = readArticles();

/**
 * The article production standards from AI_CRM_AUTOMATION_STRATEGY.md section 9.
 *
 * These are asserted rather than remembered because they are what makes the
 * content citable: the FAQ block becomes FAQPage schema in the prerendered
 * HTML, the CRM category is what routes an article into /topics/ai-crm-automation,
 * and the internal links are the whole point of a hub-and-spoke structure.
 */
describe('CRM article standards', () => {
  it('has articles to check', () => {
    expect(articles.length).toBeGreaterThan(0);
  });

  it.each(articles.map((a) => [a.meta.slug, a] as const))(
    '%s carries the CRM category and tags so the topic hub picks it up',
    (_slug, article) => {
      expect(article.meta.category).toBe('CRM');
      expect(article.meta.tags).toContain('CRM');
    }
  );

  it.each(articles.map((a) => [a.meta.slug, a] as const))(
    '%s has an FAQ block that yields FAQPage schema',
    (_slug, article) => {
      const faqs = extractFaqs(article.body);

      // Two is the floor in the standards; the extractor returning zero also
      // catches an FAQ section written in a shape the parser cannot read, which
      // fails silently and would ship a page with no FAQ schema at all.
      expect(faqs.length).toBeGreaterThanOrEqual(2);

      for (const faq of faqs) {
        expect(faq.question.length).toBeGreaterThan(10);
        expect(faq.answer.length).toBeGreaterThan(40);
      }
    }
  );

  it.each(articles.map((a) => [a.meta.slug, a] as const))(
    '%s links internally to the hub, the money page or another pillar',
    (_slug, article) => {
      expect(article.body).toMatch(/\]\(\/(news|topics|ai-crm-automation)/);
    }
  );

  it.each(articles.map((a) => [a.meta.slug, a] as const))(
    '%s opens with a direct answer for the LLM lead-paragraph extract',
    (_slug, article) => {
      const lead = article.body.split('\n\n')[0];

      expect(lead.length).toBeGreaterThan(80);
      // The house convention is a bolded claim in the opening line, which is
      // what gets quoted back in an AI answer.
      expect(lead).toMatch(/\*\*/);
    }
  );

  it.each(articles.map((a) => [a.meta.slug, a] as const))(
    '%s has SEO fields within the length search engines actually render',
    (_slug, article) => {
      expect(article.meta.seo_description.length).toBeGreaterThan(70);
      expect(article.meta.seo_description.length).toBeLessThanOrEqual(320);
      expect(article.meta.seo_keywords.length).toBeGreaterThanOrEqual(3);
      expect(article.meta.target_keyword.length).toBeGreaterThan(0);
    }
  );

  it('has no duplicate slugs or target keywords competing with each other', () => {
    const slugs = articles.map((a) => a.meta.slug);
    const keywords = articles.map((a) => a.meta.target_keyword.toLowerCase());

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it('points every internal /news link at an article that exists', () => {
    const slugs = new Set(articles.map((a) => a.meta.slug));

    for (const article of articles) {
      const links = article.body.match(/\]\(\/news\/([a-z0-9-]+)\)/g) || [];

      for (const link of links) {
        const target = link.match(/\/news\/([a-z0-9-]+)/)![1];
        // Only CRM articles live in content/; a link to a database-only legacy
        // article is legitimate, so this checks the CRM cross-links specifically.
        if (target.includes('crm') || slugs.has(target)) {
          expect(slugs, `${article.meta.slug} links to /news/${target}`).toContain(target);
        }
      }
    }
  });
});

describe('extractFaqs', () => {
  it('reads a multi-paragraph answer rather than stopping at the first newline', () => {
    const body = [
      '## Frequently asked questions',
      '',
      '**Does it handle a long answer?**',
      'First line of the answer.',
      'Second line of the same answer.',
      '',
      '**And a second question?**',
      'Another answer.',
    ].join('\n');

    const faqs = extractFaqs(body);

    expect(faqs).toHaveLength(2);
    expect(faqs[0].answer).toContain('Second line');
  });

  it('stops at the next section rather than swallowing the rest of the article', () => {
    const body = [
      '## Frequently asked questions',
      '',
      '**A question?**',
      'An answer.',
      '',
      '## Sources',
      '',
      '- Not a FAQ',
    ].join('\n');

    const faqs = extractFaqs(body);

    expect(faqs).toHaveLength(1);
    expect(faqs[0].answer).not.toContain('Not a FAQ');
  });

  it('returns nothing for an article with no FAQ section', () => {
    expect(extractFaqs('## Something else\n\nBody copy.')).toEqual([]);
  });
});
