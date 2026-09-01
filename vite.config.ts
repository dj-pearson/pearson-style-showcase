import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// Bundle composition baseline (captured via `npm run build:analyze`, brotli
// gzip sizes). Top 5 largest client chunks:
//   1. three-vendor      ~853 KB  (~230 KB gzip)  three.js + r3f + drei
//   2. markdown-vendor    ~778 KB  (~270 KB gzip)  react-markdown + syntax highlighter
//   3. index (main)       ~462 KB  (~143 KB gzip)  app entry
//   4. charts-vendor      ~401 KB  (~109 KB gzip)  recharts
//   5. AccountingDashboard ~240 KB (~50 KB gzip)   lazy admin accounting module
// three-vendor and markdown-vendor are lazy-loaded (3D hero / article body), so
// they do not weigh on the initial route. Re-run `npm run build:analyze` and
// open stats.html to refresh this baseline.

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  // Source-map upload only runs in production and only when a Sentry auth token
  // is configured, so ordinary builds (and CI without secrets) work unchanged.
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
  const uploadSourceMaps = isProduction && Boolean(sentryAuthToken);
  // Bundle visualization is opt-in via `npm run build:analyze` (ANALYZE=true).
  const analyze = process.env.ANALYZE === 'true';

  const plugins = [react()];
  if (analyze) {
    plugins.push(
      visualizer({
        filename: 'stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        open: false,
      })
    );
  }
  if (uploadSourceMaps) {
    plugins.push(
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: sentryAuthToken,
        telemetry: false,
        // Upload then delete the maps so they are not served publicly.
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      })
    );
  }

  return {
    server: {
      host: '::',
      port: 8080,
    },
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    build: {
      // Increase chunk size warning limit - Three.js and markdown renderers are inherently large
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        external: [],
        output: {
          // Assign chunks by resolved module path rather than by package name.
          //
          // The object form let Rollup absorb tiny shared modules into whichever
          // vendor chunk referenced them first. clsx (about 500 bytes, imported
          // by src/lib/utils.ts and class-variance-authority) landed inside
          // charts-vendor, and Vite's preload-helper plus react-dom's commonjs
          // shim landed inside three-vendor. The entry then statically imported
          // both chunks to reach them, so index.html modulepreloaded 403 kB of
          // recharts and 849 kB of three that the homepage never renders.
          //
          // Naming the shared utilities explicitly keeps them in their own small
          // chunk, which is what breaks the edge. Matching on path alone is not
          // enough: anything left unassigned is still Rollup's choice, and it
          // chooses the big vendor chunks.
          manualChunks(id) {
            // Vite's preload helper is shared by every dynamic import.
            if (id.includes('vite/preload-helper')) return 'vite-helpers';

            if (!id.includes('node_modules')) return undefined;
            const inPkg = (...names: string[]) =>
              names.some((n) => id.includes(`node_modules/${n}/`));

            // Small shared utilities pulled in by nearly every component, plus the
            // Babel helper runtime that many libraries emit calls into. Left
            // unassigned these get absorbed into whichever big vendor chunk names
            // them first, and every chunk needing one then depends on all of it.
            if (inPkg('clsx', 'class-variance-authority', 'tailwind-merge')) return 'utils-vendor';
            if (id.includes('node_modules/@babel/runtime/')) return 'utils-vendor';
            // prop-types is imported by recharts' react-smooth and
            // react-transition-group and also from the three ecosystem. Absorbed
            // into three-vendor it made charts-vendor depend on the whole of
            // three, so every admin chunk rendering a chart fetched 843 kB of it.
            // react-is, object-assign and tslib are the same shape of hazard.
            if (inPkg('prop-types', 'react-is', 'object-assign', 'tslib')) return 'utils-vendor';

            if (inPkg('three', '@react-three/fiber', '@react-three/drei')) return 'three-vendor';
            if (inPkg('react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'))
              return 'react-vendor';
            if (id.includes('node_modules/@radix-ui/')) return 'ui-vendor';
            if (inPkg('lucide-react')) return 'icons-vendor';
            // Kept apart from markdown-vendor on purpose. react-markdown is needed
            // by any article, but the Prism build behind react-syntax-highlighter
            // is roughly 780 kB of language definitions and is loaded lazily by
            // components/article/CodeBlock, so grouping the two would drag it in
            // eagerly again.
            if (inPkg('react-syntax-highlighter', 'refractor', 'prismjs', 'highlight.js'))
              return 'syntax-vendor';
            if (inPkg('react-markdown', 'remark-gfm')) return 'markdown-vendor';
            if (inPkg('recharts')) return 'charts-vendor';
            if (inPkg('react-hook-form', '@hookform/resolvers', 'zod')) return 'form-vendor';
            if (inPkg('gsap', '@gsap/react')) return 'gsap-vendor';
            return undefined;
          },
        },
      },
      target: 'es2020',
      // Enable minification
      minify: 'esbuild',
      // Generate hidden source maps in production only when uploading them to
      // Sentry (they are deleted after upload); otherwise keep prod builds map-free.
      sourcemap: uploadSourceMaps ? 'hidden' : mode === 'development',
      // Ensure React is only bundled once
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
    },
  };
});
