import { describe, it, expect } from 'vitest';
import { extractHeadings, createHeadingIds, headingSlug } from '../markdown-headings';

describe('extractHeadings', () => {
  it('reads headings in document order with their level', () => {
    expect(extractHeadings('# Title\n\n## One\n\ntext\n\n### Detail\n\n## Two')).toEqual([
      { level: 1, text: 'Title', id: 'title' },
      { level: 2, text: 'One', id: 'one' },
      { level: 3, text: 'Detail', id: 'detail' },
      { level: 2, text: 'Two', id: 'two' },
    ]);
  });

  it('ignores a hash inside a fenced code block', () => {
    const markdown = '## Real\n\n```bash\n# not a heading\n```\n\n## Also real';
    expect(extractHeadings(markdown).map((h) => h.text)).toEqual(['Real', 'Also real']);
  });

  it('handles tilde fences too', () => {
    const markdown = '## Real\n\n~~~\n# not a heading\n~~~\n';
    expect(extractHeadings(markdown).map((h) => h.text)).toEqual(['Real']);
  });

  it('strips inline markup from the text and the id', () => {
    expect(extractHeadings('## The **hard** part')).toEqual([
      { level: 2, text: 'The hard part', id: 'the-hard-part' },
    ]);
    expect(extractHeadings('## A `code` word')[0].text).toBe('A code word');
    expect(extractHeadings('## See [the docs](https://example.com)')[0].text).toBe('See the docs');
  });

  it('numbers repeated headings the way the renderer does, counting every level', () => {
    const ids = extractHeadings('# Setup\n\n## Setup\n\n## Setup').map((h) => h.id);
    expect(ids).toEqual(['setup', 'setup-2', 'setup-3']);
  });

  it('drops a closing hash run', () => {
    expect(extractHeadings('## Balanced ##')[0]).toMatchObject({
      text: 'Balanced',
      id: 'balanced',
    });
  });

  it('returns nothing for markdown without headings', () => {
    expect(extractHeadings('just a paragraph')).toEqual([]);
  });
});

describe('createHeadingIds', () => {
  it('gives each repeat its own id', () => {
    const next = createHeadingIds();
    expect([next('Setup'), next('Setup'), next('Other')]).toEqual(['setup', 'setup-2', 'other']);
  });

  it('returns nothing when there is no text to slug', () => {
    expect(createHeadingIds()('!!!')).toBeUndefined();
  });
});

describe('headingSlug', () => {
  it('folds accents rather than dropping the word', () => {
    expect(headingSlug('Café notes')).toBe('cafe-notes');
  });
});
