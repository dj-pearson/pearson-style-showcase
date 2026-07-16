import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  useCanonicalUrl,
  generateCanonicalUrl,
  shouldIndexPath,
} from '../useCanonicalUrl';

function routerWrapper(entry: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );
}

describe('useCanonicalUrl', () => {
  it('generates the canonical URL and metadata for a known route', () => {
    const { result } = renderHook(() => useCanonicalUrl(), { wrapper: routerWrapper('/about') });
    expect(result.current.canonicalUrl).toBe('https://danpearson.net/about');
    expect(result.current.shouldIndex).toBe(true);
    expect(result.current.priority).toBe(0.8);
    expect(result.current.changefreq).toBe('monthly');
  });

  it('normalizes a trailing slash (except root)', () => {
    const { result } = renderHook(() => useCanonicalUrl('/projects/'), {
      wrapper: routerWrapper('/'),
    });
    expect(result.current.canonicalUrl).toBe('https://danpearson.net/projects');
  });

  it('keeps the root path as "/"', () => {
    const { result } = renderHook(() => useCanonicalUrl(), { wrapper: routerWrapper('/') });
    expect(result.current.canonicalUrl).toBe('https://danpearson.net/');
    expect(result.current.priority).toBe(1.0);
  });

  it('strips query parameters from the canonical URL', () => {
    const { result } = renderHook(() => useCanonicalUrl(), {
      wrapper: routerWrapper('/projects?page=2&sort=new'),
    });
    expect(result.current.canonicalUrl).toBe('https://danpearson.net/projects');
    expect(result.current.canonicalUrl).not.toContain('?');
  });

  it('marks admin/auth routes as non-indexable', () => {
    const { result } = renderHook(() => useCanonicalUrl(), {
      wrapper: routerWrapper('/admin/dashboard'),
    });
    expect(result.current.shouldIndex).toBe(false);
  });

  it('gives article (/news/:slug) pages an article priority', () => {
    const { result } = renderHook(() => useCanonicalUrl(), {
      wrapper: routerWrapper('/news/my-article'),
    });
    expect(result.current.canonicalUrl).toBe('https://danpearson.net/news/my-article');
    expect(result.current.priority).toBe(0.8);
  });

  it('exposes standalone generateCanonicalUrl and shouldIndexPath helpers', () => {
    expect(generateCanonicalUrl('/about/')).toBe('https://danpearson.net/about');
    expect(generateCanonicalUrl('/')).toBe('https://danpearson.net/');
    expect(shouldIndexPath('/projects')).toBe(true);
    expect(shouldIndexPath('/admin')).toBe(false);
  });
});
