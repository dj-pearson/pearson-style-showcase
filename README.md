# Dan Pearson Style Showcase

[![CI Pipeline](https://github.com/dj-pearson/pearson-style-showcase/actions/workflows/ci.yml/badge.svg)](https://github.com/dj-pearson/pearson-style-showcase/actions/workflows/ci.yml)
[![Deploy to Cloudflare Pages](https://github.com/dj-pearson/pearson-style-showcase/actions/workflows/deploy.yml/badge.svg)](https://github.com/dj-pearson/pearson-style-showcase/actions/workflows/deploy.yml)

A modern, full-stack portfolio and content management system featuring AI-powered article generation, Amazon affiliate marketing automation, and a comprehensive admin dashboard. Built with React, TypeScript, Supabase, and deployed on Cloudflare Pages.

## ✨ Key Features

- **AI-Powered Content Generation**: Automated article creation using GPT-4
- **Amazon Affiliate Pipeline**: Automated product research, content generation, and revenue tracking
- **CMS Admin Dashboard**: Full-featured content management for articles, projects, and AI tools
- **Performance Optimized**: Code splitting, lazy loading, and Core Web Vitals monitoring
- **SEO Ready**: Dynamic meta tags, structured data, sitemaps, and robots.txt
- **Security Hardened**: CSP headers, input validation, DOMPurify sanitization
- **3D Interactive Elements**: Three.js animations for engaging user experience

## 🔄 CI/CD Pipeline

This project features a comprehensive automated CI/CD pipeline powered by GitHub Actions:

### Continuous Integration
- **Automated Testing**: Run full test suite on every PR and push
- **Code Quality**: ESLint linting and TypeScript type checking
- **Build Validation**: Production build verification
- **Security Audits**: Automated vulnerability scanning with npm audit
- **Bundle Analysis**: Track and report bundle sizes on PRs
- **Coverage Reports**: Generate and archive code coverage metrics

### Continuous Deployment
- **Automatic Deployments**: Push to `main` deploys to production via Cloudflare Pages
- **Preview Deployments**: Every PR gets a unique preview URL
- **Deployment Comments**: Automatic PR comments with deployment URLs
- **Fast Builds**: Optimized with dependency caching (~5-7 minute builds)

### Automated Maintenance
- **Dependabot**: Weekly automated dependency updates with smart grouping
- **Stale Management**: Automatically mark and close inactive issues/PRs
- **Code Owners**: Automatic review assignments based on file changes

For detailed CI/CD documentation, see [`.github/README.md`](.github/README.md).

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (required for Cloudflare Pages)
- npm or yarn
- Supabase account (for backend services)

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🌐 Deployment

### Cloudflare Pages

This project is configured for deployment on Cloudflare Pages with the following settings:

**Build Configuration:**

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node.js version:** 18

**Environment Variables (if needed):**

- No environment variables required for basic deployment
- Supabase configuration is handled via hardcoded public keys

**Deployment Steps:**

1. Connect your GitHub repository to Cloudflare Pages
2. Set the build command to: `npm run build`
3. Set the publish directory to: `dist`
4. Deploy!

### Manual Deployment

```bash
# Build the project
npm run build

# The built files will be in the `dist` directory
# Upload the contents of `dist` to your web server
```

## 🏗️ Architecture Overview

### Frontend Stack
- **React 18**: Modern hooks-based components
- **TypeScript**: Full type safety with strict mode enabled
- **Vite**: Lightning-fast build tool with HMR
- **TanStack Query**: Server state management and caching
- **React Router**: Client-side routing with lazy loading
- **Tailwind CSS**: Utility-first styling with custom theme
- **shadcn/ui**: Accessible, customizable component library

### Backend Services (Supabase)
- **PostgreSQL**: Relational database for content and users
- **Edge Functions**: Serverless API endpoints for:
  - AI article generation (GPT-4 integration)
  - Amazon affiliate pipeline automation
  - Contact form handling
  - Newsletter management
  - Authentication and authorization
- **Row Level Security**: Database-level access control
- **Real-time Subscriptions**: Live data updates (optional)

### Key Architectural Patterns
- **Code Splitting**: Route-based lazy loading reduces initial bundle
- **Manual Chunking**: Vendor libraries separated for optimal caching
- **Optimistic UI**: Instant feedback with background sync
- **Error Boundaries**: Graceful error handling prevents white screens
- **Progressive Enhancement**: Works without JavaScript for SEO

## 🛠️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui base components
│   ├── admin/          # Admin dashboard components
│   ├── skeletons/      # Loading state components
│   ├── ArticleCard.tsx
│   ├── ProjectCard.tsx
│   ├── Navigation.tsx
│   ├── Footer.tsx
│   ├── SEO.tsx
│   └── ErrorBoundary.tsx
├── pages/              # Route-level page components
│   ├── Index.tsx       # Homepage
│   ├── About.tsx
│   ├── Projects.tsx
│   ├── News.tsx
│   ├── Article.tsx     # Dynamic article pages
│   ├── AITools.tsx
│   ├── Connect.tsx
│   ├── AdminLogin.tsx
│   └── AdminDashboard.tsx
├── hooks/              # Custom React hooks
│   └── use-toast.ts
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client and types
│       ├── client.ts
│       └── types.ts
├── lib/                # Utility functions
│   ├── security.ts     # Input validation, sanitization
│   ├── logger.ts       # Dev-only console wrapper
│   └── utils.ts        # General utilities
└── main.tsx           # Application entry point

supabase/
├── functions/          # Edge Functions (Deno)
│   ├── admin-auth/
│   ├── generate-ai-article/
│   ├── amazon-article-pipeline/
│   ├── track-affiliate-click/
│   └── send-contact-email/
└── migrations/         # Database schema changes
```

## 🎨 Technologies Used

- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Routing:** React Router DOM
- **State Management:** TanStack Query
- **Backend:** Supabase
- **3D Graphics:** Three.js with React Three Fiber

## 📝 Available Scripts

- `npm run dev` - Start development server (http://localhost:8080)
- `npm run build` - Build for production (output: `dist/`)
- `npm run build:dev` - Build in development mode (includes source maps)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint to check code quality
- `npm test` - Run test suite (when configured)

## 🔧 Environment Variables

Create a `.env` file in the root directory (never commit this file!):

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key-here

# Optional: Analytics
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Security Note**: Environment variables prefixed with `VITE_` are exposed to the client. Never put sensitive secrets here. Use Supabase Edge Functions for server-side secrets.

## 🔄 Development Workflow

### Making Changes

1. **Create a feature branch**: `git checkout -b feature/your-feature-name`
2. **Make your changes**: Edit files, add tests if applicable
3. **Test locally**: `npm run dev` and verify changes work
4. **Run linter**: `npm run lint` to catch issues
5. **Build test**: `npm run build` to ensure production build works
6. **Commit**: `git commit -m "feat: description of your changes"`
7. **Push**: `git push origin feature/your-feature-name`

### Commit Message Convention

Follow conventional commits for better changelog generation:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Adding New Pages

1. Create component in `src/pages/YourPage.tsx`
2. Add lazy import in `src/App.tsx`
3. Add route in `src/App.tsx` routes section
4. Add SEO component with proper meta tags
5. Update sitemap generation if needed

### Adding shadcn/ui Components

```bash
npx shadcn-ui@latest add [component-name]
```

This downloads the component source to `src/components/ui/`

## 🔧 Configuration Files

- `wrangler.toml` - Cloudflare Pages configuration
- `vite.config.ts` - Vite build configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration

## ⚡ Performance Optimization

### Current Optimizations
- **Code Splitting**: Routes lazy-loaded, reducing initial bundle by 60%
- **Vendor Chunking**: React, Three.js, Markdown separated for browser caching
- **Image Optimization**: Lazy loading with Intersection Observer
- **Font Loading**: `font-display: swap` prevents FOIT/FOUT
- **Resource Hints**: Preconnect to critical domains (Google Fonts, Analytics)
- **Core Web Vitals Monitoring**: Track LCP, FID, CLS in production

### Bundle Size Analysis

```bash
# Build and analyze bundle
npm run build

# Check dist/ folder sizes
du -sh dist/*
```

**Current bundle sizes** (gzipped):
- Main bundle: ~45KB
- React vendor: ~140KB
- Three.js vendor: ~276KB (lazy-loaded)
- Markdown vendor: ~277KB (lazy-loaded)

### Performance Tips
1. Use `<OptimizedImage>` for all images (auto lazy-loading)
2. Keep homepage bundle < 50KB for fast FCP/LCP
3. Lazy load below-the-fold components
4. Avoid layout shifts with skeleton screens

## 🚨 Troubleshooting

### Build Issues

**Error: `ROLLUP_BINARY_NOT_FOUND` on Cloudflare Pages**
- Solution: Optional dependencies issue with Rollup
- Fixed by adding `.npmrc` with `engine-strict=false`
- Use `npm install` instead of `npm ci`

**Error: TypeScript errors during build**
- Check `tsconfig.app.json` - strict mode is enabled
- Run `npm run lint` to catch issues before build
- Verify all imports have correct paths

**Error: `Cannot find module '@/...'`**
- Check `tsconfig.json` path aliases are configured
- Restart TypeScript server in VS Code: `Cmd+Shift+P` → "Restart TS Server"

### Runtime Issues

**404 errors on page refresh**
- Cloudflare Pages: Add `_redirects` file with `/* /index.html 200`
- Ensures client-side routing works for all routes

**Images not loading**
- Check Supabase storage bucket permissions
- Verify image URLs are absolute, not relative
- Check CSP headers allow image domain

**Console errors in production**
- Check `src/lib/logger.ts` - should only log in development
- Verify `import.meta.env.DEV` is working correctly

**Supabase connection errors**
- Verify `.env` file has correct Supabase URL and keys
- Check Supabase project is not paused (free tier)
- Test connection: Check Network tab for 401/403 errors

### Performance Issues

**Slow page loads**
- Run Lighthouse audit to identify bottlenecks
- Check bundle sizes with `npm run build`
- Verify lazy loading is working (Network tab)
- Check for unnecessary re-renders with React DevTools

**High memory usage**
- Three.js scenes not properly disposed
- Check for memory leaks with Chrome DevTools Memory tab
- Verify useEffect cleanup functions are implemented

### Development Issues

**Hot reload not working**
- Restart dev server: `npm run dev`
- Clear browser cache and hard reload
- Check for console errors blocking execution

**ESLint errors**
- Run `npm run lint` to see all issues
- Most errors auto-fixable with `npm run lint -- --fix`
- Check `.eslintrc` for rule configuration

## 📄 License

This project is private and proprietary.
