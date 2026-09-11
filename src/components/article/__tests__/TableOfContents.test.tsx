import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import TableOfContents from '../TableOfContents';

const longArticle = ['## One', '## Two', '### Two point one', '## Three', '## Four'].join('\n\n');

describe('TableOfContents', () => {
  it('lists the sections and links to the ids the renderer emits', () => {
    render(<TableOfContents content={longArticle} />);

    const nav = screen.getByRole('navigation', { name: 'Article contents' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Two point one' })).toHaveAttribute(
      'href',
      '#two-point-one'
    );
  });

  it('stays out of the way of a short article', () => {
    render(<TableOfContents content={'## Only\n\n## Two'} />);
    expect(screen.queryByRole('navigation', { name: 'Article contents' })).not.toBeInTheDocument();
  });

  it('lists h2 and h3 but not the title or deeper headings', () => {
    render(<TableOfContents content={`# Title\n\n${longArticle}\n\n#### Deep`} />);

    expect(screen.queryByRole('link', { name: 'Title' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Deep' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });

  it('renders nothing at all for an article with no headings', () => {
    render(<TableOfContents content={'just prose'} />);
    expect(screen.queryByText('Contents')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
