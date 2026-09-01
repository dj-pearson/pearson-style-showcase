import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';

import MarkdownRenderer from '../MarkdownRenderer';

const withCode = ['Intro paragraph.', '', '```json', '{ "a": 1 }', '```'].join('\n');

describe('MarkdownRenderer code blocks', () => {
  it('renders the code immediately, before the highlighter chunk resolves', () => {
    render(<MarkdownRenderer content={withCode} />);
    // The Suspense fallback shows the same text, so nothing is hidden while the
    // lazily loaded Prism chunk is in flight.
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
  });

  it('swaps in the highlighted output once the lazy chunk loads', async () => {
    const { container } = render(<MarkdownRenderer content={withCode} />);
    // react-syntax-highlighter emits per-token spans with inline styles; the
    // plain fallback is a single <code> with no children elements.
    await waitFor(
      () => {
        const tokens = container.querySelectorAll('code span[style], pre span[style]');
        expect(tokens.length).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );
  });

  it('leaves prose without a code fence untouched', () => {
    render(<MarkdownRenderer content={'Just a paragraph.'} />);
    expect(screen.getByText('Just a paragraph.')).toBeInTheDocument();
  });
});
