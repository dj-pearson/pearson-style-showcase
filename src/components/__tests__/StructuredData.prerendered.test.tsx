import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import StructuredData from '@/components/SEO/StructuredData';
import { prerenderedSchemaTypes } from '@/lib/seo';

/** Mimics the block scripts/prerender.mjs writes into the head. */
function addPrerenderedGraph(path: string, types: string[]) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-prerendered', '');
  script.dataset.path = path;
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': types.map((type) => ({ '@type': type })),
  });
  document.head.appendChild(script);
  return script;
}

const prerenderedScript = () => document.head.querySelector('script[data-prerendered]');

describe('StructuredData with a prerendered graph', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    window.history.replaceState(null, '', '/');
  });

  it('skips a type the graph for this URL already has', () => {
    addPrerenderedGraph('/', ['WebSite', 'Person', 'BreadcrumbList']);
    render(<StructuredData type="person" />);
    expect(document.getElementById('structured-data-person')).toBeNull();
    expect(prerenderedScript()).not.toBeNull();
  });

  it('renders a type the graph does not have', () => {
    addPrerenderedGraph('/', ['WebSite', 'Person']);
    render(<StructuredData type="faq" data={{ questions: [] }} />);
    expect(document.getElementById('structured-data-faq')).not.toBeNull();
  });

  it('drops a graph built for another path and renders its own block', () => {
    addPrerenderedGraph('/about', ['ProfilePage', 'Person']);
    window.history.replaceState(null, '', '/projects');
    render(<StructuredData type="person" />);
    expect(prerenderedScript()).toBeNull();
    expect(document.getElementById('structured-data-person')).not.toBeNull();
  });

  it('treats a trailing slash as the same path', () => {
    addPrerenderedGraph('/about', ['Person']);
    window.history.replaceState(null, '', '/about/');
    expect(prerenderedSchemaTypes().has('Person')).toBe(true);
  });

  it('renders normally when nothing was prerendered', () => {
    render(<StructuredData type="breadcrumb" data={{ items: [] }} />);
    expect(document.getElementById('structured-data-breadcrumb')).not.toBeNull();
  });
});
