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

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { marked } from 'marked';
import { transformSync } from 'esbuild';
import { readArticles, extractFaqs } from './lib/content.mjs';

const DIST = 'dist';
const SITE = 'https://danpearson.net';
const IMAGE = `${SITE}/android-chrome-512x512.png`;
const AUTHOR = 'Dan Pearson';

marked.setOptions({ gfm: true, breaks: false });

/**
 * Loads the canonical CRM content module. It is TypeScript with no imports, so
 * esbuild (already present as a Vite dependency) can transpile it in memory
 * rather than duplicating the framework, tiers and FAQs into this script.
 */
async function loadCrmData() {
  const source = readFileSync('src/lib/crm-automation.ts', 'utf8');
  const { code } = transformSync(source, { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Markdown link syntax stripped back to plain text, for schema string fields. */
const plainText = (value) =>
  String(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// --- head rewriting -------------------------------------------------------

function setTag(html, attr, name, content) {
  const pattern = new RegExp(`<meta\\s+${attr}="${name}"[^>]*>`, 'i');
  const tag = `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`;
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`);
}

function applyHead(template, { title, description, url, type = 'website', schemas }) {
  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(url)}" />`
  );

  html = setTag(html, 'name', 'description', description);
  html = setTag(html, 'property', 'og:title', title);
  html = setTag(html, 'property', 'og:description', description);
  html = setTag(html, 'property', 'og:url', url);
  html = setTag(html, 'property', 'og:type', type);
  html = setTag(html, 'property', 'og:image', IMAGE);
  html = setTag(html, 'name', 'twitter:title', title);
  html = setTag(html, 'name', 'twitter:description', description);
  html = setTag(html, 'name', 'twitter:image', IMAGE);

  // One graph per page rather than several loose blocks: a single @graph is
  // easier for parsers to resolve @id references across.
  const graph = JSON.stringify(
    { '@context': 'https://schema.org', '@graph': schemas },
    null,
    2
  ).replace(/</g, '\\u003c');

  return html.replace(
    '</head>',
    `    <script type="application/ld+json">\n${graph}\n    </script>\n  </head>`
  );
}

function applyBody(html, body) {
  return html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${body}</div>`
  );
}

// --- schema builders ------------------------------------------------------

const PERSON = {
  '@type': 'Person',
  '@id': `${SITE}/#dan-pearson`,
  name: AUTHOR,
  url: SITE,
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

function articlePage({ meta, body }) {
  const url = `${SITE}/news/${meta.slug}`;
  const faqs = extractFaqs(body);

  const schemas = [
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: meta.title,
      description: meta.seo_description || meta.excerpt,
      abstract: plainText(meta.excerpt),
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      author: { '@id': `${SITE}/#dan-pearson` },
      publisher: { '@id': `${SITE}/#dan-pearson` },
      image: IMAGE,
      articleSection: meta.category,
      keywords: meta.seo_keywords.join(', '),
      about: plainText(meta.target_keyword),
      inLanguage: 'en',
      isAccessibleForFree: true,
    },
    PERSON,
    breadcrumb([
      { name: 'Home', path: '/' },
      { name: 'News', path: '/news' },
      { name: 'AI CRM Automation', path: '/topics/ai-crm-automation' },
      { name: meta.title, path: `/news/${meta.slug}` },
    ]),
  ];

  if (faqs.length) schemas.push(faqPage(faqs));

  const content = `
    <article>
      <h1>${escapeHtml(meta.title)}</h1>
      <p><strong>${escapeHtml(meta.excerpt)}</strong></p>
      <p>By ${escapeHtml(meta.author)} &middot; ${escapeHtml(meta.read_time)} &middot; ${escapeHtml(meta.category)}</p>
      ${marked.parse(body)}
      <nav aria-label="Related">
        <a href="/topics/ai-crm-automation">All AI CRM automation writing</a>
        <a href="/ai-crm-automation">CRM automation services and the 12-point audit</a>
      </nav>
    </article>`;

  return {
    path: `/news/${meta.slug}`,
    title: `${meta.seo_title || meta.title} | ${AUTHOR}`,
    description: meta.seo_description || meta.excerpt,
    type: 'article',
    schemas,
    content,
    sitemap: { priority: meta.featured ? '0.9' : '0.8', changefreq: 'monthly' },
  };
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
            : { priceSpecification: { '@type': 'PriceSpecification', description: tier.priceLabel } }),
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

  const content = `
    <main>
      <h1>Dan Pearson &mdash; AI CRM Automation Consultant</h1>
      <p><strong>${escapeHtml(crm.POSITIONING_STATEMENT)}</strong></p>
      <p>${escapeHtml(crm.THESIS)}</p>
      <h2>Start here</h2>
      <ul>
        <li><a href="/ai-crm-automation">AI CRM automation consulting, the 12-point audit and pricing</a></li>
        <li><a href="/topics/ai-crm-automation">Research and teardowns on AI CRM automation</a></li>
        ${articles
          .filter(({ meta }) => meta.featured)
          .map(({ meta }) => `<li><a href="/news/${meta.slug}">${escapeHtml(meta.title)}</a></li>`)
          .join('\n        ')}
      </ul>
    </main>`;

  return {
    path: '/',
    title: 'Dan Pearson - AI CRM Automation Consultant',
    description: crm.POSITIONING_STATEMENT,
    schemas,
    content,
    sitemap: { priority: '1.0', changefreq: 'weekly' },
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

// --- sitemap --------------------------------------------------------------

/**
 * Rebuilds sitemap.xml from the prerendered routes, preserving any URL already
 * present in public/sitemap.xml.
 *
 * The preservation matters: legacy articles live only in the database, so this
 * script cannot see them, and dropping them would be a regression. Note that
 * the React route at src/pages/SitemapXML.tsx never serves /sitemap.xml in
 * production - public/_redirects maps that path to the static file, so this is
 * the sitemap crawlers actually fetch.
 */
function writeSitemap(pages) {
  const today = new Date().toISOString().split('T')[0];
  const entries = new Map();

  for (const page of pages) {
    const loc = page.path === '/' ? SITE : `${SITE}${page.path}`;
    entries.set(loc, {
      loc,
      lastmod: today,
      changefreq: page.sitemap.changefreq,
      priority: page.sitemap.priority,
    });
  }

  const existing = join('public', 'sitemap.xml');
  if (existsSync(existing)) {
    const previous = readFileSync(existing, 'utf8');
    for (const block of previous.match(/<url>[\s\S]*?<\/url>/g) || []) {
      const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
      if (!loc || entries.has(loc)) continue;
      entries.set(loc, {
        loc,
        lastmod: block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] || today,
        changefreq: block.match(/<changefreq>([^<]+)<\/changefreq>/)?.[1] || 'monthly',
        priority: block.match(/<priority>([^<]+)<\/priority>/)?.[1] || '0.5',
      });
    }
  }

  const urls = [...entries.values()]
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.loc.localeCompare(b.loc))
    .map(
      (url) => `  <url>
    <loc>${url.loc}</loc>
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

// --- main -----------------------------------------------------------------

const templatePath = join(DIST, 'index.html');
if (!existsSync(templatePath)) {
  console.error('prerender: dist/index.html not found. Run `vite build` first.');
  process.exit(1);
}

const template = readFileSync(templatePath, 'utf8');
const crm = await loadCrmData();
const articles = readArticles().filter(({ meta }) => meta.published);

const pages = [
  homePage(crm, articles),
  moneyPage(crm, articles),
  hubPage(articles),
  ...articles.map(articlePage),
];

for (const page of pages) {
  const html = applyBody(
    applyHead(template, {
      title: page.title,
      description: page.description,
      url: page.path === '/' ? SITE : `${SITE}${page.path}`,
      type: page.type,
      schemas: page.schemas,
    }),
    page.content
  );

  const outPath =
    page.path === '/' ? join(DIST, 'index.html') : join(DIST, page.path.slice(1), 'index.html');

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
}

const urlCount = writeSitemap(pages);
console.log(`prerender: ${pages.length} routes, ${urlCount} sitemap URLs`);
