# Deployment Setup Summary

## Project Overview
- **Name:** Dan Pearson Style Showcase
- **Platform:** Cloudflare Pages + Supabase
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL (Supabase)
- **Serverless:** Supabase Edge Functions (Deno)
- **Domain:** danpearson.net

---

## Key Configuration Files

### Root Level Configurations
| File | Purpose | Status |
|------|---------|--------|
| `package.json` | Project dependencies & build scripts | Configured |
| `vite.config.ts` | Vite build optimization | Configured with manual chunking |
| `wrangler.toml` | Cloudflare Pages configuration | Configured for `dist` output |
| `.npmrc` | NPM configuration | Fixed with `engine-strict=false` |
| `tsconfig.json` | TypeScript base config | Configured |
| `tsconfig.app.json` | TypeScript app config | Strict mode enabled |
| `tailwind.config.ts` | Tailwind CSS theme | Configured with custom animations |
| `.env.example` | Environment template | Provided |
| `.gitignore` | Git exclusions | Configured |

### Build & Deployment
| File | Purpose |
|------|---------|
| `public/_redirects` | SPA routing configuration |
| `public/_headers` | HTTP headers & caching strategy |
| `public/robots.txt` | SEO crawler instructions |
| `public/site.webmanifest` | PWA manifest |
| `index.html` | Entry point with CSP headers |

---

## Build Configuration Details

### Build Scripts
```json
{
  "dev": "vite",                                  # Local dev server
  "build": "vite build",                          # Production build
  "build:dev": "vite build --mode development",   # Dev build with sourcemaps
  "build:pages": "npm ci --only=production && vite build",  # Cloudflare Pages
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest"
}
```

### Output Structure
- **Directory:** `dist/`
- **Main Bundle:** ~45KB gzipped
- **Total Assets:** < 1MB
- **Vendor Chunks:** 
  - react-vendor: ~140KB
  - three-vendor: ~276KB (lazy-loaded)
  - markdown-vendor: ~277KB (lazy-loaded)

### Performance Optimizations
- Manual vendor chunking for optimal caching
- Route-based code splitting (lazy loading)
- Source maps only in development
- ES2020 target
- esbuild minification

---

## Cloudflare Pages Setup

### Configuration
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node.js Version:** 18
- **Environment Variables:** None required (public keys embedded)

### Routing & Headers
- **SPA Routing:** Enabled via `_redirects` file
- **Static Asset Caching:** 1 year (immutable)
- **HTML Caching:** No caching (must-revalidate)
- **Font Caching:** 1 year (immutable)
- **Image Caching:** 1 week with stale-while-revalidate

### Security Headers
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
X-XSS-Protection: 1; mode=block
```

### Content Security Policy (CSP)
- **default-src:** 'self' only
- **script-src:** 'self', Google Analytics & Google Tag Manager
- **style-src:** 'self' + Google Fonts
- **font-src:** 'self' + Google Fonts
- **img-src:** 'self', data:, https:, blob:
- **connect-src:** 'self' + Supabase + Analytics
- **frame-src:** 'none' (security)
- **upgrade-insecure-requests:** Enabled

---

## Supabase Configuration

### Project Details
- **Project ID:** `qazhdcqvjppbbjxzvisp`
- **API URL:** `https://qazhdcqvjppbbjxzvisp.supabase.co`
- **Database:** PostgreSQL 15
- **Auth:** JWT-based, 1-hour expiry

### Edge Functions (11 Total)

#### Authentication & Core
1. `admin-auth` - Admin login with rate limiting
2. `send-contact-email` - Contact form handler (Resend)
3. `newsletter-signup` - Newsletter management
4. `track-affiliate-click` - Affiliate tracking

#### AI & Content Generation
5. `generate-ai-article` - AI article generation (Lovable API)
6. `ai-content-generator` - General AI content (OpenAI)
7. `generate-social-content` - Social media content

#### Amazon Integration
8. `amazon-article-pipeline` - Full pipeline (SerpAPI, Google Search)
9. `send-article-webhook` - Article webhooks

#### System Functions
10. `maintenance-runner` - Scheduled tasks
11. `test-api-setup` - API configuration testing

### Database Tables (25 Migrations)
- `projects` - Portfolio projects
- `articles` - Blog/CMS articles
- `admin_users` - Admin authentication
- `testimonials` - Client testimonials & social proof
- `ventures` - Current projects/ventures
- `profile_settings` - Site profile configuration
- `support_tickets` - Support ticketing system
- `ticket_responses` - Support ticket threads
- `kb_articles` - Knowledge base/FAQ
- `maintenance_tasks` - Scheduled maintenance
- `maintenance_results` - Task execution history
- `link_health` - Broken link tracking
- `performance_history` - Core Web Vitals tracking
- `system_metrics` - Performance metrics
- `alert_rules` - Alert configuration
- `admin_activity_log` - Audit trail

### Row Level Security (RLS)
- **All tables have RLS enabled**
- **Pattern:** Public read, admin write
- **Admin verification:** JWT role check + admin_users table lookup

### Authentication
- JWT expiry: 3600 seconds (1 hour)
- Refresh token rotation: Enabled
- Signup: Enabled
- Email confirmations: Disabled (auto-confirm)
- Anonymous signups: Disabled

---

## Environment Variables

### Frontend (Public - Safe to Expose)
```env
VITE_SUPABASE_URL=https://qazhdcqvjppbbjxzvisp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GA_MEASUREMENT_ID=G-8R95ZXMV6L  # Optional
```

### Backend Secrets (Supabase Functions - Protected)
| Variable | Used By | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | All functions | Database access |
| `SUPABASE_SERVICE_ROLE_KEY` | AI/Admin functions | Protected database writes |
| `SUPABASE_ANON_KEY` | Track-affiliate-click | Public read-only |
| `OPENAI_API` | ai-content-generator | GPT-4 API access |
| `LOVABLE_API_KEY` | Multiple AI functions | Lovable/Cursor AI API |
| `SERPAPI_KEY` | Amazon pipeline | Google search results |
| `GOOGLE_SEARCH_API_KEY` | Amazon pipeline | Custom Google search |
| `GOOGLE_SEARCH_ENGINE_ID` | Amazon pipeline | Search engine ID |
| `RESEND_API` | send-contact-email | Email sending service |
| `DATAFORSEO_API_LOGIN` | test-api-setup | SEO data API |
| `DATAFORSEO_API_PASSWORD` | test-api-setup | SEO data API |
| `ALLOWED_ORIGIN` | admin-auth | CORS origin |

---

## Deployment Workflow

### Pre-Deployment Steps
1. Verify environment variables are set
2. Run linter: `npm run lint`
3. Run tests: `npm run test` (if available)
4. Build locally: `npm run build`
5. Preview build: `npm run preview`
6. Check bundle sizes

### Deployment Order
1. **Supabase Database** → Apply all migrations
2. **Supabase Functions** → Deploy with secrets configured
3. **Frontend** → Deploy to Cloudflare Pages

### Automated Deployment (Git-based)
- Push to main/selected branch
- Cloudflare automatically triggers build
- Deploys `dist/` directory to CDN
- Cache invalidated

### Manual Deployment
```bash
# Frontend
wrangler pages deploy dist/ --project-name=pearson-style-showcase

# Database & Functions
supabase db push
supabase functions deploy
```

---

## Database Initialization

### Migration Files Location
`/home/user/pearson-style-showcase/supabase/migrations/`

### Deployment Process
```bash
supabase link --project-id qazhdcqvjppbbjxzvisp
supabase db push              # Deploy all migrations
supabase db status            # Verify status
```

### Tables by Feature
- **Content Management:** projects, articles
- **Social Proof:** testimonials, ventures
- **Admin:** admin_users, admin_activity_log
- **Support:** support_tickets, ticket_responses, kb_articles
- **Monitoring:** system_metrics, alert_rules
- **Maintenance:** maintenance_tasks, maintenance_results, link_health, performance_history
- **Profile:** profile_settings

---

## DNS & Domain Configuration

### Domain
- **Primary:** danpearson.net
- **Platform:** Cloudflare Pages
- **HTTPS:** Enforced
- **Redirects:** www → non-www (Cloudflare managed)

### SEO Configuration
- **robots.txt:** Blocks /admin/, disallows date archives
- **Sitemap:** Referenced in robots.txt
- **Canonical URLs:** Set on all pages
- **Open Graph:** Configured for social sharing
- **Google Analytics:** GA-ID G-8R95ZXMV6L

---

## Security Features

### Frontend Security
- Content Security Policy (CSP) headers
- X-Frame-Options: DENY
- No mixed content (upgrade-insecure-requests)
- Input validation & sanitization (DOMPurify)

### Backend Security
- JWT authentication with expiry
- Row Level Security on all tables
- Rate limiting (contact form, auth)
- Service role keys never exposed
- Admin verification on sensitive operations

### API Security
- CORS headers configured
- Rate limiting per IP
- No secrets in logs/code
- Secrets stored in Supabase

---

## Performance Metrics

### Bundle Sizes (Gzipped)
- Main: ~45KB
- React vendor: ~140KB
- Three.js vendor: ~276KB (lazy)
- Markdown vendor: ~277KB (lazy)

### Core Web Vitals Targets
- **LCP:** < 2.5s
- **FID:** < 100ms
- **CLS:** < 0.1

### Caching Strategy
- Static assets (1 year)
- Fonts (1 year)
- Images (1 week)
- HTML (No cache)

---

## Post-Deployment Verification

### Automated Checks
```bash
# Website loads
curl -I https://danpearson.net

# Security headers present
curl -I https://danpearson.net | grep X-Frame

# Database connection works
# Test via browser: supabase queries return data

# Functions accessible
# Test edge function endpoints
```

### Manual Checks
- [ ] All pages load without errors
- [ ] Admin login works
- [ ] Images load correctly
- [ ] CSS applied properly
- [ ] No console errors
- [ ] Security headers present
- [ ] Cache headers correct
- [ ] Mobile responsive
- [ ] Forms submit successfully
- [ ] Core Web Vitals meet targets

---

## Common Issues & Solutions

### Build Errors
| Issue | Solution |
|-------|----------|
| `ROLLUP_BINARY_NOT_FOUND` | Set `engine-strict=false` in `.npmrc` |
| `Cannot find module '@/...'` | Check tsconfig path aliases |
| TypeScript errors | Run `npm run lint` to identify issues |

### Deployment Errors
| Issue | Solution |
|-------|----------|
| Cloudflare build fails | Check Node.js version (need 18+) |
| SPA routing 404s | Verify `_redirects` file exists |
| CORS errors | Check CSP `connect-src` directive |

### Runtime Errors
| Issue | Solution |
|-------|----------|
| Images not loading | Check CSP `img-src` directive |
| Supabase connection fails | Verify `.env` values and JWT |
| Functions timeout | Check function code & API keys |

---

## Rollback Procedures

### Frontend
```bash
# In Cloudflare Pages dashboard → Deployments → Rollback
# Or: wrangler pages rollback
```

### Database
```bash
# Create reverse migration
supabase migrations create revert_latest
# Add reverse SQL, then:
supabase db push
```

---

## Monitoring & Maintenance

### Key Metrics
- Page load time
- Core Web Vitals
- API response time
- Error rate
- Database connections
- Failed auth attempts

### Tools
- Cloudflare Analytics (dashboard)
- Supabase Monitor (project dashboard)
- Google Analytics (G-8R95ZXMV6L)
- Chrome DevTools (Lighthouse)

---

## Documentation References

- **Full Deployment Guide:** `DEPLOYMENT_GUIDE.md` (1,210 lines)
- **Vite Config:** `vite.config.ts`
- **Supabase Config:** `supabase/config.toml`
- **TypeScript Config:** `tsconfig.json`
- **Environment Template:** `.env.example`

---

## Next Steps

1. Review `DEPLOYMENT_GUIDE.md` for detailed instructions
2. Set up Supabase secrets: `supabase secrets set KEY=value`
3. Deploy database: `supabase db push`
4. Deploy functions: `supabase functions deploy`
5. Monitor deployment: Check Cloudflare & Supabase dashboards
6. Run post-deployment verification checklist

