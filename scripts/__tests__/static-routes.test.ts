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
}

const routes: StaticRoute[] = STATIC_ROUTES;
const appSource = readFileSync('src/App.tsx', 'utf8');

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

  it.each(routes.map((route) => [route.path] as const))('%s is a route in App.tsx', (path) => {
    expect(appSource).toContain(`path="${path}"`);
  });
});
