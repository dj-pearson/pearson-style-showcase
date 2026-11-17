import { existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { METHOD_ARTICLES } from '@/lib/crm-automation';

/**
 * The money page links these by slug. A renamed or deleted markdown file would
 * leave /ai-crm-automation pointing at a 404, so the link list is checked
 * against content/crm rather than trusted.
 */
describe('METHOD_ARTICLES', () => {
  it.each(METHOD_ARTICLES.map((a) => [a.slug] as const))('%s exists in content/crm', (slug) => {
    expect(existsSync(`content/crm/${slug}.md`)).toBe(true);
  });
});
