import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@/test/test-utils';

import DateArchive from '../DateArchive';

const robotsMetas = () => Array.from(document.querySelectorAll('meta[name="robots"]'));

describe('DateArchive page', () => {
  afterEach(() => {
    robotsMetas().forEach((m) => m.remove());
  });

  it('adds a noindex robots tag while mounted', () => {
    render(<DateArchive />, { initialEntries: ['/2023/01/some-old-post'] });

    expect(robotsMetas().map((m) => m.getAttribute('content'))).toContain('noindex, nofollow');
  });

  it('removes only its own tag on unmount, leaving a pre-existing robots meta intact', () => {
    // SEO.tsx keeps a single shared robots meta. When it also reads
    // "noindex, nofollow", a selector-based cleanup would delete that one first
    // and leak the tag this page appended.
    const shared = document.createElement('meta');
    shared.name = 'robots';
    shared.content = 'noindex, nofollow';
    document.head.appendChild(shared);

    const { unmount } = render(<DateArchive />, { initialEntries: ['/2023/01/some-old-post'] });
    expect(robotsMetas()).toHaveLength(2);

    unmount();

    expect(robotsMetas()).toEqual([shared]);
    expect(shared.isConnected).toBe(true);
  });
});
