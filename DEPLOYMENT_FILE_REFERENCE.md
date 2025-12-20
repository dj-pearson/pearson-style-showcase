# Deployment File Reference Guide

> ⚠️ **LEGACY DOCUMENT:** Updated 2025-12-20. This project now uses **self-hosted Supabase** at `api.danpearson.net` and `functions.danpearson.net`. See `SUPABASE_MIGRATION_AUDIT.md` for current configuration.

## Quick File Location Reference

### Build Configuration Files

```
/home/user/pearson-style-showcase/
├── package.json                    # Dependencies & build scripts
├── vite.config.ts                  # Vite build configuration
├── wrangler.toml                   # Cloudflare Pages config
├── tsconfig.json                   # TypeScript base config
├── tsconfig.app.json               # TypeScript app config (strict mode)
├── tsconfig.node.json              # TypeScript Node config
├── tailwind.config.ts              # Tailwind CSS theme & animations
├── eslint.config.js                # ESLint configuration
├── postcss.config.js               # PostCSS configuration
├── .npmrc                          # NPM configuration (engine-strict=false)
├── .nvmrc                          # Node version specification
├── .env                            # Environment variables (LOCAL ONLY)
├── .env.example                    # Environment template
└── .gitignore                      # Git exclusions
```

### Frontend Code

```
/home/user/pearson-style-showcase/src/
├── main.tsx                        # App entry point
├── App.tsx                         # Root component
├── App.css                         # Global styles
├── index.css                       # Tailwind CSS + custom styles
├── vite-env.d.ts                   # Vite type definitions
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── admin/                      # Admin dashboard components
│   ├── skeletons/                  # Loading state components
│   ├── Navigation.tsx
│   ├── Footer.tsx
│   ├── SEO.tsx
│   ├── ErrorBoundary.tsx
│   └── [other components]
├── pages/
│   ├── Index.tsx                   # Homepage
│   ├── About.tsx
│   ├── Projects.tsx
│   ├── News.tsx
│   ├── Article.tsx
│   ├── AdminLogin.tsx
│   ├── AdminDashboard.tsx
│   └── [other pages]
├── hooks/
│   └── use-toast.ts               # Custom toast hook
├── integrations/
│   └── supabase/
│       ├── client.ts              # Supabase client initialization
│       └── types.ts               # Database type definitions
├── lib/
│   ├── security.ts                # Input validation & sanitization
│   ├── logger.ts                  # Development logger
│   └── utils.ts                   # Utility functions
├── contexts/                       # React context providers
└── test/                          # Test files
```

### Static Assets & Deployment Config

```
/home/user/pearson-style-showcase/public/
├── _redirects                     # SPA routing config (Cloudflare)
├── _headers                       # HTTP headers & caching (Cloudflare)
├── index.html                     # HTML entry point (in root)
├── robots.txt                     # SEO crawler instructions
├── sitemap.xml                    # XML sitemap for search engines
├── site.webmanifest              # PWA manifest
├── favicon.ico                    # Favicon
├── favicon-16x16.png
├── favicon-32x32.png
├── android-chrome-192x192.png
├── android-chrome-512x512.png
├── apple-touch-icon.png
├── placeholder.svg
└── amazon_ideas.csv              # Amazon product research data
```

### Database & Backend

```
/home/user/pearson-style-showcase/supabase/
├── config.toml                    # Supabase local config
├── migrations/                    # Database migration files (25 total)
│   ├── 20250716201805-*.sql      # Initial projects schema
│   ├── 20250717045011-*.sql      # Articles system
│   ├── 20251007232740-*.sql      # Admin system
│   ├── ...
│   └── 20251110000001_testimonials_and_profile.sql
└── functions/                     # Supabase Edge Functions
    ├── admin-auth/
    │   └── index.ts              # Admin authentication with rate limiting
    ├── send-contact-email/
    │   └── index.ts              # Contact form handler (Resend)
    ├── generate-ai-article/
    │   └── index.ts              # AI article generation (Lovable)
    ├── ai-content-generator/
    │   └── index.ts              # AI content (OpenAI)
    ├── amazon-article-pipeline/
    │   └── index.ts              # Full Amazon automation
    ├── generate-social-content/
    │   └── index.ts              # Social media content
    ├── maintenance-runner/
    │   └── index.ts              # Scheduled maintenance
    ├── send-article-webhook/
    │   └── index.ts              # Article webhooks
    ├── track-affiliate-click/
    │   └── index.ts              # Affiliate tracking
    ├── newsletter-signup/
    │   └── index.ts              # Newsletter management
    └── test-api-setup/
        └── index.ts              # API configuration testing
```

---

## Critical Environment Variables

### Frontend (.env file)
```env
# REQUIRED - Public Supabase credentials
VITE_SUPABASE_URL=https://qazhdcqvjppbbjxzvisp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OPTIONAL - Analytics
VITE_GA_MEASUREMENT_ID=G-8R95ZXMV6L
```

### Backend Secrets (Supabase)
```bash
# Core Supabase
SUPABASE_URL=https://qazhdcqvjppbbjxzvisp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-secret-key
SUPABASE_ANON_KEY=your-anon-key

# AI Services
OPENAI_API=sk-your-openai-key
LOVABLE_API_KEY=your-lovable-key

# Search & Data
SERPAPI_KEY=your-serpapi-key
GOOGLE_SEARCH_API_KEY=your-google-api-key
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id
DATAFORSEO_API_LOGIN=your-dataforseo-login
DATAFORSEO_API_PASSWORD=your-dataforseo-password

# Email & CORS
RESEND_API=your-resend-api-key
ALLOWED_ORIGIN=https://danpearson.net
```

---

## Build & Deployment Commands

### Local Development
```bash
# Install dependencies
npm install

# Start development server (http://localhost:8080)
npm run dev

# Run linter
npm run lint

# Run tests
npm run test

# Preview production build locally
npm run preview
```

### Production Build
```bash
# Build for production (output: dist/)
npm run build

# Build in development mode (with source maps)
npm run build:dev

# Cloudflare Pages optimized build
npm run build:pages
```

### Supabase Management
```bash
# Login to Supabase
supabase login

# Link to project
supabase link --project-id qazhdcqvjppbbjxzvisp

# Check migration status
supabase db status

# Deploy migrations
supabase db push

# Set secrets
supabase secrets set KEY=value

# Deploy edge functions
supabase functions deploy

# Deploy specific function
supabase functions deploy function-name

# Test function locally
supabase functions serve
```

### Cloudflare Pages Deployment
```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy pages project
wrangler pages deploy dist/

# View deployments
wrangler pages list

# Rollback to previous deployment
wrangler pages rollback
```

---

## Key Configuration Details

### Vite Config (`vite.config.ts`)
- **Build target:** ES2020
- **Minifier:** esbuild
- **Chunk size warning:** 1000KB
- **Source maps:** Development only
- **Manual chunking:** 7 vendor bundles
- **Port:** 8080
- **Host:** :: (IPv6)

### Cloudflare Pages (`wrangler.toml`)
- **Project name:** pearson-style-showcase
- **Output directory:** dist
- **Build command:** npm run build
- **Node.js version:** 18

### Supabase Config (`supabase/config.toml`)
- **Project ID:** qazhdcqvjppbbjxzvisp
- **Database port:** 54322
- **API port:** 54321
- **Auth expiry:** 3600 seconds
- **Refresh token rotation:** Enabled

### TypeScript (`tsconfig.app.json`)
- **Target:** ES2020
- **Module:** ESNext
- **Strict mode:** ENABLED
- **Unused locals check:** ENABLED
- **Path alias:** @/* → ./src/*

---

## HTTP Headers & Caching Strategy

### File: `/home/user/pearson-style-showcase/public/_headers`

#### Asset Caching (1 year)
```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*.js
/assets/*.css
  Cache-Control: public, max-age=31536000, immutable, stale-while-revalidate=604800
```

#### Image Caching (1 week)
```
/*.png
/*.jpg
/*.jpeg
/*.svg
/*.webp
/*.gif
  Cache-Control: public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400
```

#### HTML No-Cache
```
/*.html
  Cache-Control: public, max-age=0, must-revalidate
```

#### Font Caching (1 year)
```
/*.woff
/*.woff2
/*.ttf
  Cache-Control: public, max-age=31536000, immutable
```

#### Security Headers (All)
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
  X-XSS-Protection: 1; mode=block
```

---

## Database Tables Overview

### Content Tables
| Table | Purpose | Rows |
|-------|---------|------|
| `projects` | Portfolio projects | ~6 seeded |
| `articles` | Blog/CMS articles | Variable |
| `ventures` | Current projects/ventures | Variable |

### Admin & Auth
| Table | Purpose | Status |
|-------|---------|--------|
| `admin_users` | Admin user accounts | Manual setup |
| `admin_activity_log` | Audit trail of admin actions | Auto-populated |

### Social & Profile
| Table | Purpose | Rows |
|-------|---------|------|
| `testimonials` | Client testimonials | Variable |
| `profile_settings` | Site owner profile data | 1 record |

### Support System
| Table | Purpose |
|-------|---------|
| `support_tickets` | Support tickets |
| `ticket_responses` | Support ticket replies |
| `kb_articles` | Knowledge base articles |

### Monitoring & Maintenance
| Table | Purpose |
|-------|---------|
| `system_metrics` | Performance metrics |
| `alert_rules` | Alert configuration |
| `maintenance_tasks` | Scheduled tasks |
| `maintenance_results` | Task execution results |
| `link_health` | Broken link tracking |
| `performance_history` | Core Web Vitals history |

---

## CSP Directives (`index.html`)

```html
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' 
  https://www.googletagmanager.com 
  https://www.google-analytics.com
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com data:
img-src 'self' data: https: blob:
connect-src 'self' https://*.supabase.co 
  https://www.google-analytics.com 
  https://www.googletagmanager.com
frame-src 'none'
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
upgrade-insecure-requests
```

---

## Edge Functions Configuration (`supabase/config.toml`)

### JWT Verification Status
```toml
[functions.admin-auth]
verify_jwt = false

[functions.newsletter-signup]
verify_jwt = false

[functions.send-contact-email]
verify_jwt = false

[functions.generate-ai-article]
verify_jwt = true

[functions.amazon-article-pipeline]
verify_jwt = false

[functions.generate-social-content]
verify_jwt = true

[functions.send-article-webhook]
verify_jwt = true

# Others: default (false)
```

---

## Git Workflow

### Branch Strategy
- **main:** Production-ready code
- **feature/xyz:** Feature branches
- **fix/xyz:** Bug fix branches
- **docs/xyz:** Documentation branches

### Commit Convention
```
feat: New feature
fix: Bug fix
docs: Documentation
style: Formatting
refactor: Code refactoring
perf: Performance improvement
test: Test additions
chore: Maintenance
```

### Deployment Trigger
```bash
# Push to main triggers Cloudflare Pages build
git push origin main

# Automatically:
# 1. Triggers Cloudflare Pages build
# 2. Runs npm run build
# 3. Deploys dist/ to CDN
# 4. Invalidates cache
```

---

## Performance Targets

### Bundle Sizes (Gzipped)
- Main bundle: ~45KB
- React vendor: ~140KB
- Three.js vendor: ~276KB (lazy)
- Markdown vendor: ~277KB (lazy)
- Total: < 1MB

### Core Web Vitals
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1

### Cache Hit Targets
- Static assets: 1 year (100% cache hit)
- HTML: No cache (always fresh)
- Images: 1 week

---

## Monitoring Endpoints

### Health Checks
```bash
# Website loads
curl -I https://danpearson.net

# Security headers present
curl -I https://danpearson.net | grep X-Frame-Options

# Database accessible
# Query via Supabase dashboard

# Functions accessible
# Test via edge function endpoint
```

### Analytics & Monitoring
- **Google Analytics:** G-8R95ZXMV6L (configured in index.html)
- **Cloudflare Analytics:** Dashboard > Analytics
- **Supabase Monitor:** Project > Monitoring
- **Performance:** Chrome DevTools > Lighthouse

---

## Troubleshooting Quick Reference

### Build Failures
```
Error: ROLLUP_BINARY_NOT_FOUND
Fix: Set engine-strict=false in .npmrc

Error: Cannot find module '@/...'
Fix: Verify tsconfig paths are correct

Error: TypeScript compilation failed
Fix: Run npm run lint and check strict mode issues
```

### Deployment Issues
```
Error: 404 on page navigation
Fix: Verify _redirects file exists in public/

Error: CORS errors in console
Fix: Check CSP connect-src directive includes needed domains

Error: Images not loading
Fix: Check CSP img-src directive, verify URLs are absolute
```

### Runtime Problems
```
Error: Supabase connection refused
Fix: Verify .env values, check JWT tokens

Error: Functions timeout
Fix: Check function code, verify API keys set in Supabase

Error: RLS policy violation
Fix: Check admin_users table, verify JWT claims
```

---

## Rollback Procedures

### Frontend Rollback
```bash
# Option 1: Via Cloudflare Dashboard
# Pages > Deployments > Select previous > Rollback

# Option 2: Via CLI
wrangler pages rollback

# Option 3: Via Git (force push - NOT RECOMMENDED)
# Revert commit and push (avoid in production)
```

### Database Rollback
```bash
# View migration status
supabase db status

# Create reverse migration
supabase migrations create revert_latest

# Add reverse SQL, then deploy
supabase db push
```

---

## Additional Resources

- Deployment Guide: `DEPLOYMENT_GUIDE.md` (1,210 lines)
- Deployment Summary: `DEPLOYMENT_SUMMARY.md`
- Vite Documentation: https://vitejs.dev/
- Supabase Documentation: https://supabase.com/docs
- Cloudflare Pages: https://developers.cloudflare.com/pages/
- React Documentation: https://react.dev/

