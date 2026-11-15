import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SEO from '@/components/SEO';
import { SEO_CONFIG } from '@/lib/seo';

const meta = (property: string) =>
  [...document.head.querySelectorAll(`meta[property="${property}"]`)].map((el) =>
    el.getAttribute('content')
  );

describe('SEO meta tags', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('emits one article:tag per tag', () => {
    render(
      <MemoryRouter>
        <SEO type="article" tags={['CRM', 'RevOps', 'HubSpot']} />
      </MemoryRouter>
    );
    expect(meta('article:tag')).toEqual(['CRM', 'RevOps', 'HubSpot']);
  });

  it('removes article tags when the page unmounts', () => {
    const { unmount } = render(
      <MemoryRouter>
        <SEO type="article" tags={['CRM']} />
      </MemoryRouter>
    );
    unmount();
    expect(meta('article:tag')).toEqual([]);
  });

  it('gives dimensions for the default card only', () => {
    const { rerender } = render(
      <MemoryRouter>
        <SEO />
      </MemoryRouter>
    );
    expect(meta('og:image')).toEqual([SEO_CONFIG.defaultImage]);
    expect(meta('og:image:width')).toEqual(['1200']);
    expect(meta('og:image:height')).toEqual(['630']);

    rerender(
      <MemoryRouter>
        <SEO image="https://cdn.example.com/cover.jpg" />
      </MemoryRouter>
    );
    expect(meta('og:image')).toEqual(['https://cdn.example.com/cover.jpg']);
    expect(meta('og:image:width')).toEqual([]);
    expect(meta('og:image:height')).toEqual([]);
  });
});
