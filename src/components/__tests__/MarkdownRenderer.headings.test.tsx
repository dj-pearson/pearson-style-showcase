import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { MarkdownRenderer, headingSlug } from '../MarkdownRenderer';

describe('headingSlug', () => {
  it('lowercases and joins words with hyphens', () => {
    expect(headingSlug('What Actually Works')).toBe('what-actually-works');
  });

  it('drops punctuation and collapses runs of hyphens', () => {
    expect(headingSlug('Pricing: what it costs (really)')).toBe('pricing-what-it-costs-really');
  });

  it('strips accents rather than dropping the word', () => {
    expect(headingSlug('Café notes')).toBe('cafe-notes');
  });

  it('returns an empty string when nothing is left to slug', () => {
    expect(headingSlug('!!!')).toBe('');
  });
});

describe('MarkdownRenderer headings', () => {
  it('gives every heading a linkable id', () => {
    render(<MarkdownRenderer content={'# Title\n\n## First section\n\n### Detail'} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('id', 'title');
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('id', 'first-section');
    expect(screen.getByRole('heading', { level: 3 })).toHaveAttribute('id', 'detail');
  });

  it('keeps duplicate headings distinct', () => {
    render(<MarkdownRenderer content={'## Setup\n\ntext\n\n## Setup\n\nmore'} />);

    const ids = screen.getAllByRole('heading', { level: 2 }).map((h) => h.id);
    expect(ids).toEqual(['setup', 'setup-2']);
  });

  it('builds the id from the text of a heading that carries markup', () => {
    render(<MarkdownRenderer content={'## The **hard** part'} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('id', 'the-hard-part');
  });

  it('offers a link to each section', () => {
    render(<MarkdownRenderer content={'## First section'} />);

    const anchor = screen.getByRole('link', { name: 'Link to this section: First section' });
    expect(anchor).toHaveAttribute('href', '#first-section');
  });
});
