import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SEO from '../SEO';

const metaContents = (name: string, isProperty = false) =>
  Array.from(
    document.querySelectorAll<HTMLMetaElement>(
      `meta[${isProperty ? 'property' : 'name'}="${name}"]`
    )
  ).map((el) => el.content);

const renderSEO = (props: React.ComponentProps<typeof SEO>, path = '/news/example') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SEO {...props} />
    </MemoryRouter>
  );

describe('SEO meta tags', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('emits one article:tag element per tag', () => {
    renderSEO({
      title: 'Tagged article',
      type: 'article',
      tags: ['AI', 'Automation', 'CRM'],
    });

    expect(metaContents('article:tag', true)).toEqual(['AI', 'Automation', 'CRM']);
  });

  it('does not duplicate article:tag elements when the same tags rerender', () => {
    const { rerender } = renderSEO({
      title: 'Tagged article',
      type: 'article',
      tags: ['AI', 'Automation'],
    });

    rerender(
      <MemoryRouter initialEntries={['/news/example']}>
        <SEO title="Tagged article" type="article" tags={['AI', 'Automation']} />
      </MemoryRouter>
    );

    expect(metaContents('article:tag', true)).toEqual(['AI', 'Automation']);
  });

  it('clears every article-scoped tag when the next page is not an article', () => {
    renderSEO({
      title: 'Tagged article',
      type: 'article',
      tags: ['AI', 'Automation'],
      section: 'Technology',
      publishedTime: '2026-01-01T00:00:00Z',
      modifiedTime: '2026-02-01T00:00:00Z',
      contentSummary: 'A summary of the article.',
    });
    cleanup();

    renderSEO({ title: 'About', type: 'website' }, '/about');

    expect(metaContents('article:tag', true)).toEqual([]);
    expect(metaContents('article:section', true)).toEqual([]);
    expect(metaContents('article:published_time', true)).toEqual([]);
    expect(metaContents('article:modified_time', true)).toEqual([]);
    expect(metaContents('article:author', true)).toEqual([]);
    expect(metaContents('citation_publication_date')).toEqual([]);
    expect(metaContents('abstract')).toEqual([]);
  });

  it('leaves the static viewport tag alone', () => {
    const viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
    document.head.appendChild(viewport);

    renderSEO({ title: 'Home', type: 'website' }, '/');

    expect(metaContents('viewport')).toEqual([
      'width=device-width, initial-scale=1.0, viewport-fit=cover',
    ]);
  });

  it('writes a single canonical link for the current route', () => {
    renderSEO({ title: 'About' }, '/about');

    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://danpearson.net/about');
  });
});
