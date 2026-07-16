import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";
  // Source-map upload only runs in production and only when a Sentry auth token
  // is configured, so ordinary builds (and CI without secrets) work unchanged.
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
  const uploadSourceMaps = isProduction && Boolean(sentryAuthToken);

  const plugins = [react()];
  if (uploadSourceMaps) {
    plugins.push(
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: sentryAuthToken,
        telemetry: false,
        // Upload then delete the maps so they are not served publicly.
        sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
      })
    );
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      // Increase chunk size warning limit - Three.js and markdown renderers are inherently large
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        external: [],
        output: {
          manualChunks: {
            // Separate heavy vendor libraries to reduce initial bundle
            // These are lazy-loaded via route-based code splitting
            'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
            'icons-vendor': ['lucide-react'],
            'markdown-vendor': ['react-markdown', 'remark-gfm', 'react-syntax-highlighter'],
            'charts-vendor': ['recharts'],
            'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
            // GSAP animations - separated to reduce initial bundle
            'gsap-vendor': ['gsap', '@gsap/react'],
          },
        },
      },
      target: "es2020",
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
