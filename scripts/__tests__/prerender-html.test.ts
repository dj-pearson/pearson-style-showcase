import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { truncateDescription } from '@/lib/seo';
import { PRERENDER_NAV } from '@/lib/prerender-classes';
import {
  applyBody,
  applyHead,
  applyModulePreloads,
  applyPrerenderData,
  buildFeed,
  notFoundHtml,
  spaShellHtml,
  // @ts-expect-error - plain .mjs helper shared with the build scripts, no types
} from '../lib/html.mjs';
// @ts-expect-error - plain .mjs helper shared with the build scripts, no types
import { NAV_LINKS, FOOTER_LINKS } from '../lib/static-routes.mjs';

const template = readFileSync('index.html', 'utf8');
const DEFAULT_IMAGE = { url: 'https://danpearson.net/og-default.png', width: 1200, height: 630 };
const ctx = {
  truncateDescription,
  author: 'Dan Pearson',
  defaultImage: DEFAULT_IMAGE,
  nav: PRERENDER_NAV,
  navLinks: NAV_LINKS,
  footerLinks: FOOTER_LINKS,
  year: 2026,
};

const doc = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const meta = (d: Document, attr: string, name: string) =>
  d.querySelector(`meta[${attr}="${name}"]`)?.getAttribute('content');

describe('applyHead', () => {
  it('inserts a $ in the title and description as text, not a replacement pattern', () => {
    // String.prototype.replace reads $&, $1, $` and $' in a replacement
    // string; "$600K+" must not pull in the matched <title> or the text
    // around it.
    const title = "Recovered $600K+ with $& and $1 and $` and $'";
    const html = applyHead(
      template,
      {
        title,
        description: 'Costs $$ less: $& stays',
        url: 'https://danpearson.net/x',
        path: '/x',
      },
      ctx
    );
    const d = doc(html);
    expect(d.title).toBe(title);
    expect(meta(d, 'property', 'og:title')).toBe(title);
    expect(meta(d, 'name', 'twitter:title')).toBe(title);
    expect(meta(d, 'name', 'description')).toBe('Costs $$ less: $& stays');
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it('sets the canonical and og:url, and escapes markup in the title', () => {
    const html = applyHead(
      template,
      {
        title: 'A <b>"quoted"</b> & title',
        description: 'd',
        url: 'https://danpearson.net/connect',
        path: '/connect',
      },
      ctx
    );
    const d = doc(html);
    expect(d.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://danpearson.net/connect'
    );
    expect(meta(d, 'property', 'og:url')).toBe('https://danpearson.net/connect');
    expect(d.title).toBe('A <b>"quoted"</b> & title');
    expect(html).not.toContain('<b>"quoted"</b>');
  });

  it('keeps </script> in schema text from closing the JSON-LD block', () => {
    const html = applyHead(
      template,
      {
        title: 't',
        description: 'd',
        url: 'https://danpearson.net/a',
        path: '/a',
        schemas: [{ '@type': 'Article', headline: 'x</script><script>alert(1)</script>' }],
      },
      ctx
    );
    const d = doc(html);
    const blocks = d.querySelectorAll('script[type="application/ld+json"][data-prerendered]');
    expect(blocks).toHaveLength(1);
    const graph = JSON.parse(blocks[0].textContent || '');
    expect(graph['@graph'][0].headline).toBe('x</script><script>alert(1)</script>');
  });
});

describe('applyPrerenderData', () => {
  it('escapes </script> inside article content so the JSON block stays whole', () => {
    const page = applyBody(template, '<main><h1>Post</h1></main>', {}, ctx);
    const payload = { article: { content: 'before </script><script>alert(1)</script> after' } };
    const html = applyPrerenderData(page, payload, 'prerender-data');
    expect(html).not.toContain('</script><script>alert(1)');
    const d = doc(html);
    const block = d.getElementById('prerender-data');
    expect(block?.getAttribute('type')).toBe('application/json');
    expect(JSON.parse(block?.textContent || '')).toEqual(payload);
    // Outside #root, so React's first commit does not remove it.
    expect(d.getElementById('root')?.contains(block)).toBe(false);
  });

  it('anchors on the last </body>, not one inside the page body', () => {
    const page = applyBody(
      template,
      '<main><pre>&lt;/body&gt; </body> in copy</pre></main>',
      {},
      ctx
    );
    const html = applyPrerenderData(page, { a: 1 }, 'pd');
    expect(html.lastIndexOf('<script type="application/json" id="pd">')).toBeGreaterThan(
      html.indexOf('in copy')
    );
  });

  it('leaves the page alone with no payload', () => {
    expect(applyPrerenderData(template, null, 'pd')).toBe(template);
  });
});

describe('applyBody', () => {
  it('wraps the body in header and footer links inside #root', () => {
    const d = doc(applyBody(template, '<main><h1>Hello $&</h1></main>', {}, ctx));
    const root = d.getElementById('root');
    expect(root?.querySelector('h1')?.textContent).toBe('Hello $&');
    expect(root?.querySelector('header nav a[href="/about"]')).not.toBeNull();
    expect(root?.querySelector('footer')?.textContent).toContain('2026 Dan Pearson');
  });
});

describe('notFoundHtml', () => {
  const d = doc(notFoundHtml(template, ctx));

  it('is noindex with no canonical and no og:url', () => {
    expect(meta(d, 'name', 'robots')).toBe('noindex, follow');
    expect(d.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
    expect(d.querySelector('link[rel="canonical"]')).toBeNull();
    expect(d.querySelector('meta[property="og:url"]')).toBeNull();
  });

  it('says the page was not found, before JavaScript', () => {
    expect(d.title).toBe('404 - Page Not Found | Dan Pearson');
    expect(d.querySelector('#root h1')?.textContent).toBe('Page not found');
  });
});

describe('spaShellHtml', () => {
  it('drops the home canonical and og:url but keeps the default image', () => {
    const d = doc(spaShellHtml(template, ctx));
    expect(d.querySelector('link[rel="canonical"]')).toBeNull();
    expect(d.querySelector('meta[property="og:url"]')).toBeNull();
    expect(meta(d, 'property', 'og:image')).toBe(DEFAULT_IMAGE.url);
    expect(meta(d, 'property', 'og:image:width')).toBe('1200');
  });
});

describe('applyModulePreloads', () => {
  it('adds each chunk once and skips ones the head already loads', () => {
    const head = '<head>\n  <script type="module" src="/assets/index-abc.js"></script>\n  </head>';
    const html = applyModulePreloads(head, [
      'assets/index-abc.js',
      'assets/Article-1.js',
      'assets/Article-1.js',
    ]);
    expect(html.match(/rel="modulepreload"/g)).toHaveLength(1);
    expect(html).toContain('<link rel="modulepreload" crossorigin href="/assets/Article-1.js">');
  });
});

describe('buildFeed', () => {
  const feedPage = (over: Record<string, unknown>) => ({
    path: '/news/a',
    feed: {
      title: 'A',
      author: 'Dan Pearson',
      description: 'd',
      category: 'CRM',
      tags: [],
      published_at: '2026-01-01',
      ...over,
    },
  });
  const options = {
    site: 'https://danpearson.net',
    title: 'Dan\'s <feed> & "news"',
    description: 'AI & CRM',
    image: 'https://danpearson.net/android-chrome-512x512.png',
    author: 'Dan Pearson',
    limit: 50,
    now: new Date('2026-11-15T12:00:00Z'),
  };

  it('escapes XML special characters in titles, categories and descriptions', () => {
    const { xml, count } = buildFeed(
      [
        feedPage({
          title: 'Q&A: <Pipelines> "that" don\'t lie',
          description: 'Use [HubSpot & Salesforce](https://x.test) <now>',
          category: 'R&D',
          tags: ["Tom's <tag>"],
        }),
      ],
      options
    );
    expect(count).toBe(1);
    expect(xml).toContain(
      '<title>Q&amp;A: &lt;Pipelines&gt; &quot;that&quot; don&apos;t lie</title>'
    );
    expect(xml).toContain('<description>Use HubSpot &amp; Salesforce &lt;now&gt;</description>');
    expect(xml).toContain('<category>R&amp;D</category>');
    expect(xml).toContain('<category>Tom&apos;s &lt;tag&gt;</category>');
    expect(xml).toContain('<title>Dan&apos;s &lt;feed&gt; &amp; &quot;news&quot;</title>');

    // Well-formed: an XML parser accepts it and reads the text back unescaped.
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    expect(parsed.querySelector('parsererror')).toBeNull();
    expect(parsed.querySelector('item > title')?.textContent).toBe(
      'Q&A: <Pipelines> "that" don\'t lie'
    );
  });

  it('orders newest first, caps at the limit, and dates markdown posts at midday UTC', () => {
    const pages = [
      feedPage({ title: 'old', published_at: '2026-01-01' }),
      { path: '/about' },
      feedPage({ title: 'new', published_iso: '2026-03-01T08:30:00Z' }),
      feedPage({ title: 'mid', published_at: '2026-02-01' }),
    ];
    const { xml, count } = buildFeed(pages, { ...options, limit: 2 });
    expect(count).toBe(2);
    const titles = [...xml.matchAll(/<item>\s*<title>([^<]+)<\/title>/g)].map((m) => m[1]);
    expect(titles).toEqual(['new', 'mid']);
    expect(xml).toContain('<pubDate>Sun, 01 Feb 2026 12:00:00 GMT</pubDate>');
    expect(xml).toContain('<lastBuildDate>Sun, 15 Nov 2026 12:00:00 GMT</lastBuildDate>');
  });
});
