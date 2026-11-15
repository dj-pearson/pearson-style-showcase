import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * `vite preview` config for the preview Playwright project
 * (npm run test:e2e:preview). It serves the built dist/ the way Cloudflare
 * Pages does for the cases those specs check, which plain `vite preview` does
 * not:
 *
 * - appType 'mpa' turns off the SPA fallback. With it on, every unknown URL
 *   came back 200 with the prerendered home page, so a 404 could never be
 *   observed.
 * - /route serves dist/route.html, as on Pages (Vite's html fallback does
 *   this for both app types).
 * - Anything else that is not a file gets dist/404.html with a 404 status,
 *   which is what Pages does once a 404.html exists.
 *
 * Not emulated: the rewrites in public/_redirects (/search, the archives and
 * /admin to /spa). Those routes are client-only and have nothing to show with
 * JavaScript off, so the preview specs do not visit them; here they 404.
 */
function cloudflarePagesNotFound(): Plugin {
  return {
    name: 'cloudflare-pages-not-found',
    configurePreviewServer(server) {
      // Returned function: runs after Vite's static middleware and its html
      // fallback, but before the middleware that serves the .html file the
      // fallback rewrote /route to. So a rewritten URL that names a real file
      // is passed on; anything else is a 404.
      return () => {
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') return next();
          const dist = resolve(server.config.root, server.config.build.outDir);
          const pathname = decodeURIComponent((req.url ?? '/').split(/[?#]/)[0]);
          if (pathname.endsWith('.html') && existsSync(join(dist, pathname))) return next();
          const notFound = join(dist, '404.html');
          if (!existsSync(notFound)) return next();
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(req.method === 'HEAD' ? undefined : readFileSync(notFound));
        });
      };
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [cloudflarePagesNotFound()],
});
