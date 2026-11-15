/**
 * The string-in, string-out parts of scripts/prerender.mjs: head and body
 * rewriting, the embedded query data, module preloads, the 404 page, the SPA
 * shell and the RSS feed. Kept apart from the script so they can be unit
 * tested without a build (scripts/__tests__/prerender-html.test.ts).
 *
 * Nothing here reads the filesystem or the environment. Site constants and
 * the description truncation from src/lib/seo.ts come in through `ctx`:
 *
 *   ctx.truncateDescription  (text, max) => string
 *   ctx.author               byline, also the 404 title suffix
 *   ctx.defaultImage         { url, width, height } for og:image
 *   ctx.nav                  PRERENDER_NAV classes from src/lib/prerender-classes.ts
 *   ctx.navLinks             [{ href, label }] for the header
 *   ctx.footerLinks          [{ href, label }] for the footer
 *   ctx.year                 copyright year; defaults to the current one
 */

export const escapeHtml = (value) =>
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
export const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Markdown link syntax stripped back to plain text, for schema string fields. */
export const plainText = (value) =>
  String(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// --- head rewriting -------------------------------------------------------

// Every replacement below goes through a function, so a `$` in copy ("$600K+
// monthly") is inserted as text rather than read as a replacement pattern.
export const beforeHeadClose = (html, markup) =>
  html.replace('</head>', () => `    ${markup}\n  </head>`);

export function setTag(html, attr, name, content) {
  const pattern = new RegExp(`<meta\\s+${attr}="${name}"[^>]*>`, 'i');
  const tag = `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`;
  return pattern.test(html) ? html.replace(pattern, () => tag) : beforeHeadClose(html, tag);
}

export function removeTag(html, attr, name) {
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
export function applyHead(
  template,
  { title, description, url, path, type = 'website', schemas, image, article, noIndex },
  ctx
) {
  if (image === undefined) image = ctx.defaultImage;
  let html = template;
  const summary = ctx.truncateDescription(description, 160);

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
      ['article:author', ctx.author],
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

// --- body -----------------------------------------------------------------

export const linkList = (links) =>
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
export function applyBody(html, body, { matched = false } = {}, ctx) {
  const { nav, navLinks, footerLinks, author } = ctx;
  const year = ctx.year ?? new Date().getFullYear();
  const header = matched
    ? `
    <header class="${nav.bar}">
      <div class="${nav.container}">
        <div class="${nav.row}">
          <a href="/" class="${nav.logo}">${author}</a>
          <nav aria-label="Site" class="${nav.links}">
            ${navLinks
              .map(
                ({ href, label }) =>
                  `<a href="${href}" class="${nav.link}">${escapeHtml(label)}</a>`
              )
              .join('\n            ')}
          </nav>
        </div>
      </div>
    </header>`
    : `
    <header>
      <nav aria-label="Site">
        ${linkList(navLinks)}
      </nav>
    </header>`;
  const chrome = `${header}${body}
    <footer>
      <nav aria-label="Legal">
        ${linkList(footerLinks)}
      </nav>
      <p>&copy; ${year} ${author} &middot; Pearson Media LLC</p>
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
export function applyPrerenderData(html, payload, id) {
  if (!payload) return html;
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  // The last </body>, so nothing an article body contains can be matched first.
  const at = html.lastIndexOf('</body>');
  if (at === -1) return html;
  const block = `  <script type="application/json" id="${id}">${json}</script>\n  `;
  return html.slice(0, at) + block + html.slice(at);
}

/**
 * Adds <link rel="modulepreload"> for the route's page chunk and its static
 * imports. Without them the browser only finds the page chunk (and, for an
 * article, markdown-vendor) once the entry has run. Assets the head already
 * loads are skipped. `crossorigin` matches the entry script's, or the preload
 * would not be reused by the module fetch.
 */
export function applyModulePreloads(html, files) {
  if (!files || files.length === 0) return html;
  const links = [...new Set(files)]
    .map((file) => `/${file}`)
    .filter((href) => !html.includes(`"${href}"`))
    .map((href) => `    <link rel="modulepreload" crossorigin href="${href}">\n`)
    .join('');
  return links ? html.replace(/[ \t]*<\/head>/, (head) => `${links}${head}`) : html;
}

// --- 404 and the SPA shell -------------------------------------------------

/**
 * The body of dist/404.html. Cloudflare Pages serves it, with a 404 status,
 * for any path that matches neither a file nor a rule in _redirects; its
 * presence is also what turns off Pages' "serve index.html for everything" SPA
 * mode. The app bundle is still in it, so a visitor on a URL the build did not
 * know about (an article published since the last deploy) still gets the
 * React page.
 */
export function notFoundHtml(template, ctx) {
  return applyBody(
    applyHead(
      template,
      {
        title: `404 - Page Not Found | ${ctx.author}`,
        description: "The page you're looking for doesn't exist.",
        url: null,
        noIndex: true,
      },
      ctx
    ),
    `
    <main>
      <h1>Page not found</h1>
      <p>There is nothing at this address. It may have moved, or the link may be wrong.</p>
      <p><a href="/">Go to the home page</a> or <a href="/news">browse the writing</a>.</p>
    </main>`,
    {},
    ctx
  );
}

/**
 * The body of dist/spa.html: the untouched app shell, for the client-only
 * routes that public/_redirects rewrites to /spa (search, archives, admin).
 * Kept separate from index.html, which carries the home page's copy and
 * schema. No canonical: React sets the route's own on mount, and a crawler
 * that does not run JavaScript is better off with none than with the home
 * page's.
 */
export function spaShellHtml(template, ctx) {
  const image = ctx.defaultImage;
  let html = template.replace(/[ \t]*<link\s+rel="canonical"[^>]*>\n?/i, '');
  html = removeTag(html, 'property', 'og:url');
  html = setTag(html, 'property', 'og:image', image.url);
  html = setTag(html, 'property', 'og:image:width', String(image.width));
  html = setTag(html, 'property', 'og:image:height', String(image.height));
  html = setTag(html, 'name', 'twitter:image', image.url);
  return html;
}

// --- feed -----------------------------------------------------------------

/**
 * dist/rss.xml from the pages that carry a `feed` entry, newest first.
 * Returns { xml, count }.
 *
 *   feed.site, feed.title, feed.description, feed.image, feed.author, feed.limit
 *   feed.now   Date for lastBuildDate and the copyright year; defaults to now
 */
export function buildFeed(pages, feed) {
  const { site, author } = feed;
  const now = feed.now ?? new Date();
  const feedTime = (page) => page.feed.published_iso || `${page.feed.published_at}T12:00:00Z`;
  const items = pages
    .filter((page) => page.feed)
    .sort((a, b) => new Date(feedTime(b)) - new Date(feedTime(a)))
    .slice(0, feed.limit)
    .map((page) => {
      const url = `${site}${page.path}`;
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

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${site}</link>
    <description>${escapeXml(feed.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${feed.image}</url>
      <title>${escapeXml(feed.title)}</title>
      <link>${site}</link>
    </image>
    <copyright>Copyright ${now.getFullYear()} ${author}. All rights reserved.</copyright>
${items.join('\n')}
  </channel>
</rss>
`;

  return { xml, count: items.length };
}
