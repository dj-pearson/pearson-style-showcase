# Deployment Documentation Index

> ⚠️ **UPDATED 2025-12-20:** This project now uses **self-hosted Supabase** at `api.danpearson.net` and `functions.danpearson.net`. See `SUPABASE_MIGRATION_AUDIT.md` for current configuration.

## Overview

This comprehensive deployment guide covers all aspects of deploying the Dan Pearson Style Showcase project, a full-stack portfolio and CMS built with React, TypeScript, Vite, and Supabase, deployed on Cloudflare Pages.

**Date Generated:** 2025-11-11 (Updated: 2025-12-20)
**Project ID:** pearson-style-showcase
**Supabase:** Self-hosted at `api.danpearson.net`

---

## Documentation Files Generated

### 1. DEPLOYMENT_GUIDE.md (1,210 lines)
**Location:** `/home/user/pearson-style-showcase/DEPLOYMENT_GUIDE.md`

**Comprehensive reference covering all deployment aspects:**
- Build Configuration (Vite, scripts, output structure)
- Cloudflare Pages Setup (wrangler.toml, redirects, headers, CSP)
- Supabase Configuration (11 edge functions, authentication)
- Environment Variables (frontend & backend secrets)
- Database Setup (25 migrations, RLS policies, tables)
- Domain & DNS Configuration
- Deployment Workflow (manual & automated)
- Post-Deployment Verification (checklists, testing)
- Troubleshooting (common errors & solutions)
- Monitoring & Security Considerations
- Rollback Procedures

### 2. DEPLOYMENT_SUMMARY.md
**Location:** `/home/user/pearson-style-showcase/DEPLOYMENT_SUMMARY.md`

**Quick reference summary with tables:**
- Project overview & technology stack
- Key configuration files status
- Build configuration details
- Cloudflare Pages setup
- Supabase configuration overview
- Environment variables table
- Deployment workflow steps
- Database tables by feature
- Security features overview
- Performance metrics & targets
- Common issues & solutions table
- Next steps checklist

### 3. DEPLOYMENT_FILE_REFERENCE.md
**Location:** `/home/user/pearson-style-showcase/DEPLOYMENT_FILE_REFERENCE.md`

**Practical file location & command reference:**
- Complete file directory tree
- Build configuration file listing
- Frontend code structure
- Static assets & deployment config
- Database & backend file structure
- Critical environment variables
- Build & deployment commands
- Key configuration details
- HTTP headers & caching strategy
- Database tables overview
- CSP directives
- Edge functions configuration
- Git workflow
- Performance targets
- Monitoring endpoints
- Troubleshooting quick reference

---

## Quick Navigation

### For First-Time Deployment
1. Start with **DEPLOYMENT_SUMMARY.md** for overview
2. Read **DEPLOYMENT_GUIDE.md** Section 7: Deployment Workflow
3. Follow **DEPLOYMENT_FILE_REFERENCE.md** build commands

### For Environment Setup
1. **DEPLOYMENT_SUMMARY.md** → Environment Variables section
2. **DEPLOYMENT_FILE_REFERENCE.md** → Critical Environment Variables
3. **DEPLOYMENT_GUIDE.md** Section 4: Environment Variables (detailed)

### For Database Deployment
1. **DEPLOYMENT_GUIDE.md** Section 5: Database Setup
2. **DEPLOYMENT_FILE_REFERENCE.md** → Supabase Management commands
3. **DEPLOYMENT_GUIDE.md** Section 3: Supabase Configuration

### For Troubleshooting
1. **DEPLOYMENT_FILE_REFERENCE.md** → Troubleshooting Quick Reference
2. **DEPLOYMENT_SUMMARY.md** → Common Issues & Solutions
3. **DEPLOYMENT_GUIDE.md** Section 9: Troubleshooting (detailed)

### For Security Review
1. **DEPLOYMENT_SUMMARY.md** → Security Features
2. **DEPLOYMENT_GUIDE.md** Section 2.5: CSP
3. **DEPLOYMENT_GUIDE.md** → Security Considerations section

### For Performance Optimization
1. **DEPLOYMENT_SUMMARY.md** → Performance Metrics
2. **DEPLOYMENT_FILE_REFERENCE.md** → Performance Targets
3. **DEPLOYMENT_GUIDE.md** Section 8.3: Performance Verification

---

## Project Structure Overview

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **Routing:** React Router v6
- **State:** TanStack Query
- **3D Graphics:** Three.js

### Backend
- **Database:** PostgreSQL 15 (Supabase)
- **API:** Supabase REST API
- **Serverless:** 11 Edge Functions (Deno)
- **Auth:** Supabase Auth (JWT)
- **Storage:** Supabase Storage

### Deployment
- **Frontend:** Cloudflare Pages
- **Backend:** Supabase
- **Domain:** danpearson.net
- **CDN:** Cloudflare
- **CI/CD:** Git-based (auto-deploy on push)

---

## Key Deployment Steps

### Phase 1: Preparation
```bash
# 1. Install dependencies
npm install

# 2. Set up local environment
cp .env.example .env
# Edit .env with your values

# 3. Run lint
npm run lint

# 4. Build locally
npm run build

# 5. Preview build
npm run preview
```

### Phase 2: Supabase Deployment
```bash
# 1. Link to Supabase project
supabase link --project-id qazhdcqvjppbbjxzvisp

# 2. Deploy database migrations
supabase db push

# 3. Set secrets
supabase secrets set SUPABASE_URL=https://...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
# ... set all other secrets

# 4. Deploy edge functions
supabase functions deploy
```

### Phase 3: Frontend Deployment
```bash
# Option A: Push to main (auto-deploy)
git push origin main

# Option B: Manual deployment
npm run build
wrangler pages deploy dist/
```

### Phase 4: Verification
```bash
# 1. Check website loads
curl -I https://danpearson.net

# 2. Verify security headers
curl -I https://danpearson.net | grep X-Frame-Options

# 3. Test database connection
# Via browser console or Supabase dashboard

# 4. Test edge functions
# Verify functions are accessible
```

---

## Critical Checklist

### Before First Deployment
- [ ] All 25 database migrations reviewed
- [ ] All 11 edge functions implemented
- [ ] Environment variables (.env) created with actual values
- [ ] Supabase secrets configured
- [ ] Cloudflare Pages project created
- [ ] Domain DNS configured (Cloudflare nameservers)
- [ ] Build tested locally (npm run build)
- [ ] All tests pass (npm run test)
- [ ] Linter passes (npm run lint)

### After First Deployment
- [ ] Website loads without errors (curl)
- [ ] Security headers present (X-Frame-Options, etc.)
- [ ] Admin login works
- [ ] Database queries return data
- [ ] Edge functions respond correctly
- [ ] Images load properly
- [ ] CSS applied correctly
- [ ] JavaScript interactive
- [ ] Core Web Vitals acceptable
- [ ] No console errors in DevTools

### Monthly Monitoring
- [ ] Check Core Web Vitals scores
- [ ] Review error rates in Supabase
- [ ] Monitor API response times
- [ ] Check for broken links
- [ ] Review failed authentication attempts
- [ ] Monitor bundle sizes
- [ ] Test affiliate tracking
- [ ] Verify email deliverability

---

## Environment Variables Summary

### Frontend (.env)
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_GA_MEASUREMENT_ID (optional)
```

### Backend (Supabase Secrets)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
OPENAI_API
LOVABLE_API_KEY
SERPAPI_KEY
GOOGLE_SEARCH_API_KEY
GOOGLE_SEARCH_ENGINE_ID
RESEND_API
DATAFORSEO_API_LOGIN
DATAFORSEO_API_PASSWORD
ALLOWED_ORIGIN
```

**See DEPLOYMENT_FILE_REFERENCE.md for complete details**

---

## Database Architecture

### Tables: 16 (across 25 migrations)

**Content Management:**
- projects, articles, ventures

**Admin & Monitoring:**
- admin_users, admin_activity_log, system_metrics, alert_rules

**Social Proof:**
- testimonials, profile_settings

**Support System:**
- support_tickets, ticket_responses, kb_articles

**Maintenance:**
- maintenance_tasks, maintenance_results, link_health, performance_history

**All tables have RLS enabled for security**

---

## Edge Functions Overview

### Authentication & Core (4)
1. admin-auth - Admin login with rate limiting
2. send-contact-email - Contact form (Resend)
3. newsletter-signup - Newsletter management
4. track-affiliate-click - Affiliate tracking

### AI & Content (3)
5. generate-ai-article - AI articles (Lovable)
6. ai-content-generator - General AI (OpenAI)
7. generate-social-content - Social content

### Integration (2)
8. amazon-article-pipeline - Amazon automation
9. send-article-webhook - Article webhooks

### System (2)
10. maintenance-runner - Scheduled tasks
11. test-api-setup - API testing

---

## Performance Specifications

### Bundle Sizes (Gzipped)
- Main: ~45KB
- React vendor: ~140KB
- Three.js vendor: ~276KB (lazy-loaded)
- Markdown vendor: ~277KB (lazy-loaded)

### Caching Strategy
- Static assets: 1 year (immutable)
- HTML: No cache (must-revalidate)
- Fonts: 1 year (immutable)
- Images: 1 week with stale-while-revalidate

### Core Web Vitals Targets
- LCP: < 2.5s (Good)
- FID: < 100ms (Good)
- CLS: < 0.1 (Good)

---

## Security Architecture

### Frontend Security
- Content Security Policy (CSP) headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- No mixed content (HTTPS only)
- Input validation & DOMPurify sanitization

### Backend Security
- JWT authentication with 1-hour expiry
- Row Level Security on all tables
- Rate limiting (contact form, auth attempts)
- Service role keys never exposed to client
- Admin verification on sensitive operations

### API Security
- CORS headers configured
- Rate limiting per IP
- No secrets in logs/code
- Secrets stored in Supabase (not in git)

---

## Deployment Platforms

### Cloudflare Pages
- **Project:** pearson-style-showcase
- **Build Command:** npm run build
- **Output:** dist/
- **Node.js:** 18+
- **Automatic:** Git-based deployment

### Supabase
- **Project ID:** qazhdcqvjppbbjxzvisp
- **Database:** PostgreSQL 15
- **Auth:** JWT-based
- **Functions:** Deno runtime
- **Manual:** CLI-based deployment

### Domain
- **Primary:** danpearson.net
- **Nameservers:** Cloudflare
- **SSL:** Automatic (Cloudflare)
- **DNS:** Cloudflare managed

---

## Monitoring & Analytics

### Real-Time Monitoring
- **Cloudflare:** Pages Dashboard > Analytics
- **Supabase:** Project > Monitoring
- **Google Analytics:** G-8R95ZXMV6L

### Key Metrics
- Page load time
- Core Web Vitals (LCP, FID, CLS)
- API response time
- Error rate
- Database connections
- Failed auth attempts
- Function execution time
- Cache hit ratio

---

## Rollback Procedures

### Frontend Rollback (Simple)
```bash
# Via Cloudflare Dashboard
Pages > Deployments > Select previous > Rollback

# Or via CLI
wrangler pages rollback
```

### Database Rollback (Complex)
```bash
# Create reverse migration
supabase migrations create revert_latest
# Add reverse SQL
supabase db push
```

### No Downtime
- Frontend rollback: Immediate (cached deployments)
- Database: Plan maintenance window
- Functions: Seamless (no interruption)

---

## Common Issues & Solutions

### Build Issues
| Issue | Solution |
|-------|----------|
| ROLLUP_BINARY_NOT_FOUND | Set engine-strict=false in .npmrc |
| Cannot find module '@/...' | Check tsconfig path aliases |
| TypeScript errors | Run npm run lint |

### Deployment Issues
| Issue | Solution |
|-------|----------|
| Build timeout | Optimize bundle, enable lazy loading |
| SPA routing 404s | Verify _redirects file exists |
| Functions not accessible | Check JWT verification setting |

### Runtime Issues
| Issue | Solution |
|-------|----------|
| Images not loading | Check CSP img-src directive |
| Supabase connection fails | Verify .env and JWT tokens |
| CORS errors | Check CSP connect-src directive |

**See DEPLOYMENT_GUIDE.md Section 9 for detailed troubleshooting**

---

## File Locations Quick Reference

### Configuration
```
vite.config.ts              - Build optimization
wrangler.toml               - Cloudflare Pages
supabase/config.toml        - Supabase local config
tsconfig.app.json           - TypeScript (strict mode)
tailwind.config.ts          - Tailwind theme
```

### Deployment
```
public/_redirects           - SPA routing
public/_headers             - HTTP headers & caching
index.html                  - Entry point with CSP
public/robots.txt           - SEO crawler rules
```

### Database
```
supabase/migrations/        - 25 SQL migration files
supabase/functions/         - 11 Edge Functions (Deno)
```

---

## Getting Help

### Documentation
- Vite: https://vitejs.dev/
- React: https://react.dev/
- Supabase: https://supabase.com/docs
- Cloudflare Pages: https://developers.cloudflare.com/pages/

### Local Commands
```bash
npm run dev              # Local development
npm run build            # Production build
npm run lint             # Check code quality
npm run test             # Run tests
supabase --help          # Supabase CLI help
wrangler --help          # Cloudflare CLI help
```

### Monitoring
- Cloudflare: https://dash.cloudflare.com/
- Supabase: https://app.supabase.com/
- Google Analytics: https://analytics.google.com/

---

## Next Steps

### 1. Review Documentation
- [ ] Read DEPLOYMENT_SUMMARY.md (overview)
- [ ] Read DEPLOYMENT_GUIDE.md (detailed)
- [ ] Reference DEPLOYMENT_FILE_REFERENCE.md (commands)

### 2. Prepare Environment
- [ ] Create .env file with real values
- [ ] Link Supabase project
- [ ] Configure Cloudflare Pages

### 3. Deploy Backend
- [ ] Push database migrations
- [ ] Set Supabase secrets
- [ ] Deploy edge functions

### 4. Deploy Frontend
- [ ] Push to main branch (or manual deploy)
- [ ] Monitor build logs
- [ ] Verify deployment

### 5. Verify Deployment
- [ ] Run post-deployment checklist
- [ ] Monitor Core Web Vitals
- [ ] Set up monitoring alerts

---

## Support Contacts

For questions or issues:
1. Check troubleshooting section in relevant doc
2. Review error logs in Cloudflare/Supabase dashboards
3. Consult platform documentation links above
4. Review git history for recent changes

---

**Generated:** 2025-11-11  
**Total Documentation:** ~2,500 lines  
**Coverage:** All 8 deployment areas thoroughly documented  
**Last Reviewed:** 2025-11-11

