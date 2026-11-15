#!/usr/bin/env node
/**
 * Prerenders static HTML for the routes that have to be legible without
 * JavaScript, and regenerates sitemap.xml.
 *
 * Why this exists: the site is a client-rendered SPA on Cloudflare Pages, so
 * every page ships as an empty <div id="root"> plus a bundle. Googlebot renders
 * JavaScript eventually; the AI crawlers this site is explicitly courting
 * (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, CCBot - all allowed in
 * robots.txt) largely do not. Injecting JSON-LD from React therefore publishes
 * it to nobody. Prerendering puts the copy and the schema in the initial HTML
 * response, which is the only version those crawlers ever see.
 *
 * The output is not a second implementation of the site. It reads the same
 * markdown that seeds the database and the same src/lib/crm-automation.ts the
 * money page renders from, so the HTML a crawler reads and the page a human
 * reads come from one source. React replaces the prerendered markup on mount.
 *
 *   node scripts/prerender.mjs        # after `vite build`
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { marked } from 'marked';
import { transformSync, build } from 'esbuild';
import { readArticles, extractFaqs } from './lib/content.mjs';
import {
  fetchDbArticles,
  sanitizeArticleHtml,
  markAffiliateLinks,
  DbArticlesError,
} from './lib/db-articles.mjs';
import { STATIC_ROUTES, NAV_LINKS, FOOTER_LINKS } from './lib/static-routes.mjs';

const DIST = 'dist';
const SITE = 'https://danpearson.net';
// The square icon stays the feed's channel image. Social cards and article
// schema images get og-default.png: summary_large_image wants roughly 1.91:1,
// and a 512x512 icon is cropped to a sliver in every link preview.
const IMAGE = `${SITE}/android-chrome-512x512.png`;
const OG_IMAGE = { url: `${SITE}/og-default.png`, width: 1200, height: 630 };
const AUTHOR = 'Dan Pearson';
const FEED_TITLE = 'Dan Pearson - AI CRM Automation and AI News';
const FEED_DESCRIPTION =
  'Field notes and teardowns on AI CRM automation, plus a daily brief on the AI news that matters to businesses.';
const FEED_LIMIT = 50;
const NEWS_CATEGORY = 'AI News';

marked.setOptions({ gfm: true, breaks: false });

/**
 * Loads the canonical CRM content module. It is TypeScript with no imports, so
 * esbuild (already present as a Vite dependency) can transpile it in memory
 * rather than duplicating the framework, tiers and FAQs into this script.
 */
async function loadTsModule(file) {
  const source = readFileSync(file, 'utf8');
  const { code } = transformSync(source, { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const loadCrmData = () => loadTsModule('src/lib/crm-automation.ts');

/**
 * Loads src/lib/prerenderData.ts (key builders, the static-article row shape,
 * the topic-hub selection) plus findStaticArticle, so the data embedded for
 * React's first render is built by the same code the pages run. Bundled rather
 * than transpiled because it imports static-articles.ts; the Supabase client
 * and logger those pull in are stubbed, since nothing here calls them.
 */
async function loadPrerenderHelpers() {
  const stubs = {
    '@/integrations/supabase/client': 'export const supabase = {};',
    '@/lib/logger':
      'const noop = () => {}; export const logger = { error: noop, warn: noop, info: noop, log: noop, debug: noop };',
  };
  const result = await build({
    stdin: {
      contents: [
        "export * from '@/lib/prerenderData';",
        "export { findStaticArticle } from '@/content/crm-articles.generated';",
      ].join('\n'),
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    logLevel: 'silent',
    plugins: [
      {
        name: 'src-alias',
        setup(b) {
          b.onResolve({ filter: /^@\// }, (args) =>
            stubs[args.path]
              ? { path: args.path, namespace: 'stub' }
              : { path: `${resolve('src', args.path.slice(2))}.ts` }
          );
          b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
            contents: stubs[args.path],
            loader: 'js',
          }));
        },
      },
    ],
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * XML text escaping. Unlike escapeHtml this also escapes the apostrophe, which
 * matters inside XML attribute values, and it is deliberately kept separate so
 * a change made for HTML cannot silently produce an invalid feed.
 */
const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Markdown link syntax stripped back to plain text, for schema string fields. */
const plainText = (value) =>
  String(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Class strings shared with the React components; see src/lib/prerender-classes.ts. */
const UI = await loadTsModule('src/lib/prerender-classes.ts');

/** Lucide icons as static SVG, with the attributes lucide-react renders. */
const ICONS = {
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  house:
    '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  calendar:
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name, className) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">${ICONS[name]}</svg>`;

// --- head rewriting -------------------------------------------------------

// Every replacement below goes through a function, so a `$` in copy ("$600K+
// monthly") is inserted as text rather than read as a replacement pattern.
const beforeHeadClose = (html, markup) => html.replace('</head>', () => `    ${markup}\n  </head>`);

function setTag(html, attr, name, content) {
  const pattern = new RegExp(`<meta\\s+${attr}="${name}"[^>]*>`, 'i');
  const tag = `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`;
  return pattern.test(html) ? html.replace(pattern, () => tag) : beforeHeadClose(html, tag);
}

function removeTag(html, attr, name) {
  return html.replace(new RegExp(`[ \\t]*<meta\\s+${attr}="${name}"[^>]*>\\n?`, 'gi'), '');
}

/**
 * Rewrites the template head for one route.
 *
 * `url: null` drops the canonical and og:url rather than leaving them on the
 * home page: the 404 page and the SPA shell have no URL of their own. `image`
 * is { url, width?, height? }, and the dimensions are only emitted when known,
 * so an article's own image never claims to be 1200x630. The description is
 * cut the way SEO.tsx cuts it, so the head does not change when React mounts.
 */
function applyHead(
  template,
  { title, description, url, path, type = 'website', schemas, image = OG_IMAGE, article, noIndex }
) {
  let html = template;
  const summary = seo.truncateDescription(description, 160);

  html = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(title)}</title>`);
  if (url) {
    html = html.replace(
      /<link\s+rel="canonical"[^>]*>/i,
      () => `<link rel="canonical" href="${escapeHtml(url)}" />`
    );
    html = setTag(html, 'property', 'og:url', url);
  } else {
    html = html.replace(/[ \t]*<link\s+rel="canonical"[^>]*>\n?/i, '');
    html = removeTag(html, 'property', 'og:url');
  }

  html = setTag(html, 'name', 'description', summary);
  if (noIndex) html = setTag(html, 'name', 'robots', 'noindex, follow');
  html = setTag(html, 'property', 'og:title', title);
  html = setTag(html, 'property', 'og:description', summary);
  html = setTag(html, 'property', 'og:type', type);
  html = setTag(html, 'property', 'og:locale', 'en_US');
  html = setTag(html, 'property', 'og:image', image.url);
  html = removeTag(html, 'property', 'og:image:width');
  html = removeTag(html, 'property', 'og:image:height');
  if (image.width && image.height) {
    html = setTag(html, 'property', 'og:image:width', String(image.width));
    html = setTag(html, 'property', 'og:image:height', String(image.height));
  }
  html = setTag(html, 'name', 'twitter:title', title);
  html = setTag(html, 'name', 'twitter:description', summary);
  html = setTag(html, 'name', 'twitter:image', image.url);

  if (article) {
    const tags = [
      article.published && ['article:published_time', article.published],
      article.modified && ['article:modified_time', article.modified],
      article.section && ['article:section', article.section],
      ['article:author', AUTHOR],
      // article:tag repeats, one element per tag.
      ...[...new Set(article.tags || [])].map((tag) => ['article:tag', tag]),
    ].filter(Boolean);
    for (const [property, content] of tags) {
      html = beforeHeadClose(
        html,
        `<meta property="${property}" content="${escapeHtml(content)}" />`
      );
    }
  }

  if (!schemas || schemas.length === 0) return html;

  // One graph per page rather than several loose blocks: a single @graph is
  // easier for parsers to resolve @id references across. data-prerendered and
  // data-path let StructuredData.tsx skip the types this graph already holds,
  // and drop the graph once the visitor navigates to a different route.
  const graph = JSON.stringify(
    { '@context': 'https://schema.org', '@graph': schemas },
    null,
    2
  ).replace(/</g, '\\u003c');

  return beforeHeadClose(
    html,
    `<script type="application/ld+json" data-prerendered data-path="${escapeHtml(path)}">\n${graph}\n    </script>`
  );
}

const linkList = (links) =>
  links.map(({ href, label }) => `<a href="${href}">${escapeHtml(label)}</a>`).join('\n        ');

/**
 * The page body between a header and footer of plain links. Without them a
 * prerendered page linked out only through its own copy, so a crawler that
 * does not run JavaScript had no path from an article to /about, /projects or
 * /connect. React replaces all of it on mount, with the rest of #root.
 *
 * `matched` pages (home, articles) lay their body out with the React page's
 * classes. Their header is fixed like Navigation.tsx, so it takes no space in
 * the flow and the body sits exactly where React will put it. Other pages
 * keep the plain in-flow header their unstyled body expects.
 */
function applyBody(html, body, { matched = false } = {}) {
  const header = matched
    ? `
    <header class="${UI.PRERENDER_NAV.bar}">
      <div class="${UI.PRERENDER_NAV.container}">
        <div class="${UI.PRERENDER_NAV.row}">
          <a href="/" class="${UI.PRERENDER_NAV.logo}">${AUTHOR}</a>
          <nav aria-label="Site" class="${UI.PRERENDER_NAV.links}">
            ${NAV_LINKS.map(
              ({ href, label }) =>
                `<a href="${href}" class="${UI.PRERENDER_NAV.link}">${escapeHtml(label)}</a>`
            ).join('\n            ')}
          </nav>
        </div>
      </div>
    </header>`
    : `
    <header>
      <nav aria-label="Site">
        ${linkList(NAV_LINKS)}
      </nav>
    </header>`;
  const chrome = `${header}${body}
    <footer>
      <nav aria-label="Legal">
        ${linkList(FOOTER_LINKS)}
      </nav>
      <p>&copy; ${new Date().getFullYear()} ${AUTHOR} &middot; Pearson Media LLC</p>
    </footer>
  `;
  return html.replace(/<div id="root"><\/div>/, () => `<div id="root">${chrome}</div>`);
}

/**
 * Embeds the page's query data for src/lib/prerenderData.ts to hand to
 * react-query as initialData. Outside #root so React's first commit cannot
 * remove it before the page reads it. `<` is escaped so a `</script>` inside
 * article content cannot close the block; a non-JavaScript type never
 * executes, so CSP's script-src does not apply.
 */
function applyPrerenderData(html, payload, id) {
  if (!payload) return html;
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  // The last </body>, so nothing an article body contains can be matched first.
  const at = html.lastIndexOf('</body>');
  if (at === -1) return html;
  const block = `  <script type="application/json" id="${id}">${json}</script>\n  `;
  return html.slice(0, at) + block + html.slice(at);
}

// --- route chunk preloading ----------------------------------------------

/**
 * Maps each prerendered path to the source file of the page that renders it,
 * read from src/lib/routeComponents.ts (PRERENDERED_ROUTES for the path
 * pattern, routeComponents for the lazy import behind each name) so this stays
 * in step with what main.tsx preloads. '/' maps to the lazy Index chunk.
 */
function loadRouteSources() {
  const source = readFileSync('src/lib/routeComponents.ts', 'utf8');
  const files = new Map();
  for (const [, name, spec] of source.matchAll(
    /(\w+):\s*lazyWithPreload\(\(\)\s*=>\s*import\('@\/([^']+)'\)\)/g
  )) {
    const file = ['.tsx', '.ts'].map((ext) => `src/${spec}${ext}`).find((f) => existsSync(f));
    if (file) files.set(name, file);
  }
  const routes = [];
  for (const [, pattern, flags, name] of source.matchAll(
    /\[\s*\/(.+)\/([a-z]*)\s*,\s*'(\w+)'\s*\]/g
  )) {
    if (files.has(name)) routes.push([new RegExp(pattern, flags), files.get(name)]);
  }
  if (routes.length === 0) {
    console.warn('prerender: no PRERENDERED_ROUTES parsed from src/lib/routeComponents.ts');
  }
  return (path) => routes.find(([re]) => re.test(path))?.[1];
}

/**
 * Vite's build manifest (build.manifest in vite.config.ts). Read once, then
 * removed so dist/.vite is not deployed; a rerun of this script alone, without
 * `vite build`, therefore skips the preload links with a warning.
 */
function loadManifest() {
  const manifestPath = join(DIST, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.warn('prerender: dist/.vite/manifest.json not found; route chunks not preloaded');
    return null;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  rmSync(join(DIST, '.vite'), { recursive: true, force: true });
  return manifest;
}

/** The page chunk for a source file plus every chunk it statically imports. */
function chunkFiles(manifest, sourceFile) {
  const files = [];
  const seen = new Set();
  const visit = (key) => {
    if (seen.has(key) || !manifest[key]) return;
    seen.add(key);
    files.push(manifest[key].file);
    for (const dep of manifest[key].imports || []) visit(dep);
  };
  visit(sourceFile);
  return files;
}

/**
 * Adds <link rel="modulepreload"> for the route's page chunk and its static
 * imports. Without them the browser only finds the page chunk (and, for an
 * article, markdown-vendor) once the entry has run. Assets the head already
 * loads are skipped. `crossorigin` matches the entry script's, or the preload
 * would not be reused by the module fetch.
 */
function applyModulePreloads(html, files) {
  if (!files || files.length === 0) return html;
  const links = [...new Set(files)]
    .map((file) => `/${file}`)
    .filter((href) => !html.includes(`"${href}"`))
    .map((href) => `    <link rel="modulepreload" crossorigin href="${href}">\n`)
    .join('');
  return links ? html.replace(/[ \t]*<\/head>/, (head) => `${links}${head}`) : html;
}

// --- schema builders ------------------------------------------------------

const PERSON = {
  '@type': 'Person',
  '@id': `${SITE}/#dan-pearson`,
  name: AUTHOR,
  // /about is the page that is about him; the home page is about the service.
  // No `image` yet: the headshot lives in the profile_settings table, not in
  // public/, so the build has no stable URL to give it.
  url: `${SITE}/about`,
  mainEntityOfPage: { '@id': `${SITE}/about#profile` },
  jobTitle: 'AI CRM Automation Consultant',
  description:
    'AI CRM automation consultant for revenue teams under 50 seats. Builds capture-layer automation so sellers stop doing data entry and the pipeline stops lying.',
  knowsAbout: [
    'AI CRM automation',
    'CRM data quality',
    'capture-layer automation',
    'agentic CRM',
    'RevOps',
    'sales automation',
    'HubSpot automation',
    'Salesforce automation',
    'pipeline forecasting',
  ],
  sameAs: ['https://linkedin.com/in/danpearson', 'https://github.com/dj-pearson'],
  worksFor: { '@type': 'Organization', name: 'Pearson Media LLC' },
};

const breadcrumb = (trail) => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: `${SITE}${item.path}`,
  })),
});

const faqPage = (faqs) => ({
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ question, answer }) => ({
    '@type': 'Question',
    name: plainText(question),
    acceptedAnswer: { '@type': 'Answer', text: plainText(answer) },
  })),
});

// --- page builders --------------------------------------------------------

const isCrm = (meta) => meta.source !== 'database' || meta.category === 'CRM';
const categoryPath = (category) => `/news/category/${encodeURIComponent(category)}`;
const absoluteImage = (src) => (/^https:\/\//.test(src || '') ? src : OG_IMAGE.url);

/** Article.tsx's formatDate: the visitor's locale settings, en-US. */
const formatArticleDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * The article page in Article.tsx's layout: the same wrappers, breadcrumbs and
 * header classes, filled from the row React's first render reads (the
 * embedded query data), so the title and lead paint where React draws them.
 * Below the header it is the rendered body; React's image, takeaways and
 * table of contents are not reproduced.
 */
function articleShell(meta, row, html, related) {
  const A = UI.ARTICLE_LAYOUT;
  const H = UI.ARTICLE_HEADER;
  const B = UI.ARTICLE_BADGES;
  const title = row?.title || meta.title;
  const excerpt = row?.excerpt ?? meta.excerpt;
  const category = row?.category || meta.category;
  const created = row?.created_at || isoDate(meta.published_iso || meta.published_at);
  const updated = row ? row.updated_at : undefined;
  const tags = (row ? row.tags : meta.tags) || [];
  const crumbs = [
    { label: 'Home', path: '/' },
    { label: 'News', path: '/news' },
    { label: title, path: `/news/${meta.slug}` },
  ];

  const crumbItems = crumbs
    .map(({ label, path }, index) => {
      const separator = index > 0 ? icon('chevronRight', A.breadcrumbSeparator) : '';
      const inner =
        index === crumbs.length - 1
          ? `<span class="${A.breadcrumbCurrent}" aria-current="page">${escapeHtml(label)}</span>`
          : `<a href="${path}" class="${A.breadcrumbLink}">${index === 0 ? icon('house', A.breadcrumbIcon) : ''}<span>${escapeHtml(label)}</span></a>`;
      return `<li class="${A.breadcrumbItem}">${separator}${inner}</li>`;
    })
    .join('');

  const metaItems = [
    `<div class="${H.metaItem}">${icon('calendar', H.metaIcon)}<time datetime="${escapeHtml(created)}"><span class="sr-only">Published on </span>${escapeHtml(formatArticleDate(created))}</time></div>`,
    updated && updated !== created
      ? `<div class="${H.metaItem}"><span class="${H.metaLabel}">Updated:</span><time datetime="${escapeHtml(updated)}">${escapeHtml(formatArticleDate(updated))}</time></div>`
      : '',
    `<div class="${H.metaItem}">${icon('clock', H.metaIcon)}<span><span class="sr-only">Reading time: </span>${escapeHtml(row?.read_time ?? meta.read_time ?? '')}</span></div>`,
    `<div class="${H.metaItem}">${icon('eye', H.metaIcon)}<span><span class="sr-only">Article has </span>${Number(row?.view_count) || 0} views</span></div>`,
    `<div><span>By <span>${escapeHtml(row?.author || meta.author || AUTHOR)}</span></span></div>`,
  ].join('');

  return `
    <div class="${A.root}">
      <main id="main-content" class="${A.main}">
        <div class="${A.container}">
          <div class="${A.breadcrumbsWrap}">
            <nav aria-label="Breadcrumb" class="${A.breadcrumbs}">
              <ol class="${A.breadcrumbList}">${crumbItems}</ol>
            </nav>
          </div>
          <article class="${A.article}">
            <header class="${H.header}">
              <div class="${H.badges}">
                <div class="${B.category}">${escapeHtml(category)}</div>${(row ? row.featured : meta.featured) ? `<div class="${B.featured}">Featured</div>` : ''}
              </div>
              <h1 class="${H.title}">${escapeHtml(title)}</h1>
              <p class="${H.lead}">${escapeHtml(excerpt)}</p>
              <div class="${H.meta}">${metaItems}</div>${
                tags.length
                  ? `
              <div class="${H.badges}">${tags.map((tag) => `<div class="${B.tag}">${escapeHtml(tag)}</div>`).join('')}</div>`
                  : ''
              }
            </header>
            <div class="${A.body}">
              ${html}
            </div>
            <nav aria-label="Related">
              ${related}
            </nav>
          </article>
        </div>
      </main>
    </div>`;
}

function articlePage({ meta, body }, row) {
  const url = `${SITE}/news/${meta.slug}`;
  const faqs = extractFaqs(body);
  const isNews = meta.category === NEWS_CATEGORY;
  const crm = isCrm(meta);

  const schemas = [
    {
      // NewsArticle for the daily brief makes it eligible for Top Stories and
      // tells assistants it is time-bound reporting, not an evergreen guide.
      '@type': isNews ? 'NewsArticle' : 'Article',
      '@id': `${url}#article`,
      headline: meta.title,
      description: meta.seo_description || meta.excerpt,
      abstract: plainText(meta.excerpt),
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      author: { '@id': `${SITE}/#dan-pearson` },
      publisher: { '@id': `${SITE}/#dan-pearson` },
      image: absoluteImage(meta.image_url),
      datePublished: meta.published_iso || meta.published_at,
      dateModified: meta.updated_at || meta.published_at,
      articleSection: meta.category,
      keywords: (meta.seo_keywords || []).join(', '),
      about: plainText(meta.target_keyword || meta.category),
      inLanguage: 'en',
      isAccessibleForFree: true,
    },
    PERSON,
    breadcrumb([
      { name: 'Home', path: '/' },
      { name: 'News', path: '/news' },
      crm
        ? { name: 'AI CRM Automation', path: '/topics/ai-crm-automation' }
        : { name: meta.category, path: categoryPath(meta.category) },
      { name: meta.title, path: `/news/${meta.slug}` },
    ]),
  ];

  if (faqs.length) schemas.push(faqPage(faqs));

  // Database bodies were written by a model, and older ones are raw HTML, so
  // they are sanitized before they reach a static file. The markdown in
  // content/ is reviewed in git and rendered as-is.
  const rendered = marked.parse(body);
  const html =
    meta.source === 'database' ? markAffiliateLinks(sanitizeArticleHtml(rendered)) : rendered;

  const related = crm
    ? `<a href="/topics/ai-crm-automation">All AI CRM automation writing</a>
        <a href="/ai-crm-automation">CRM automation services and the 12-point audit</a>`
    : `<a href="${categoryPath(meta.category)}">More ${escapeHtml(meta.category)}</a>
        <a href="/ai-crm-automation">AI CRM automation consulting</a>`;

  const content = articleShell(meta, row, html, related);

  return {
    path: `/news/${meta.slug}`,
    title: `${meta.seo_title || meta.title} | ${AUTHOR}`,
    description: meta.seo_description || meta.excerpt,
    type: 'article',
    schemas,
    content,
    lastmod: meta.updated_at || meta.published_at,
    feed: {
      title: meta.title,
      description: meta.excerpt,
      category: meta.category,
      tags: meta.tags,
      author: meta.author,
      published_at: meta.published_at,
      published_iso: meta.published_iso,
    },
    news: isNews
      ? { title: meta.title, published_iso: meta.published_iso || `${meta.published_at}T12:00:00Z` }
      : null,
    sitemap: crm
      ? { priority: meta.featured ? '0.9' : '0.8', changefreq: 'monthly' }
      : { priority: isNews ? '0.6' : '0.5', changefreq: 'monthly' },
    // The article's own image when it has an absolute one, size unknown; the
    // default card otherwise.
    image: /^https:\/\//.test(meta.image_url || '') ? { url: meta.image_url } : OG_IMAGE,
    article: {
      published: isoDate(meta.published_iso || meta.published_at),
      modified: isoDate(meta.updated_at || meta.published_at),
      section: meta.category,
      tags: meta.tags,
    },
    archive: { category: meta.category, tags: meta.tags || [] },
    matched: true,
  };
}

/** Markdown front matter carries a bare date; OG wants a full ISO 8601 time. */
function isoDate(value) {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
}

function moneyPage(crm, articles) {
  const url = `${SITE}/ai-crm-automation`;

  const schemas = [
    {
      '@type': 'ProfessionalService',
      '@id': `${url}#service`,
      name: 'AI CRM Automation Consulting',
      url,
      description: crm.POSITIONING_STATEMENT,
      provider: { '@id': `${SITE}/#dan-pearson` },
      areaServed: 'US',
      serviceType: 'AI CRM automation consulting',
      audience: {
        '@type': 'BusinessAudience',
        name: 'Revenue teams under 50 seats',
      },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'CRM automation engagements',
        // Only the audit carries a number, matching the comment on SERVICE_TIERS:
        // a published price is what makes the offer quotable by an assistant,
        // and the other tiers genuinely cannot be priced before the audit.
        itemListElement: crm.SERVICE_TIERS.map((tier) => ({
          '@type': 'Offer',
          name: tier.name,
          category: tier.tier,
          description: plainText(tier.description),
          eligibleDuration: tier.duration,
          ...(tier.priceMin
            ? {
                priceSpecification: {
                  '@type': 'PriceSpecification',
                  price: tier.priceMin,
                  priceCurrency: 'USD',
                  valueAddedTaxIncluded: false,
                },
              }
            : {
                priceSpecification: { '@type': 'PriceSpecification', description: tier.priceLabel },
              }),
        })),
      },
    },
    {
      '@type': 'ItemList',
      '@id': `${url}#pipeline-automation-ladder`,
      name: 'The Pipeline Automation Ladder',
      description:
        'A five-rung maturity model for CRM automation. The load-bearing rule is that rung 2, assisted capture, cannot be skipped.',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: crm.PIPELINE_AUTOMATION_LADDER.length,
      itemListElement: crm.PIPELINE_AUTOMATION_LADDER.map((rung, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: `Rung ${rung.rung}: ${rung.name}`,
        description: plainText(rung.reality),
      })),
    },
    {
      '@type': 'HowTo',
      '@id': `${url}#audit`,
      name: 'The 12-Point CRM Automation Audit',
      description:
        'The twelve checks used to score a revenue team on the Pipeline Automation Ladder, grouped into capture, data, flow and trust.',
      step: crm.AUDIT_CHECKS.map((check, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: `${check.group}: ${check.name}`,
        text: plainText(check.question),
      })),
    },
    PERSON,
    faqPage(crm.CRM_FAQS.map((faq) => ({ question: faq.question, answer: faq.answer }))),
    breadcrumb([
      { name: 'Home', path: '/' },
      { name: 'AI CRM Automation', path: '/ai-crm-automation' },
    ]),
  ];

  const content = `
    <main>
      <h1>AI CRM Automation Consulting</h1>
      <p><strong>${escapeHtml(crm.POSITIONING_STATEMENT)}</strong></p>
      <p>${escapeHtml(crm.THESIS)}</p>

      <h2>The Pipeline Automation Ladder</h2>
      <ol>
        ${crm.PIPELINE_AUTOMATION_LADDER.map(
          (rung) =>
            `<li><h3>Rung ${rung.rung}: ${escapeHtml(rung.name)}</h3><p>${escapeHtml(rung.reality)}</p><p>${escapeHtml(rung.failure)}</p></li>`
        ).join('\n        ')}
      </ol>

      <h2>The 12-Point CRM Automation Audit</h2>
      <ol>
        ${crm.AUDIT_CHECKS.map(
          (check) =>
            `<li><strong>${escapeHtml(check.group)} &mdash; ${escapeHtml(check.name)}:</strong> ${escapeHtml(check.question)}</li>`
        ).join('\n        ')}
      </ol>

      <h2>Frequently asked questions</h2>
      <dl>
        ${crm.CRM_FAQS.map(
          (faq) => `<dt>${escapeHtml(faq.question)}</dt><dd>${escapeHtml(faq.answer)}</dd>`
        ).join('\n        ')}
      </dl>

      <h2>Writing on AI CRM automation</h2>
      <ul>
        ${articles
          .map(
            ({ meta }) =>
              `<li><a href="/news/${meta.slug}">${escapeHtml(meta.title)}</a> &mdash; ${escapeHtml(meta.excerpt)}</li>`
          )
          .join('\n        ')}
      </ul>
    </main>`;

  return {
    path: '/ai-crm-automation',
    title: 'AI CRM Automation Consultant | Dan Pearson',
    description:
      'AI CRM automation for revenue teams under 50 seats. The Pipeline Automation Ladder, the 12-point audit and published pricing, from a consultant who carried a quota before writing the automation.',
    schemas,
    content,
    sitemap: { priority: '0.9', changefreq: 'weekly' },
  };
}

function homePage(crm, articles) {
  const schemas = [
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      url: SITE,
      name: AUTHOR,
      description: crm.POSITIONING_STATEMENT,
      publisher: { '@id': `${SITE}/#dan-pearson` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/search?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    PERSON,
    breadcrumb([{ name: 'Home', path: '/' }]),
  ];

  const L = UI.INDEX_LAYOUT;
  const H = UI.HERO_CLASSES;
  const S = UI.HERO_SHADOWS;
  const C = UI.HERO_COPY;
  const shadow = (value) => `style="text-shadow: ${value}"`;
  const featured = articles
    .filter(({ meta }) => meta.featured)
    .map(
      ({ meta }) =>
        `<li><a href="/news/${meta.slug}" class="${L.sectionLink}">${escapeHtml(meta.title)}</a></li>`
    )
    .join('\n                ');

  // HeroSection.tsx inside Index.tsx's wrappers, from the same class strings
  // and copy, so the first paint is the element React draws (see
  // src/lib/prerender-classes.ts). The positioning copy and the start-here
  // links follow below the fold for crawlers.
  const content = `
    <div class="${L.root}">
      <div class="${L.backdrop}" aria-hidden="true"><div class="${L.backdropGradient}"></div></div>
      <main id="main-content" class="${L.main}">
        <div class="${L.heroWrap}">
          <section class="${H.section}" ${UI.PRERENDERED_HERO_ATTR}>
            <div class="${H.content}">
              <h1 class="${H.title}"><span class="${H.nameWrapper}"><span class="${H.firstName}" ${shadow(S.firstName)}>${C.firstName}</span></span> <span class="${H.nameWrapper}"><span class="${H.lastName}" ${shadow(S.lastName)}>${C.lastName}</span></span></h1>
              <div class="${H.subtitleWrap}">
                <p class="${H.subtitle}" ${shadow(S.subtitle)}>${escapeHtml(C.subtitle)}</p>
              </div>
              <div class="${H.descWrap}">
                <p class="${H.desc}" ${shadow(S.desc)}>${escapeHtml(C.desc)}<br><span class="${H.descEmphasis}" ${shadow(S.descEmphasis)}>${escapeHtml(C.descEmphasis)}</span></p>
              </div>
              <div class="${H.ctaRow}">
                <a href="${C.ctaPrimary.href}" class="${H.ctaPrimary}" style="box-shadow: ${S.ctaPrimary}">${escapeHtml(C.ctaPrimary.label)}${icon('arrowRight', H.ctaPrimaryIcon)}</a>
                <a href="${C.ctaSecondary.href}" class="${H.ctaSecondary}">${escapeHtml(C.ctaSecondary.label)}</a>
              </div>
              <div class="${H.scrollHint}" aria-hidden="true">
                <span class="${H.scrollHintLabel}">Scroll</span>
                <div class="${H.scrollHintBar}"></div>
              </div>
            </div>
            ${H.dots
              .map(
                (className, index) =>
                  `<div class="${className}" aria-hidden="true"${H.dotDelays[index] ? ` style="animation-delay: ${H.dotDelays[index]}"` : ''}></div>`
              )
              .join('\n            ')}
          </section>
        </div>
        <section class="${L.section}">
          <div class="${L.sectionInner}">
            <h2 class="${L.sectionHeading}">AI CRM automation consultant</h2>
            <p class="${L.sectionLead}">${escapeHtml(crm.POSITIONING_STATEMENT)}</p>
            <p class="${L.sectionBody}">${escapeHtml(crm.THESIS)}</p>
            <h2 class="${L.sectionHeading}">Start here</h2>
            <ul class="${L.sectionList}">
              <li><a href="/ai-crm-automation" class="${L.sectionLink}">AI CRM automation consulting, the 12-point audit and pricing</a></li>
              <li><a href="/topics/ai-crm-automation" class="${L.sectionLink}">Research and teardowns on AI CRM automation</a></li>
              ${featured}
            </ul>
          </div>
        </section>
      </main>
    </div>`;

  return {
    path: '/',
    title: 'Dan Pearson - AI CRM Automation Consultant',
    description: crm.POSITIONING_STATEMENT,
    schemas,
    content,
    sitemap: { priority: '1.0', changefreq: 'weekly' },
    matched: true,
  };
}

function hubPage(articles) {
  const url = `${SITE}/topics/ai-crm-automation`;

  const schemas = [
    {
      '@type': 'CollectionPage',
      '@id': `${url}#collection`,
      url,
      name: 'AI CRM Automation',
      description:
        'Research, teardowns and field notes on making the CRM run itself: capture-layer automation, agentic workflows, and why most AI CRM projects fail before they start.',
      isPartOf: { '@id': `${SITE}/#website` },
      about: { '@id': `${SITE}/#dan-pearson` },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: articles.length,
        itemListElement: articles.map(({ meta }, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${SITE}/news/${meta.slug}`,
          name: meta.title,
        })),
      },
    },
    PERSON,
    breadcrumb([
      { name: 'Home', path: '/' },
      { name: 'Topics', path: '/topics' },
      { name: 'AI CRM Automation', path: '/topics/ai-crm-automation' },
    ]),
  ];

  const content = `
    <main>
      <h1>AI CRM Automation</h1>
      <p>Research, teardowns and field notes on making the CRM run itself.</p>
      <ul>
        ${articles
          .map(
            ({ meta }) =>
              `<li><h2><a href="/news/${meta.slug}">${escapeHtml(meta.title)}</a></h2><p>${escapeHtml(meta.excerpt)}</p></li>`
          )
          .join('\n        ')}
      </ul>
      <p><a href="/ai-crm-automation">CRM automation services and the 12-point audit</a></p>
    </main>`;

  return {
    path: '/topics/ai-crm-automation',
    title: 'AI CRM Automation: Guides, Teardowns and Field Notes | Dan Pearson',
    description:
      'Every piece of writing on AI CRM automation in one place: capture-layer automation, the Pipeline Automation Ladder, platform comparisons and what CRM automation actually costs.',
    schemas,
    content,
    sitemap: { priority: '0.8', changefreq: 'weekly' },
  };
}

/**
 * The other topic hubs in TOPIC_HUBS. Title and description follow
 * TopicHub.tsx; the article list is the same selection the hub embeds as
 * prerender data, so the links here are the links React renders.
 */
function topicHubPage(topic, config, list) {
  const path = `/topics/${topic}`;
  const url = `${SITE}${path}`;

  const schemas = [
    {
      '@type': 'CollectionPage',
      '@id': `${url}#collection`,
      url,
      name: config.title,
      description: config.description,
      isPartOf: { '@id': `${SITE}/#website` },
      about: { '@id': `${SITE}/#dan-pearson` },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: list.length,
        itemListElement: list.map((article, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${SITE}/news/${article.slug}`,
          name: article.title,
        })),
      },
    },
    PERSON,
    breadcrumb([
      { name: 'Home', path: '/' },
      { name: 'Topics', path: '/topics' },
      { name: config.title, path },
    ]),
  ];

  const items = list.length
    ? `<ul>
        ${list
          .map(
            (article) =>
              `<li><h2><a href="/news/${article.slug}">${escapeHtml(article.title)}</a></h2>${article.excerpt ? `<p>${escapeHtml(plainText(article.excerpt))}</p>` : ''}</li>`
          )
          .join('\n        ')}
      </ul>`
    : `<p>No articles on this topic yet. <a href="/news">Browse all writing</a>.</p>`;

  const content = `
    <main>
      <h1>${escapeHtml(config.title)}</h1>
      <p>${escapeHtml(config.description)}</p>
      ${items}
      <p><a href="/topics">All topics</a></p>
    </main>`;

  return {
    path,
    title: `${config.title} - Complete Guide & Resources | ${AUTHOR}`,
    description: config.description,
    schemas,
    content,
    // A hub with nothing in it is a thin page; keep it out of the sitemap.
    sitemap: list.length ? { priority: '0.6', changefreq: 'weekly' } : null,
  };
}

/**
 * Extra body copy for the static routes whose page is mostly a list: real
 * links a crawler can follow, built from data the build already has.
 */
function staticRouteExtras(route, { articlePages, topicHubs }) {
  switch (route.path) {
    case '/news': {
      const latest = articlePages
        .filter((page) => page.feed)
        .sort((a, b) => String(b.article.published).localeCompare(String(a.article.published)))
        .slice(0, 30);
      return `<h2>Latest writing</h2>
      <ul>
        ${latest.map((page) => `<li><a href="${page.path}">${escapeHtml(page.feed.title)}</a></li>`).join('\n        ')}
      </ul>`;
    }
    case '/topics':
      return `<ul>
        ${Object.entries(topicHubs)
          .map(
            ([slug, hub]) =>
              `<li><h2><a href="/topics/${slug}">${escapeHtml(hub.title)}</a></h2><p>${escapeHtml(hub.description)}</p></li>`
          )
          .join('\n        ')}
      </ul>`;
    case '/about':
      return `<p>${escapeHtml(PERSON.description)}</p>
      <ul>
        <li><a href="/ai-crm-automation">AI CRM automation consulting and the 12-point audit</a></li>
        <li><a href="/projects">The SaaS platforms behind the CRM automation work</a></li>
        <li><a href="/connect">Book an audit or get in touch</a></li>
      </ul>`;
    case '/faq':
      return `<p><a href="/ai-crm-automation">Questions on AI CRM automation, answered on the services page</a></p>`;
    case '/connect':
      return `<p><a href="/ai-crm-automation">What the CRM automation audit covers and what it costs</a></p>`;
    default:
      return '';
  }
}

function staticPage(route, context) {
  const url = `${SITE}${route.path}`;
  const node = {
    '@type': route.schemaType,
    '@id': `${url}#${route.schemaType === 'ProfilePage' ? 'profile' : 'webpage'}`,
    url,
    name: route.title,
    description: route.description,
    isPartOf: { '@id': `${SITE}/#website` },
    inLanguage: 'en',
    ...(route.schemaType === 'ProfilePage'
      ? { mainEntity: { '@id': `${SITE}/#dan-pearson` } }
      : { about: { '@id': `${SITE}/#dan-pearson` } }),
  };

  const content = `
    <main>
      <h1>${escapeHtml(route.h1)}</h1>
      <p>${escapeHtml(route.intro)}</p>
      ${staticRouteExtras(route, context)}
    </main>`;

  return {
    path: route.path,
    title: route.title,
    description: route.description,
    schemas: [
      node,
      PERSON,
      breadcrumb([
        { name: 'Home', path: '/' },
        { name: route.crumb, path: route.path },
      ]),
    ],
    content,
    sitemap: route.sitemap,
  };
}

// --- 404 and the SPA shell -------------------------------------------------

/**
 * dist/404.html. Cloudflare Pages serves it, with a 404 status, for any path
 * that matches neither a file nor a rule in _redirects; its presence is also
 * what turns off Pages' "serve index.html for everything" SPA mode. The app
 * bundle is still in it, so a visitor on a URL the build did not know about
 * (an article published since the last deploy) still gets the React page.
 */
function writeNotFound(template) {
  const html = applyBody(
    applyHead(template, {
      title: `404 - Page Not Found | ${AUTHOR}`,
      description: "The page you're looking for doesn't exist.",
      url: null,
      noIndex: true,
    }),
    `
    <main>
      <h1>Page not found</h1>
      <p>There is nothing at this address. It may have moved, or the link may be wrong.</p>
      <p><a href="/">Go to the home page</a> or <a href="/news">browse the writing</a>.</p>
    </main>`
  );
  writeFileSync(join(DIST, '404.html'), html);
}

/**
 * dist/spa.html: the untouched app shell, for the client-only routes that
 * public/_redirects rewrites to /spa (search, archives, admin). Kept separate
 * from index.html, which now carries the home page's copy and schema. No
 * canonical: React sets the route's own on mount, and a crawler that does not
 * run JavaScript is better off with none than with the home page's.
 */
function writeSpaShell(template) {
  let html = template.replace(/[ \t]*<link\s+rel="canonical"[^>]*>\n?/i, '');
  html = removeTag(html, 'property', 'og:url');
  html = setTag(html, 'property', 'og:image', OG_IMAGE.url);
  html = setTag(html, 'property', 'og:image:width', String(OG_IMAGE.width));
  html = setTag(html, 'property', 'og:image:height', String(OG_IMAGE.height));
  html = setTag(html, 'name', 'twitter:image', OG_IMAGE.url);
  writeFileSync(join(DIST, 'spa.html'), html);
}

// --- sitemap --------------------------------------------------------------

/**
 * Category and tag archives with enough articles to be worth a crawl, at the
 * URLs CategoryArchive.tsx and TagArchive.tsx give as canonical: the category
 * as stored, and the tag lowercased with spaces turned into hyphens. A tag on
 * a single article is a one-link page, so tags need two.
 */
function archiveEntries(pages) {
  const categories = new Map();
  const tags = new Map();
  const bump = (map, key, lastmod) => {
    const entry = map.get(key) || { count: 0, lastmod: '' };
    entry.count += 1;
    if (lastmod && lastmod > entry.lastmod) entry.lastmod = lastmod;
    map.set(key, entry);
  };
  for (const page of pages) {
    if (!page.archive) continue;
    const lastmod = String(page.lastmod || '').slice(0, 10);
    if (page.archive.category) bump(categories, page.archive.category, lastmod);
    for (const tag of new Set(page.archive.tags.map((t) => t.toLowerCase().replace(/\s+/g, '-')))) {
      bump(tags, tag, lastmod);
    }
  }
  return [
    ...[...categories].map(([category, { lastmod }]) => ({
      loc: `${SITE}/news/category/${encodeURIComponent(category)}`,
      lastmod,
      changefreq: 'weekly',
      priority: '0.5',
    })),
    ...[...tags]
      .filter(([, { count }]) => count >= 2)
      .map(([tag, { lastmod }]) => ({
        loc: `${SITE}/news/tag/${encodeURIComponent(tag)}`,
        lastmod,
        changefreq: 'weekly',
        priority: '0.4',
      })),
  ];
}

/**
 * Rebuilds sitemap.xml from what this build serves: the routes written above
 * (static pages, topic hubs, every article it could read) and the archives
 * those articles fill.
 *
 * It used to carry forward every URL already in public/sitemap.xml so database
 * articles survived a build without credentials. That also kept URLs alive
 * that matched nothing, and with dist/404.html in place an article the build
 * did not write is a 404 anyway. The production build reads the database, so
 * its articles are pages here and land in the sitemap on their own. Note that
 * the React route at src/pages/SitemapXML.tsx never serves /sitemap.xml in
 * production: the static file wins, so this is the sitemap crawlers fetch.
 */
function writeSitemap(pages) {
  const today = new Date().toISOString().split('T')[0];
  const entries = new Map();

  for (const page of pages) {
    if (!page.sitemap) continue;
    const loc = page.path === '/' ? SITE : `${SITE}${page.path}`;
    entries.set(loc, {
      loc,
      lastmod: String(page.lastmod || today).slice(0, 10),
      changefreq: page.sitemap.changefreq,
      priority: page.sitemap.priority,
    });
  }

  for (const entry of archiveEntries(pages)) {
    if (!entries.has(entry.loc))
      entries.set(entry.loc, { ...entry, lastmod: entry.lastmod || today });
  }

  const urls = [...entries.values()]
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.loc.localeCompare(b.loc))
    .map(
      (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
    );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

  writeFileSync(join(DIST, 'sitemap.xml'), xml);
  return urls.length;
}

// --- feed -----------------------------------------------------------------

/**
 * Writes dist/rss.xml from the same markdown the pages are built from.
 *
 * Why here and not the React route at src/pages/RSSFeed.tsx: a feed reader
 * issues one HTTP GET and parses the bytes. On Cloudflare Pages the SPA
 * fallback answers /rss.xml with index.html as text/html, so that route only
 * ever ran for a human who clicked through in the browser - every actual
 * subscriber got a parse error. A file in dist is served before the fallback
 * and with the right content type.
 */
function writeFeed(pages) {
  const feedTime = (page) => page.feed.published_iso || `${page.feed.published_at}T12:00:00Z`;
  const items = pages
    .filter((page) => page.feed)
    .sort((a, b) => new Date(feedTime(b)) - new Date(feedTime(a)))
    .slice(0, FEED_LIMIT)
    .map((page) => {
      const url = `${SITE}${page.path}`;
      // Markdown articles carry a date only, so they get midday UTC and the date
      // does not slide backwards a day for readers west of Greenwich.
      const pubDate = new Date(feedTime(page)).toUTCString();
      const categories = [...new Set([page.feed.category, ...(page.feed.tags || [])])]
        .filter(Boolean)
        .map((name) => `      <category>${escapeXml(name)}</category>`)
        .join('\n');

      return `    <item>
      <title>${escapeXml(page.feed.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(page.feed.author)}</dc:creator>
      <description>${escapeXml(plainText(page.feed.description))}</description>
${categories}
    </item>`;
    });

  const built = new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${built}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${IMAGE}</url>
      <title>${escapeXml(FEED_TITLE)}</title>
      <link>${SITE}</link>
    </image>
    <copyright>Copyright ${new Date().getFullYear()} ${AUTHOR}. All rights reserved.</copyright>
${items.join('\n')}
  </channel>
</rss>
`;

  writeFileSync(join(DIST, 'rss.xml'), xml);
  return items.length;
}

// --- news sitemap ---------------------------------------------------------

/**
 * Google News sitemap for the daily brief. Google only reads entries from the
 * last two days, so it stays small; the site rebuilds on every publish, which
 * is what keeps it current. Written even when empty so the URL in robots.txt
 * never 404s.
 */
function writeNewsSitemap(pages, now = Date.now()) {
  const cutoff = now - 48 * 3600_000;
  const entries = pages
    .filter((page) => page.news && new Date(page.news.published_iso).getTime() >= cutoff)
    .map(
      (page) => `  <url>
    <loc>${SITE}${page.path}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(AUTHOR)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${new Date(page.news.published_iso).toISOString()}</news:publication_date>
      <news:title>${escapeXml(page.news.title)}</news:title>
    </news:news>
  </url>`
    );

  writeFileSync(
    join(DIST, 'news-sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries.join('\n')}
</urlset>
`
  );
  return entries.length;
}

// --- llms.txt -------------------------------------------------------------

/**
 * llms.txt (llmstxt.org): a plain-text map of the site for language models
 * and the agents that browse on their behalf. Cheap to produce, and the one
 * file an assistant can read to learn what this site is authoritative on.
 */
function writeLlmsTxt(crm, crmArticles, dbArticles) {
  const line = ({ meta }) =>
    `- [${meta.title}](${SITE}/news/${meta.slug}): ${plainText(meta.excerpt)}`;
  const news = dbArticles.filter(({ meta }) => meta.category === NEWS_CATEGORY).slice(0, 20);
  const guides = dbArticles.filter(({ meta }) => meta.category === 'Product Reviews').slice(0, 10);

  const sections = [
    `# ${AUTHOR}`,
    `> ${plainText(crm.POSITIONING_STATEMENT)}`,
    plainText(crm.THESIS),
    `## About\n\n- [About Dan Pearson](${SITE}/about): fifteen years in sales and business development, then seven SaaS platforms, then AI CRM automation.\n- [Projects](${SITE}/projects): the SaaS platforms and the CRM automation case studies behind them.\n- [News and insights](${SITE}/news): every article, newest first.\n- [AI CRM automation topic hub](${SITE}/topics/ai-crm-automation): all the CRM automation writing in one place.`,
    `## Services\n\n- [AI CRM automation consulting](${SITE}/ai-crm-automation): the Pipeline Automation Ladder, the 12-point audit and published pricing.\n- [Contact](${SITE}/connect)`,
    `## AI CRM automation\n\n${crmArticles.map(line).join('\n')}`,
  ];
  if (news.length)
    sections.push(`## Daily AI news briefs (most recent)\n\n${news.map(line).join('\n')}`);
  if (guides.length) sections.push(`## Optional\n\n${guides.map(line).join('\n')}`);

  writeFileSync(join(DIST, 'llms.txt'), `${sections.join('\n\n')}\n`);
}

// --- main -----------------------------------------------------------------

const templatePath = join(DIST, 'index.html');
if (!existsSync(templatePath)) {
  console.error('prerender: dist/index.html not found. Run `vite build` first.');
  process.exit(1);
}

const template = readFileSync(templatePath, 'utf8');
const seo = await loadTsModule('src/lib/seo.ts');
const crm = await loadCrmData();
const helpers = await loadPrerenderHelpers();
const articles = readArticles().filter(({ meta }) => meta.published);

// The article page queries `select('*')`, so the rows embedded for it must
// carry every column, not the subset fetchDbArticles asks for. Widening the
// select on its request keeps this to one network call; the raw rows are
// captured before fetchDbArticles filters and reshapes them. `null` means the
// database was not read (no credentials).
let dbRows = null;
const fetchAllColumns = async (endpoint, init) => {
  const response = await fetch(String(endpoint).replace(/([?&])select=[^&]*/, '$1select=*'), init);
  if (response.ok) {
    const rows = await response
      .clone()
      .json()
      .catch(() => null);
    if (Array.isArray(rows)) dbRows = rows;
  }
  return response;
};

// The markdown copy wins when a slug exists in both: it is the reviewed source
// the database row was seeded from.
const markdownSlugs = new Set(articles.map(({ meta }) => meta.slug));
// With credentials set, a failed read stops the build (see db-articles.mjs):
// shipping without the database articles would 404 every one of their URLs.
const dbArticles = (
  await fetchDbArticles({ fetchImpl: fetchAllColumns }).catch((error) => {
    if (!(error instanceof DbArticlesError)) throw error;
    console.error(
      `prerender: ${error.message}.\n` +
        'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, so the build needs the database ' +
        'articles; without them their pages, sitemap entries and feed items would be missing ' +
        'and the live URLs would 404. Fix the credentials or the API, or unset both variables ' +
        'to build from the markdown articles only.'
    );
    process.exit(1);
  })
).filter(({ meta }) => !markdownSlugs.has(meta.slug));

// Data read from the database is stamped with the build time, so react-query
// treats it as fresh for its staleTime and refetches after. Without the
// database the embedded copy is only the build's best answer (the page may
// have a row the build could not see), so it is stamped 0: shown at once,
// refetched on mount.
const dataUpdatedAt = dbRows ? Date.now() : 0;
const rowsBySlug = new Map((dbRows || []).map((row) => [row.slug, row]));

/** What Article.tsx's queryFn returns for a slug: the row, else the static copy. */
function articleData(slug) {
  const staticArticle = helpers.findStaticArticle(slug);
  const data =
    rowsBySlug.get(slug) ?? (staticArticle ? helpers.toStaticArticleRow(staticArticle) : null);
  if (!data) return null;
  return { key: helpers.articlePrerenderKey(slug), updatedAt: dataUpdatedAt, data };
}

/** What TopicHub.tsx's queryFn returns: its columns, its ordering, the shared selection. */
function topicData(topic) {
  const columns = helpers.TOPIC_HUB_COLUMNS.split(',').map((column) => column.trim());
  // PostgREST orders DESC with NULLS FIRST, as Postgres does.
  const desc = (a, b) => (a === b ? 0 : a == null ? -1 : b == null ? 1 : a < b ? 1 : -1);
  const rows = (dbRows || [])
    .slice()
    .sort(
      (a, b) =>
        desc(a.featured, b.featured) ||
        desc(a.view_count, b.view_count) ||
        desc(a.created_at, b.created_at)
    )
    .map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null])));
  return {
    key: helpers.topicPrerenderKey(topic),
    updatedAt: dataUpdatedAt,
    data: helpers.selectTopicArticles(rows, helpers.TOPIC_HUBS[topic]),
  };
}

const articlePages = [...articles, ...dbArticles].map((article) => {
  const prerenderData = articleData(article.meta.slug);
  return { ...articlePage(article, prerenderData?.data), prerenderData };
});

const otherHubs = Object.entries(helpers.TOPIC_HUBS)
  .filter(([topic]) => topic !== 'ai-crm-automation')
  .map(([topic, config]) => {
    const prerenderData = topicData(topic);
    return { ...topicHubPage(topic, config, prerenderData.data), prerenderData };
  });

const pages = [
  homePage(crm, articles),
  moneyPage(crm, articles),
  { ...hubPage(articles), prerenderData: topicData('ai-crm-automation') },
  ...otherHubs,
  ...STATIC_ROUTES.map((route) =>
    staticPage(route, { articlePages, topicHubs: helpers.TOPIC_HUBS })
  ),
  ...articlePages,
];

// Written from the untouched template before index.html is overwritten below.
writeNotFound(template);
writeSpaShell(template);

const routeSourceFor = loadRouteSources();
const manifest = loadManifest();
let preloadedRoutes = 0;

for (const page of pages) {
  const routeSource = manifest && routeSourceFor(page.path);
  const preloads = routeSource ? chunkFiles(manifest, routeSource) : [];
  if (preloads.length > 0) preloadedRoutes += 1;
  const html = applyPrerenderData(
    applyBody(
      applyHead(template, {
        title: page.title,
        description: page.description,
        url: page.path === '/' ? SITE : `${SITE}${page.path}`,
        path: page.path,
        type: page.type,
        schemas: page.schemas,
        image: page.image,
        article: page.article,
      }),
      page.content,
      { matched: page.matched }
    ),
    page.prerenderData,
    helpers.PRERENDER_DATA_ID
  );
  const output = applyModulePreloads(html, preloads);

  // Written as `<route>.html`, not `<route>/index.html`. Cloudflare Pages
  // serves the first at /route with a 200 and redirects the second to
  // /route/ - which meant every prerendered page (the money page, the topic
  // hub, all twelve articles) answered its own canonical URL with a 308 to a
  // URL the canonical tag and the sitemap do not name. One redirect hop on
  // exactly the pages built for crawlers that may not follow one.
  const outPath =
    page.path === '/' ? join(DIST, 'index.html') : join(DIST, `${page.path.slice(1)}.html`);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
}

const urlCount = writeSitemap(pages);
const itemCount = writeFeed(pages);
const newsCount = writeNewsSitemap(pages);
writeLlmsTxt(crm, articles, dbArticles);
console.log(
  `prerender: ${pages.length} routes (${dbArticles.length} from the database), ${urlCount} sitemap URLs, ${itemCount} feed items, ${newsCount} news sitemap URLs, ${preloadedRoutes} with route chunk preloads`
);
