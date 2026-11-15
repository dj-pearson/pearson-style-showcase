import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs helper shared with the build scripts, no types
import { STATIC_ROUTES } from '../lib/static-routes.mjs';

interface StaticRoute {
  path: string;
  source: string;
  title: string;
  titleInSource?: string;
  description: string;
  h1: string;
  intro: string;
}

const routes: StaticRoute[] = STATIC_ROUTES;
const appSource = readFileSync('src/App.tsx', 'utf8');

/** JSX text as a reader sees it: `{' '}` is a space and line wrapping is not. */
const jsxText = (source: string) => source.replace(/\{' '\}/g, ' ').replace(/\s+/g, ' ');

/** The text of every <h1> in a page, with nested elements stripped. */
const headings = (source: string) =>
  [...source.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map(([, inner]) =>
    jsxText(inner.replace(/<[^>]+>/g, ' ')).trim()
  );

/**
 * The prerendered head and the head React writes on mount have to agree, or a
 * crawler that runs JavaScript sees one title and a crawler that does not sees
 * another. The table copies the <SEO> props, so this fails when a page's copy
 * moves and the table does not.
 */
describe('prerender static route table', () => {
  it.each(routes.map((route) => [route.path, route] as const))(
    '%s matches the <SEO> props in its page',
    (_path, route) => {
      const source = readFileSync(route.source, 'utf8');
      expect(source).toContain(route.titleInSource ?? `title="${route.title}"`);
      expect(source).toContain(`description="${route.description}"`);
    }
  );

  // The prerendered body shows h1 and intro before JavaScript runs, so they
  // have to be the page's own copy, not a paraphrase that drifts (it did:
  // /connect served "Let's Connect" long after the page was rewritten).
  it.each(routes.map((route) => [route.path, route] as const))(
    '%s prerenders the h1 and intro its page renders',
    (_path, route) => {
      const source = readFileSync(route.source, 'utf8');
      // LegalPageLayout renders its `title` prop as the h1, so for the pages
      // that use it (the ones with titleInSource) the prop is the heading.
      const layoutTitle = route.titleInSource?.match(/title="([^"]+)"/)?.[1];
      const rendered = layoutTitle ? [...headings(source), layoutTitle] : headings(source);
      expect(rendered).toContain(route.h1);
      expect(jsxText(source)).toContain(jsxText(route.intro));
    }
  );

  it.each(routes.map((route) => [route.path] as const))('%s is a route in App.tsx', (path) => {
    expect(appSource).toContain(`path="${path}"`);
  });
});
