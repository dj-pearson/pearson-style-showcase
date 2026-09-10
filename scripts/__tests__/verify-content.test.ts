import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build script, no types
import { diffArticles } from '../verify-content.mjs';

/**
 * The comparison that decides whether a prerendered article is actually
 * readable in the app. It is worth pinning down because the failure it catches
 * is silent everywhere else: the build succeeds, the tests pass, and the page
 * still turns into "Article Not Found" the moment React mounts.
 */
describe('diffArticles', () => {
  it('passes when every slug is present and published', () => {
    const result = diffArticles(
      ['a', 'b'],
      [
        { slug: 'a', published: true },
        { slug: 'b', published: true },
      ]
    );
    expect(result).toEqual({ missing: [], unpublished: [], ok: true });
  });

  it('reports slugs the database does not have', () => {
    const result = diffArticles(['a', 'b'], [{ slug: 'a', published: true }]);
    expect(result.missing).toEqual(['b']);
    expect(result.ok).toBe(false);
  });

  it('reports slugs that exist but are unpublished', () => {
    const result = diffArticles(['a'], [{ slug: 'a', published: false }]);
    expect(result.unpublished).toEqual(['a']);
    expect(result.missing).toEqual([]);
    expect(result.ok).toBe(false);
  });

  it('does not treat an empty expectation as a failure', () => {
    expect(diffArticles([], []).ok).toBe(true);
  });
});
