# Living Technical Specification: Pearson Style Showcase

**Last Updated:** November 13, 2025
**Application:** Dan Pearson Style Showcase
**Status:** Active Development
**Repository:** https://github.com/dj-pearson/pearson-style-showcase

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture & Structure](#architecture--structure)
4. [Database Models & Schema](#database-models--schema)
5. [Features & Functionality](#features--functionality)
6. [Frontend Architecture](#frontend-architecture)
7. [Backend Services (Supabase Edge Functions)](#backend-services-supabase-edge-functions)
8. [Authentication & Authorization](#authentication--authorization)
9. [Testing & Quality](#testing--quality)
10. [Deployment & Configuration](#deployment--configuration)
11. [Performance & Optimization](#performance--optimization)
12. [Security Implementation](#security-implementation)
13. [Comprehensive Improvement Roadmap](#comprehensive-improvement-roadmap)

---

## 1. Project Overview

### Purpose
A modern, full-stack portfolio and content management system featuring AI-powered article generation, Amazon affiliate marketing automation, and a comprehensive admin dashboard. Designed to showcase Dan Pearson's expertise in AI engineering, business development, and tech innovation.

### Project Type
- **Frontend:** React 18 + TypeScript SPA (Single Page Application)
- **Backend:** Supabase (PostgreSQL database + Edge Functions)
- **Hosting:** Cloudflare Pages (with Supabase backend)
- **Architecture:** Serverless + Client-Side Routing

### Key Characteristics
- **Modern, performant web application** with lazy-loaded routes and code splitting
- **AI-powered content generation** using GPT-4 and Gemini APIs
- **Admin dashboard** with extensive content management capabilities
- **Amazon affiliate integration** with automated product research and tracking
- **SEO optimized** with dynamic meta tags and structured data
- **Security hardened** with CSP headers, input validation, and DOMPurify sanitization
- **3D interactive elements** using Three.js for enhanced UX

---

## 2. Technology Stack

### Frontend Dependencies

**Core Framework:**
- **React** (v18.3.1) - UI library with hooks
- **TypeScript** (v5.5.3) - Static type checking
- **Vite** (v6.1.7) - Lightning-fast build tool with HMR

**Routing & State Management:**
- **React Router DOM** (v6.26.2) - Client-side routing with lazy loading
- **TanStack Query** (React Query, v5.56.2) - Server state management and caching
- **React Hook Form** (v7.60.0) - Efficient form state management
- **Zod** (v3.25.76) - TypeScript-first schema validation

**UI & Styling:**
- **Tailwind CSS** (v3.4.11) - Utility-first CSS framework
- **shadcn/ui** - Accessible, customizable React components built on Radix UI
- **Radix UI** (various v1.x) - Unstyled accessible component primitives
- **Lucide React** (v0.462.0) - Beautiful icon library
- **Sonner** (v1.5.0) - Toast notifications
- **Embla Carousel** (v8.3.0) - Carousel component

**Visualization & Interactivity:**
- **Three.js** (v0.178.0) - 3D graphics library
- **@react-three/fiber** (v8.18.0) - React renderer for Three.js
- **@react-three/drei** (v9.122.0) - Useful helpers for Three.js
- **Recharts** (v2.12.7) - Composable charting library
- **React Markdown** (v10.1.0) - Markdown rendering with syntax highlighting
- **React Syntax Highlighter** (v16.1.0) - Code syntax highlighting
- **Remark GFM** (v4.0.1) - GitHub-flavored markdown support

**Backend Integration:**
- **@supabase/supabase-js** (v2.51.0) - Supabase JavaScript client
- **@hookform/resolvers** (v3.10.0) - Resolvers for React Hook Form

**Utilities:**
- **Date-fns** (v3.6.0) - Modern date utility library
- **DOMPurify** (v3.2.7) - XSS sanitization
- **QRCode** (v1.5.3) - QR code generation
- **OTPLib** (v12.0.1) - One-time password generation
- **Next-themes** (v0.3.0) - Theme management
- **Clsx** (v2.1.1) - Conditional className utility
- **Tailwind Merge** (v2.5.2) - Merge tailwind classes intelligently
- **Vaul** (v0.9.3) - Drawer component
- **React Dropzone** (v14.3.8) - File upload handling
- **React Resizable Panels** (v2.1.3) - Resizable panel layout

### Build Tools & Dev Dependencies

- **@vitejs/plugin-react** (v4.6.0) - Vite React plugin with Fast Refresh
- **Vitest** (v4.0.8) - Unit test framework
- **@testing-library/react** (v16.3.0) - React component testing
- **@testing-library/jest-dom** (v6.9.1) - Jest matchers for DOM
- **JSDOM** (v27.1.0) - DOM implementation for Node.js
- **ESLint** (v9.9.0) - Code linting
- **TypeScript ESLint** (v8.0.1) - TypeScript linting rules
- **Tailwind CSS Typography** (v0.5.15) - Typography plugin for Tailwind
- **PostCSS** (v8.4.47) - CSS transformation
- **Autoprefixer** (v10.4.20) - Vendor prefix injection
- **Rollup** (v4.28.0) - Module bundler (used by Vite)

### Backend Services

**Supabase Stack:**
- **PostgreSQL 12.2+** - Relational database
- **Deno** - Runtime for Edge Functions
- **Node.js 18+** - Required by Cloudflare Pages

---

## 3. Architecture & Structure

### Directory Structure

```
/home/user/pearson-style-showcase/
├── src/                           # Frontend source code (983K)
│   ├── pages/                     # Route-level page components
│   │   ├── Index.tsx             # Homepage with hero section
│   │   ├── About.tsx             # About page
│   │   ├── Projects.tsx          # Projects showcase
│   │   ├── News.tsx              # Articles listing page
│   │   ├── Article.tsx           # Dynamic article detail page
│   │   ├── AITools.tsx           # AI tools showcase
│   │   ├── Connect.tsx           # Contact page
│   │   ├── AdminLogin.tsx        # Admin login
│   │   ├── AdminDashboard.tsx    # Admin panel
│   │   ├── DateArchive.tsx       # Legacy redirect
│   │   ├── NotFound.tsx          # 404 page
│   │   ├── SitemapXML.tsx        # Dynamic sitemap generation
│   │   └── RobotsTxt.tsx         # Dynamic robots.txt
│   ├── components/                # Reusable UI components
│   │   ├── ui/                   # shadcn/ui base components
│   │   ├── admin/                # Admin dashboard components (262K)
│   │   │   ├── ArticleManager.tsx
│   │   │   ├── ProjectManager.tsx
│   │   │   ├── AIToolsManager.tsx
│   │   │   ├── AIArticleGenerator.tsx
│   │   │   ├── AmazonPipelineManager.tsx
│   │   │   ├── AmazonAffiliateStats.tsx
│   │   │   ├── AmazonReportImporter.tsx
│   │   │   ├── NewsletterManager.tsx
│   │   │   ├── AnalyticsSettings.tsx
│   │   │   ├── SEOManager.tsx
│   │   │   ├── WebhookSettings.tsx
│   │   │   ├── TestimonialsManager.tsx
│   │   │   ├── VenturesManager.tsx
│   │   │   ├── ProfileSettingsManager.tsx
│   │   │   ├── MaintenanceDashboard.tsx
│   │   │   ├── CommandCenterDashboard.tsx
│   │   │   ├── SupportTicketDashboard.tsx
│   │   │   ├── KeyboardShortcutsHelp.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   ├── command-center/    # Command center sub-components
│   │   │   │   ├── LiveActivityFeed.tsx
│   │   │   │   ├── QuickActionsPanel.tsx
│   │   │   │   ├── RevenueChart.tsx
│   │   │   │   └── SmartAlerts.tsx
│   │   │   └── support/           # Support system sub-components
│   │   │       ├── SupportTicketInbox.tsx
│   │   │       ├── TicketDetailView.tsx
│   │   │       ├── KnowledgeBaseManager.tsx
│   │   │       └── CannedResponseManager.tsx
│   │   ├── skeletons/            # Loading state components
│   │   │   ├── ArticleSkeleton.tsx
│   │   │   ├── ProjectSkeleton.tsx
│   │   │   └── TableSkeleton.tsx
│   │   ├── auth/                 # Auth-related components
│   │   ├── Navigation.tsx
│   │   ├── Footer.tsx
│   │   ├── SEO.tsx
│   │   ├── Analytics.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── ArticleCard.tsx
│   │   ├── ProjectCard.tsx
│   │   ├── HeroSection.tsx
│   │   ├── Interactive3DOrb.tsx
│   │   ├── ContactForm.tsx
│   │   ├── NewsletterSignup.tsx
│   │   ├── Testimonials.tsx
│   │   ├── CurrentVentures.tsx
│   │   ├── CaseStudies.tsx
│   │   ├── ReadingProgress.tsx
│   │   ├── ScrollTracker.tsx
│   │   ├── RoutePrefetcher.tsx
│   │   └── __tests__/            # Component tests
│   ├── contexts/                 # React Context providers
│   │   └── AuthContext.tsx       # Authentication context
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-toast.ts          # Toast notification hook
│   │   ├── use-mobile.tsx        # Mobile detection hook
│   │   ├── useAffiliateTracking.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   └── useReadingProgress.ts
│   ├── integrations/             # External service integrations
│   │   └── supabase/
│   │       ├── client.ts         # Supabase client initialization
│   │       ├── types.ts          # Auto-generated TypeScript types (1064 lines)
│   ├── lib/                      # Utility functions
│   │   ├── security.ts           # Input validation & sanitization
│   │   ├── logger.ts             # Dev-only console wrapper
│   │   ├── utils.ts              # General utilities
│   │   ├── performance.ts        # Core Web Vitals monitoring
│   │   ├── __tests__/            # Lib tests
│   ├── test/                     # Test setup
│   ├── App.tsx                   # Main app routing and setup
│   ├── main.tsx                  # React entry point
│   └── index.css                 # Global styles
├── supabase/                      # Backend configuration (257K)
│   ├── functions/                # Serverless edge functions
│   │   ├── admin-auth/           # Admin authentication
│   │   ├── generate-ai-article/  # GPT-4 article generation
│   │   ├── ai-content-generator/ # Content generation
│   │   ├── amazon-article-pipeline/
│   │   ├── generate-social-content/
│   │   ├── send-article-webhook/
│   │   ├── send-contact-email/
│   │   ├── newsletter-signup/
│   │   ├── maintenance-runner/
│   │   ├── track-affiliate-click/
│   │   └── test-api-setup/
│   └── migrations/               # Database schema files (24 migrations)
│       ├── 20250716201805-*.sql
│       ├── 20250717182954-9688baa3-*.sql (main schema)
│       ├── 20251007232740-*.sql (RBAC system)
│       ├── 20251008000001_command_center_schema.sql
│       ├── 20251008000002_support_ticket_schema.sql
│       ├── 20251008000003_maintenance_automation_schema.sql
│       └── 20251110000001_testimonials_and_profile.sql
├── public/                       # Static assets
├── vite.config.ts               # Vite build configuration
├── vitest.config.ts             # Test configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── tsconfig.app.json            # TypeScript app configuration
├── tsconfig.node.json           # TypeScript node configuration
├── wrangler.toml                # Cloudflare Pages configuration
├── package.json                 # npm dependencies
├── .env                         # Environment variables (not in repo)
├── .env.example                 # Example environment file
├── .npmrc                       # npm configuration
├── .nvmrc                       # Node version specification
├── .gitignore                   # Git ignore rules
├── README.md                    # Project documentation
└── [15+ additional docs]        # Feature guides and documentation
```

### Key Architectural Patterns

1. **Code Splitting & Lazy Loading**
   - Routes lazy-loaded with React.lazy()
   - Vendor libraries separated in build (three, react-vendor, markdown-vendor, etc.)
   - Below-the-fold components lazy-loaded
   - Initial bundle reduced by ~60%

2. **Manual Chunking Strategy**
   - React vendor bundle
   - Three.js vendor bundle (heavy, lazy-loaded)
   - UI vendor bundle (Radix)
   - Form vendor bundle
   - Markdown vendor bundle (lazy-loaded)
   - Charts vendor bundle

3. **State Management**
   - TanStack Query for server state (articles, projects, etc.)
   - React Context for auth state (AuthContext)
   - React Hook Form for form state
   - localStorage for user preferences (filters, search)

4. **Data Fetching Pattern**
   - Client-side fetching via Supabase client
   - Row-level security for data protection
   - Query caching with 5-min stale time, 10-min garbage collection
   - Optimistic UI updates

5. **Error Handling**
   - ErrorBoundary component for React errors
   - Try-catch blocks in async operations
   - Toast notifications for user feedback
   - Graceful fallbacks for missing data

---

## 4. Database Models & Schema

### Complete Database Schema

The database is managed through 24 migration files spanning from July 2025 to November 2025.

#### Core Content Tables

##### `articles`
Stores blog articles, AI-generated content, and news posts.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  title: string
  slug: string (UNIQUE, used in URLs)
  excerpt: string
  content: string | null (Markdown content)
  category: string
  author: string | null
  image_url: string | null
  featured: boolean | null
  published: boolean | null
  view_count: number | null
  read_time: string | null (e.g., "5 min read")
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string[] | null (array)
  target_keyword: string | null
  tags: string[] | null (array)
  social_image_url: string | null
  social_long_form: string | null (LinkedIn/long-form content)
  social_short_form: string | null (Twitter/short content)
  created_at: TIMESTAMPTZ | null
  updated_at: TIMESTAMPTZ | null
}
```

**Relationships:**
- One-to-Many with `article_products` (affiliate products)
- One-to-Many with `amazon_affiliate_clicks` (tracking)
- One-to-Many with `amazon_affiliate_stats` (metrics)
- One-to-Many with `amazon_search_terms`

**RLS Policies:**
- Public: Can read published articles
- Admin: Can create, update, delete articles

---

##### `projects`
Showcases Dan's projects and case studies.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  title: string
  slug: string (UNIQUE)
  description: string
  content: string | null
  image_url: string | null
  featured: boolean | null
  published: boolean | null
  tech_stack: string[] | null (array of technologies)
  link: string | null (project URL)
  github_link: string | null
  created_at: TIMESTAMPTZ | null
  updated_at: TIMESTAMPTZ | null
}
```

---

##### `ai_tools`
Directory of AI tools and platforms reviewed/featured.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  title: string
  description: string
  category: string
  link: string | null
  github_link: string | null
  image_url: string | null
  pricing: string | null (e.g., "Free", "Paid", "Freemium")
  complexity: string | null (e.g., "Beginner", "Advanced")
  features: string[] | null (array)
  tags: string[] | null (array)
  metrics: JSON | null (custom metrics)
  status: string | null (e.g., "active", "deprecated")
  sort_order: number | null
  created_at: TIMESTAMPTZ | null
  updated_at: TIMESTAMPTZ | null
}
```

---

##### `article_categories`
Categories for organizing articles.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  name: string
  slug: string (UNIQUE)
  description: string | null
  color: string | null (hex color for UI)
  created_at: TIMESTAMPTZ | null
}
```

---

#### Profile & Social Proof Tables

##### `testimonials`
Client testimonials and social proof.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  client_name: string
  client_title: string | null (e.g., "CEO", "Founder")
  client_company: string | null
  client_photo_url: string | null
  testimonial_text: string
  rating: number (1-5)
  project_type: string | null
  project_url: string | null
  featured: boolean (default: false)
  display_order: number (for sorting)
  status: 'draft' | 'published' | 'archived'
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

##### `profile_settings`
Profile information and settings for site owner.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  profile_photo_url: string | null
  hero_tagline: string | null
  availability_status: 'available' | 'limited' | 'unavailable'
  availability_text: string | null
  calendly_url: string | null
  resume_url: string | null
  linkedin_url: string (default: https://www.linkedin.com/in/danpearson)
  github_url: string (default: https://github.com/danpearson)
  email: string (default: dan@danpearson.net)
  phone: string | null
  location: string (default: "Des Moines Metropolitan Area")
  years_experience: number (default: 15)
  bio_headline: string | null
  bio_subheadline: string | null
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

##### `ventures`
Current ventures, platforms, and projects being built.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  name: string
  tagline: string | null
  description: string | null
  logo_url: string | null
  screenshot_url: string | null
  tech_stack: string[] | null (array of technologies)
  status: 'planning' | 'in-development' | 'beta' | 'live' | 'maintenance' | 'archived'
  live_url: string | null
  github_url: string | null
  metrics: JSONB | null (user_count, revenue, etc.)
  featured: boolean (default: false)
  display_order: number
  launch_date: DATE | null
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

#### Amazon Affiliate & E-Commerce Tables

##### `amazon_products`
Cached product data from Amazon.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  asin: string (UNIQUE, Amazon Standard ID)
  title: string
  price: number | null
  rating: number | null (1-5 stars)
  rating_count: number | null
  brand: string | null
  image_url: string | null
  bullet_points: JSON | null (array)
  niche: string | null
  created_at: TIMESTAMPTZ
  last_seen_at: TIMESTAMPTZ
}
```

---

##### `amazon_affiliate_clicks`
Tracking of affiliate link clicks.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  article_id: string | null (FK to articles)
  asin: string (Amazon product)
  clicked_at: TIMESTAMPTZ
  session_id: string | null
  ip_address: string | null (anonymized)
  user_agent: string | null
  referrer: string | null
  created_at: TIMESTAMPTZ
}
```

---

##### `amazon_affiliate_stats`
Daily aggregated affiliate statistics.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  article_id: string | null (FK)
  asin: string
  date: string (YYYY-MM-DD)
  clicks: number
  orders: number
  revenue: number
  commission: number
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

##### `amazon_search_terms`
Catalog of search terms for product research.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  search_term: string
  category: string
  product_count: number | null
  article_id: string | null (FK, used in)
  created_at: TIMESTAMPTZ
  used_at: TIMESTAMPTZ | null (when used in generation)
}
```

---

##### `article_products`
Junction table linking articles to specific products.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  article_id: string (FK to articles)
  asin: string (FK to amazon_products)
  affiliate_url: string
  best_for: string | null
  pros: JSON | null (array)
  cons: JSON | null (array)
  specs: JSON | null (object)
  summary: string | null
  created_at: TIMESTAMPTZ
}
```

---

##### `amazon_pipeline_settings`
Configuration for Amazon pipeline automation.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  amazon_tag: string (associate tag)
  daily_post_count: number
  niches: JSON (list of niches to target)
  min_rating: number
  review_required: boolean
  price_min: number | null
  price_max: number | null
  word_count_target: number
  cache_only_mode: boolean (skip API calls)
  last_run_at: TIMESTAMPTZ | null
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

##### `amazon_pipeline_runs`
History of pipeline executions.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  status: string ('running' | 'completed' | 'failed')
  started_at: TIMESTAMPTZ
  finished_at: TIMESTAMPTZ | null
  posts_created: number | null
  posts_published: number | null
  note: string | null
  errors: JSON | null (array of errors)
}
```

---

##### `amazon_pipeline_logs`
Detailed logs from pipeline executions.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  run_id: string (FK to amazon_pipeline_runs)
  level: string ('debug' | 'info' | 'warn' | 'error')
  message: string
  ctx: JSON | null (context object)
  created_at: TIMESTAMPTZ
}
```

---

##### `amazon_api_throttle`
Rate limiting for Amazon API calls.

```typescript
{
  id: number (PRIMARY KEY)
  day_key: string (YYYY-MM-DD)
  used_today: number
  last_call_at: TIMESTAMPTZ | null
}
```

---

#### Admin & Authentication Tables

##### `admin_users`
Admin accounts with security features.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  username: string
  email: string
  password_hash: string (bcrypt)
  two_factor_enabled: boolean | null
  two_factor_secret: string | null
  failed_login_attempts: number | null
  account_locked_until: TIMESTAMPTZ | null
  last_login: TIMESTAMPTZ | null
  created_at: TIMESTAMPTZ | null
  updated_at: TIMESTAMPTZ | null
}
```

---

##### `admin_sessions`
Admin session management.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  user_id: string | null (FK to admin_users)
  session_token: string
  ip_address: string | null
  user_agent: string | null
  created_at: TIMESTAMPTZ | null
  expires_at: TIMESTAMPTZ
}
```

---

##### `user_roles`
Role-based access control (RBAC).

```typescript
{
  id: string (UUID, PRIMARY KEY)
  user_id: string (FK to auth.users)
  role: 'admin' | 'editor' | 'viewer'
  granted_at: TIMESTAMPTZ
  granted_by: string | null (FK to auth.users)
}
```

**Has RLS policies enforcing admin-only read/write access.**

---

#### Communication & Newsletter Tables

##### `newsletter_subscribers`
Email subscribers for newsletter campaigns.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  email: string
  active: boolean
  subscribed_at: TIMESTAMPTZ
  welcome_email_sent: boolean
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

##### `email_logs`
Log of sent emails for debugging.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  type: string (e.g., 'contact-form', 'newsletter', 'welcome')
  recipient_email: string
  subject: string | null
  status: string ('pending' | 'sent' | 'failed')
  error_message: string | null
  sent_at: TIMESTAMPTZ | null
}
```

---

##### `password_reset_tokens`
Secure password reset tokens.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  user_id: string | null (FK to admin_users)
  token: string (unique, hashed)
  expires_at: TIMESTAMPTZ
  used: boolean | null
  created_at: TIMESTAMPTZ | null
}
```

---

##### `smtp_settings`
SMTP configuration for email sending.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  provider: string (e.g., 'sendgrid', 'mailgun')
  api_key: string (encrypted)
  from_email: string
  from_name: string
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

#### Analytics & Monitoring Tables

##### `analytics_data`
Aggregated analytics metrics.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  date: string (YYYY-MM-DD)
  metric_name: string (e.g., 'page_views', 'unique_users')
  metric_value: number
  dimensions: JSON | null (breakdown by page, source, etc.)
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

##### `analytics_settings`
Analytics configuration.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  enabled: boolean
  google_analytics_id: string | null
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

#### Support System Tables

##### `support_tickets`
Customer support tickets.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  ticket_number: string (e.g., TICKET-001234)
  from_email: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  category: string
  assignee_id: string | null (FK to admin_users)
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
  resolved_at: TIMESTAMPTZ | null
}
```

---

##### `support_ticket_activity`
Activity log for support tickets.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  ticket_id: string (FK to support_tickets)
  action: string ('created' | 'commented' | 'status_changed' | 'assigned')
  actor_id: string | null
  actor_type: 'admin' | 'customer'
  content: string | null
  metadata: JSON | null
  created_at: TIMESTAMPTZ
}
```

---

##### `knowledge_base_articles`
FAQ and help articles.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  title: string
  slug: string
  content: string
  category: string
  helpful_count: number
  view_count: number
  status: 'published' | 'draft'
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

##### `canned_responses`
Pre-written support responses.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  title: string
  content: string
  category: string
  usage_count: number
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

#### Command Center & Maintenance Tables

##### `command_center_activity`
Real-time activity feed for dashboard.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  activity_type: string
  description: string
  entity_type: string | null
  entity_id: string | null
  admin_id: string | null
  metadata: JSON | null
  created_at: TIMESTAMPTZ
}
```

---

##### `system_alerts`
Alerts and notifications.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  alert_type: string
  rule_name: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  is_acknowledged: boolean
  acknowledged_by: string | null
  acknowledged_at: TIMESTAMPTZ | null
  resolved_at: TIMESTAMPTZ | null
  created_at: TIMESTAMPTZ
}
```

---

##### `maintenance_schedules`
Automated maintenance task scheduling.

```typescript
{
  id: string (UUID, PRIMARY KEY)
  task_name: string
  description: string
  cron_expression: string
  is_active: boolean
  last_run_at: TIMESTAMPTZ | null
  next_run_at: TIMESTAMPTZ | null
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

### Key Relationships

```
articles
  ├── 1:N → article_products → amazon_products
  ├── 1:N → amazon_affiliate_clicks
  ├── 1:N → amazon_affiliate_stats
  ├── 1:N → amazon_search_terms
  └── N:M → article_categories

admin_users
  ├── 1:N → admin_sessions
  ├── 1:N → user_roles
  └── 1:N → support_tickets (assignee)

newsletter_subscribers
  └── 1:N → email_logs

support_tickets
  ├── 1:N → support_ticket_activity
  └── 1:1 → admin_users (assignee)
```

### Row-Level Security (RLS) Policies

**Active Policies:**
- Public read access to published articles, AI tools, projects
- Public read access to testimonials, ventures, profile settings
- Admin-only write access to all content
- Admin-only access to analytics, newsletter subscribers, SMTP settings
- User role-based access via `has_role()` security definer function
- Storage bucket: Only admins can upload to `admin-uploads`

---

## 5. Features & Functionality

### Public Features

#### 1. **Home Page**
- Hero section with introduction
- 3D animated orb (Three.js)
- Services overview cards
- Case studies section
- Testimonials carousel
- Current ventures showcase
- Newsletter signup form
- Call-to-action sections

**Files:**
- `/src/pages/Index.tsx`
- `/src/components/HeroSection.tsx`
- `/src/components/CaseStudies.tsx`
- `/src/components/Testimonials.tsx`
- `/src/components/CurrentVentures.tsx`

---

#### 2. **About Page**
- Detailed bio and experience
- Skills and expertise matrix
- Professional background
- Speaking engagements/media features
- Resume download

**File:** `/src/pages/About.tsx`

---

#### 3. **Projects Showcase**
- Project cards with technologies
- Filtering by tech stack
- Links to live projects and GitHub
- Project metrics and impact
- Featured projects highlight

**Files:**
- `/src/pages/Projects.tsx`
- `/src/components/ProjectCard.tsx`

---

#### 4. **News/Blog Articles**
- Dynamic article listing with pagination
- Search functionality across title/excerpt/tags
- Filtering by category
- Sorting (newest, oldest, most viewed)
- Filter persistence in localStorage
- Related articles sidebar

**Features:**
- Markdown rendering with syntax highlighting
- Social sharing (Twitter, Facebook, LinkedIn)
- Reading time estimation
- View count tracking
- SEO optimized metadata

**Files:**
- `/src/pages/News.tsx`
- `/src/pages/Article.tsx`
- `/src/components/MarkdownRenderer.tsx`
- `/src/components/ArticleCard.tsx`

---

#### 5. **AI Tools Directory**
- Searchable catalog of AI tools
- Filter by category, pricing, complexity
- Tool metrics and reviews
- Links to tool websites
- GitHub repository links

**File:** `/src/pages/AITools.tsx`

---

#### 6. **Contact Form**
- Name, email, message fields
- Form validation
- Spam protection (optional)
- Sends email via Edge Function
- Success/error notifications

**Files:**
- `/src/pages/Connect.tsx`
- `/src/components/ContactForm.tsx`
- `/supabase/functions/send-contact-email/index.ts`

---

#### 7. **Newsletter Signup**
- Email collection
- Subscription management
- Welcome email automation

**Files:**
- `/src/components/NewsletterSignup.tsx`
- `/supabase/functions/newsletter-signup/index.ts`

---

#### 8. **Dynamic SEO**
- Dynamic meta tags per page
- Open Graph tags for social sharing
- Schema.org structured data (Person, Organization, Article types)
- Dynamic sitemap generation
- Robots.txt with crawl directives
- Canonical URLs
- Image optimization with lazy loading

**Files:**
- `/src/components/SEO.tsx`
- `/src/pages/SitemapXML.tsx`
- `/src/pages/RobotsTxt.tsx`

---

### Admin Features

#### 1. **Admin Login & Authentication**
- Secure admin login page
- Session persistence with Supabase Auth
- Admin whitelist verification
- Rate limiting (5 attempts, 15-min lockout)
- 2FA support (infrastructure in place)

**Files:**
- `/src/pages/AdminLogin.tsx`
- `/src/contexts/AuthContext.tsx`
- `/supabase/functions/admin-auth/index.ts`

---

#### 2. **Article Manager**
- Create/edit/delete articles
- Markdown editor with preview
- SEO metadata editor (title, description, keywords)
- Social media content generator (Twitter/LinkedIn)
- Featured article toggle
- Category selection
- Tag management
- Image upload with file browser
- Publish/draft/archive workflow
- Article webhook notifications

**Features:**
- Real-time preview
- Rich text formatting
- Image optimization
- Slug auto-generation

**File:** `/src/components/admin/ArticleManager.tsx`

---

#### 3. **AI Article Generator**
- Integrate with GPT-4 via Lovable API
- Custom prompt engineering
- Batch article generation
- Content transformation (spin variations)

**File:** `/src/components/admin/AIArticleGenerator.tsx`

---

#### 4. **Project Manager**
- CRUD operations for projects
- Tech stack tagging
- GitHub links
- Project status tracking (planning, active, completed)
- Featured projects

**File:** `/src/components/admin/ProjectManager.tsx`

---

#### 5. **AI Tools Manager**
- Catalog management
- Tool categorization
- Metrics tracking (ratings, user counts)
- Pricing information management
- Feature tagging

**File:** `/src/components/admin/AIToolsManager.tsx`

---

#### 6. **Amazon Pipeline Manager**
- Configure Amazon affiliate settings
- Product research and caching
- Automated article generation with products
- Pipeline scheduling
- Run history and logs
- Performance metrics

**Features:**
- Niche targeting
- Product rating filtering
- Price range filtering
- Review requirements
- Cache-only mode for development

**Files:**
- `/src/components/admin/AmazonPipelineManager.tsx`
- `/src/components/admin/AmazonAffiliateStats.tsx`
- `/src/components/admin/AmazonReportImporter.tsx`
- `/supabase/functions/amazon-article-pipeline/index.ts`

---

#### 7. **Affiliate Tracking Dashboard**
- Click-through rate monitoring
- Revenue tracking
- Product performance analysis
- Charts and visualizations with Recharts
- Export capabilities

**File:** `/src/components/admin/AmazonAffiliateStats.tsx`

---

#### 8. **Newsletter Manager**
- Subscriber list management
- Email campaign creation
- Send campaigns via SMTP
- Unsubscribe management
- Delivery tracking

**File:** `/src/components/admin/NewsletterManager.tsx`

---

#### 9. **Testimonials Manager**
- Client testimonial management
- Photo uploads
- Rating system (1-5 stars)
- Featured testimonial selection
- Display order configuration

**File:** `/src/components/admin/TestimonialsManager.tsx`

---

#### 10. **Ventures Manager**
- Current venture/project tracking
- Launch date management
- Technology stack management
- Metrics dashboard (users, revenue)
- Status tracking (planning → live → maintenance)

**File:** `/src/components/admin/VenturesManager.tsx`

---

#### 11. **Profile Settings Manager**
- Hero tagline
- Profile photo
- Availability status
- Calendly integration
- Resume link
- Social media links
- Bio and headline
- Years of experience
- Location

**File:** `/src/components/admin/ProfileSettingsManager.tsx`

---

#### 12. **Command Center Dashboard**
- Real-time activity feed
- Quick action panels
- Revenue metrics and charts
- System health monitoring
- Smart alerts
- Admin activity logs

**Files:**
- `/src/components/admin/CommandCenterDashboard.tsx`
- `/src/components/admin/command-center/*`

---

#### 13. **Support Ticket System**
- Ticket inbox
- Ticket detail view with activity history
- Status tracking (open → resolved → closed)
- Priority levels (low → urgent)
- Assignment to admins
- Canned response library

**Features:**
- Knowledge base integration
- KB article linking
- Auto-resolution suggestions

**Files:**
- `/src/components/admin/SupportTicketDashboard.tsx`
- `/src/components/admin/support/*`

---

#### 14. **Maintenance Dashboard**
- Scheduled maintenance tasks
- Link health checking
- Database optimization
- Cache clearing
- Automated task history

**File:** `/src/components/admin/MaintenanceDashboard.tsx`

---

#### 15. **Analytics Settings**
- Google Analytics ID configuration
- Analytics enable/disable toggle
- Event tracking setup

**File:** `/src/components/admin/AnalyticsSettings.tsx`

---

#### 16. **SEO Manager**
- Meta tag templates
- Bulk SEO editing
- Keyword analysis
- SERP preview

**File:** `/src/components/admin/SEOManager.tsx`

---

#### 17. **Webhook Settings**
- Article publication webhooks
- Webhook URL configuration
- Retry logic
- Event logs

**File:** `/src/components/admin/WebhookSettings.tsx`

---

#### 18. **File Upload**
- Multi-file upload
- Image optimization
- Progress tracking
- Storage bucket integration

**File:** `/src/components/admin/FileUpload.tsx`

---

### Dashboard Views

**Menu Items:**
1. Overview - Statistics and metrics
2. Command Center - Activity feed and metrics
3. Support Tickets - Ticket management
4. Maintenance - Scheduled tasks
5. Profile - Profile settings
6. Testimonials - Testimonial management
7. Ventures - Project tracking
8. Articles - Blog/content management
9. Projects - Showcase management
10. AI Tools - Tool directory
11. Newsletter - Email campaigns
12. Analytics - Google Analytics settings
13. SEO - SEO optimization
14. Webhooks - Integration settings
15. Keyboard Shortcuts - Help

---

## 6. Frontend Architecture

### Component Hierarchy

```
App
├── ErrorBoundary
├── QueryClientProvider
├── TooltipProvider
├── BrowserRouter
└── AuthProvider
    ├── URLHandler
    ├── Analytics
    ├── ScrollTracker
    ├── RoutePrefetcher
    └── Suspense (loading fallback)
        └── Routes
            ├── Index (home page)
            ├── About
            ├── Projects
            ├── News (article list)
            ├── Article/:slug (article detail)
            ├── AITools
            ├── Connect (contact)
            ├── AdminLogin
            ├── ProtectedRoute -> AdminDashboard
            ├── Sitemap.xml
            ├── Robots.txt
            └── NotFound (404)
```

### Page Components (Lazy-Loaded)

| Page | Component | Purpose |
|------|-----------|---------|
| `/` | `Index.tsx` | Homepage |
| `/about` | `About.tsx` | Biography |
| `/projects` | `Projects.tsx` | Project showcase |
| `/news` | `News.tsx` | Article listing |
| `/news/:slug` | `Article.tsx` | Article detail |
| `/ai-tools` | `AITools.tsx` | AI tools directory |
| `/connect` | `Connect.tsx` | Contact page |
| `/admin/login` | `AdminLogin.tsx` | Admin login |
| `/admin/dashboard` | `AdminDashboard.tsx` | Admin panel |

### Reusable Components

**Layout:**
- `Navigation.tsx` - Header with navigation
- `Footer.tsx` - Footer with links
- `ErrorBoundary.tsx` - Error handling wrapper
- `SEO.tsx` - Meta tags and SEO
- `LoadingSpinner.tsx` - Loading indicator

**Content Display:**
- `ArticleCard.tsx` - Article preview card
- `ProjectCard.tsx` - Project preview card
- `MarkdownRenderer.tsx` - Markdown to React JSX
- `Testimonials.tsx` - Testimonials carousel
- `CaseStudies.tsx` - Case studies section
- `HeroSection.tsx` - Hero intro section
- `CurrentVentures.tsx` - Ventures showcase

**Interactive:**
- `Interactive3DOrb.tsx` - Three.js 3D orb
- `LightBlueOrb.tsx` - Simpler animated orb
- `ReadingProgress.tsx` - Article scroll progress bar
- `ContactForm.tsx` - Contact form
- `NewsletterSignup.tsx` - Newsletter signup
- `AffiliateLink.tsx` - Amazon affiliate link wrapper
- `AIToolSubmissionForm.tsx` - AI tool submission

**Utilities:**
- `RoutePrefetcher.tsx` - Prefetch links on hover
- `URLHandler.tsx` - URL parameter handling
- `ScrollTracker.tsx` - Track scroll depth
- `Analytics.tsx` - Google Analytics integration
- `OptimizedImage.tsx` - Lazy-loaded images

**Skeletons (Loading States):**
- `ArticleSkeleton.tsx` - Article skeleton loader
- `ProjectSkeleton.tsx` - Project skeleton loader
- `TableSkeleton.tsx` - Table skeleton loader

---

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useAuth()` | Auth context access |
| `use-toast()` | Toast notifications |
| `use-mobile()` | Mobile detection |
| `useAffiliateTracking()` | Track Amazon affiliate clicks |
| `useKeyboardShortcuts()` | Register keyboard shortcuts |
| `useReadingProgress()` | Calculate reading progress |

---

### State Management Strategy

**TanStack Query (Server State):**
```typescript
// Fetch articles with caching
const { data: articles, isLoading } = useQuery({
  queryKey: ['articles'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000,    // 10 minutes
});
```

**React Context (Auth State):**
```typescript
const { adminUser, isAdmin, signIn, signOut } = useAuth();
```

**React Hook Form (Form State):**
```typescript
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema)
});
```

**localStorage (User Preferences):**
```typescript
// News filters persist in localStorage
const [searchTerm, setSearchTerm] = useState(() => 
  localStorage.getItem('newsFilters_search') || ''
);
```

---

### Styling Architecture

**Tailwind CSS Configuration:**
- Utility-first styling
- Dark mode support (class-based)
- Custom theme colors (tech colors: cyan, blue, purple, orange, green, red)
- Custom animations (pulse-slow, float, twinkle, shimmer, etc.)
- Responsive design system

**Component Library:**
- **shadcn/ui** - Built on Radix UI
- All UI components in `/src/components/ui/`
- Full type safety with TypeScript
- Customizable and themeable

**Global Styles:**
```css
/* /src/index.css */
- Tailwind directives
- Custom CSS variables for colors
- Global font configuration
- Reset styles
```

---

### Performance Optimizations

#### 1. **Code Splitting**
- Route-based lazy loading with React.lazy()
- 60% reduction in initial bundle size
- Heavy components (Three.js, Markdown) lazy-loaded

#### 2. **Manual Chunking**
```javascript
// vite.config.ts
manualChunks: {
  'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'markdown-vendor': ['react-markdown', 'remark-gfm'],
  'form-vendor': ['react-hook-form', 'zod'],
  // ...
}
```

#### 3. **Image Optimization**
- `OptimizedImage.tsx` component with lazy loading
- Intersection Observer for viewport detection
- Responsive image sizing

#### 4. **Font Optimization**
- font-display: swap to prevent FOIT/FOUT
- Preconnect to Google Fonts

#### 5. **Resource Hints**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="dns-prefetch" href="https://cdn.example.com">
```

#### 6. **TanStack Query Caching**
- 5-minute stale time
- 10-minute garbage collection
- No refetch on window focus

---

### Error Handling

**Error Boundary Component:**
```typescript
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**Try-Catch in Async Operations:**
```typescript
try {
  const response = await supabase.from('articles').select();
} catch (error) {
  logger.error('Error:', error);
  toast({ title: 'Error', description: 'Failed to load articles' });
}
```

**Toast Notifications:**
```typescript
const { toast } = useToast();
toast({
  title: 'Success',
  description: 'Article created successfully',
  variant: 'default'
});
```

---

## 7. Backend Services (Supabase Edge Functions)

Supabase Edge Functions are serverless functions written in Deno that handle backend logic.

### Edge Function Overview

| Function | Purpose | Endpoint |
|----------|---------|----------|
| `admin-auth` | Admin login, verification, 2FA | POST `/functions/v1/admin-auth` |
| `generate-ai-article` | Generate articles with GPT-4 | POST `/functions/v1/generate-ai-article` |
| `ai-content-generator` | Generic AI content generation | POST `/functions/v1/ai-content-generator` |
| `amazon-article-pipeline` | Automated article + product generation | POST `/functions/v1/amazon-article-pipeline` |
| `generate-social-content` | Create social media content variants | POST `/functions/v1/generate-social-content` |
| `send-article-webhook` | Notify external services of new articles | POST `/functions/v1/send-article-webhook` |
| `send-contact-email` | Process contact form submissions | POST `/functions/v1/send-contact-email` |
| `newsletter-signup` | Handle newsletter subscriptions | POST `/functions/v1/newsletter-signup` |
| `maintenance-runner` | Run scheduled maintenance tasks | POST `/functions/v1/maintenance-runner` |
| `track-affiliate-click` | Log affiliate link clicks | POST `/functions/v1/track-affiliate-click` |
| `test-api-setup` | Test API configuration | POST `/functions/v1/test-api-setup` |

---

### 1. Admin Auth Function
**Path:** `/supabase/functions/admin-auth/index.ts`

**Responsibilities:**
- Admin login/logout
- Session management
- Admin whitelist verification
- Rate limiting
- 2FA operations

**Endpoints:**
```
POST /functions/v1/admin-auth
  action: 'login' | 'logout' | 'me' | '2fa-setup' | '2fa-verify'
```

**Admin Whitelist:**
```typescript
const ADMIN_EMAILS = [
  'dan@danpearson.net',
  'pearsonperformance@gmail.com'
];
```

**Security Features:**
- Rate limiting: Max 5 attempts per IP, 15-min lockout
- CORS configuration
- Session token validation

---

### 2. AI Article Generator
**Path:** `/supabase/functions/generate-ai-article/index.ts`

**Purpose:** Generate complete articles using AI

**Features:**
- Fetches from external news sources
- Transforms content with Gemini API
- Extracts and improves article content
- Generates SEO metadata
- Creates multiple content variants (Twitter, LinkedIn)

**API Integration:**
- Google Gemini 2.5 Flash via Lovable API gateway
- Authentication via LOVABLE_API_KEY

**Output:**
```typescript
{
  title: string;
  excerpt: string;
  target_keyword: string;
  seo_keywords: string[];
  seo_description: string;
  content: string;
  social_short_form: string;
  social_long_form: string;
  category: string;
  tags: string[];
}
```

---

### 3. Amazon Article Pipeline
**Path:** `/supabase/functions/amazon-article-pipeline/index.ts`

**Purpose:** Automated end-to-end article generation with Amazon products

**Process:**
1. Load pipeline settings and niches
2. Select random niche
3. Generate search term via AI
4. Research products on Amazon
5. Filter by rating, price, reviews
6. Generate article with products
7. Save article to database
8. Create article_products junction records
9. Log execution

**Features:**
- Batch processing (daily count configurable)
- Cache mode for development
- Error recovery and logging
- Product filtering (rating, price)
- Rate limiting for Amazon API

**Settings Stored in DB:**
- amazon_tag (associate tag)
- daily_post_count
- niches (target categories)
- min_rating
- price_min, price_max
- review_required
- word_count_target
- cache_only_mode

---

### 4. Content Generation Functions
- `ai-content-generator` - Generic reusable AI generation
- `generate-social-content` - Create Twitter/LinkedIn variants
- Both use GPT-4 or Gemini API

---

### 5. Email & Communication Functions
**send-contact-email:**
- Process contact form submissions
- Send confirmation email to user
- Forward to admin email
- Log email delivery

**newsletter-signup:**
- Subscribe email to newsletter
- Send welcome email
- Track subscription metrics
- Handle unsubscribes

---

### 6. Webhook Function
**send-article-webhook:**
- Notify external services when articles published
- Configurable webhook URLs
- Retry logic on failure
- Delivery logging

---

### 7. Tracking Function
**track-affiliate-click:**
- Log Amazon affiliate clicks
- Store click metadata (session, IP, referrer)
- Aggregate to amazon_affiliate_stats
- Used for revenue tracking

---

### 8. Maintenance Functions
**maintenance-runner:**
- Execute scheduled maintenance tasks
- Link health checking
- Cache clearing
- Database optimization
- Automated cleanup

---

### Edge Function Configuration
**Environment Variables Required:**
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
LOVABLE_API_KEY
ALLOWED_ORIGIN
```

**Deno Runtime:**
- Deno standard library v0.168.0
- @supabase/supabase-js v2.7.1+
- Other imports via esm.sh

---

## 8. Authentication & Authorization

### Authentication System

**Type:** Dual authentication system
1. **Supabase Auth** - For general application auth
2. **Custom Admin Auth** - Custom admin login system via Edge Function

### Admin Login Flow

```
User enters credentials
    ↓
POST /functions/v1/admin-auth { action: 'login', ... }
    ↓
Verify against admin_users table
    ↓
Check rate limiting
    ↓
Validate credentials (bcrypt password_hash)
    ↓
Check admin whitelist (ADMIN_EMAILS)
    ↓
Create session token
    ↓
Store in admin_sessions table
    ↓
Return session token + user data
    ↓
Client stores in localStorage
    ↓
AuthContext updates with adminUser
```

### AuthContext Implementation

**File:** `/src/contexts/AuthContext.tsx`

**State:**
```typescript
interface AuthContextType {
  session: Session | null;           // Supabase session
  user: User | null;                 // Supabase user
  adminUser: AdminUser | null;       // Admin user data
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<...>;
  signOut: () => Promise<void>;
  verifyAdminAccess: () => Promise<boolean>;
}
```

**Key Methods:**
- `useAuth()` - Hook to access auth context
- `verifyAdminAccess()` - Verify admin session validity
- Session persistence on mount
- Auto-logout on session expiration

### Protected Routes

**File:** `/src/components/auth/ProtectedRoute.tsx`

```typescript
<ProtectedRoute requireAdmin={true}>
  <AdminDashboard />
</ProtectedRoute>
```

- Checks `isAdmin` flag
- Redirects to login if not authenticated
- Verifies admin access on each route change

---

### Authorization

**Admin User Model:**
```typescript
interface AdminUser {
  id: string;
  email: string;
  username: string;
  two_factor_enabled: boolean;
  last_login: string | null;
  created_at: string;
}
```

**Permissions:**
- **Admin**: Full access to all dashboard features
- **Editor**: Can manage articles, projects (infrastructure in place)
- **Viewer**: Read-only access (infrastructure in place)

**Current Implementation:**
- All admin routes require `isAdmin = true`
- Admin whitelist in `admin-auth` function
- Session token validation on protected routes

**Future RBAC:**
- `user_roles` table with role assignments
- `has_role()` security definer function
- RLS policies based on user_roles

---

### Security Features

#### Password Management
- bcrypt hashing for admin passwords
- No plaintext passwords stored
- Password reset via secure tokens

#### Session Management
- Session tokens stored in `admin_sessions` table
- Configurable expiration times (default: 24 hours)
- IP address and user agent tracking

#### Rate Limiting
- Admin login: Max 5 attempts per IP per 15 minutes
- Implemented in `admin-auth` function
- Lockout period: 15 minutes

#### 2FA (Two-Factor Authentication)
- Infrastructure ready
- `two_factor_enabled` column in admin_users
- `two_factor_secret` for OTP storage
- OTPLib for generation
- QRCode for setup display

---

## 9. Testing & Quality

### Test Infrastructure

**Testing Framework:** Vitest
- Configuration: `/vitest.config.ts`
- Setup file: `/src/test/setup.ts`
- Environment: jsdom
- Coverage: v8 provider

**Test Scripts:**
```bash
npm test                 # Run tests
npm test:ui             # Run with UI
npm test:coverage       # Generate coverage report
```

### Existing Tests

| File | Type | Purpose |
|------|------|---------|
| `/src/components/__tests__/OptimizedImage.test.tsx` | Unit | Image optimization component |
| `/src/lib/__tests__/logger.test.ts` | Unit | Logger utility |
| `/src/lib/__tests__/security.test.ts` | Unit | Security validation functions |

---

### Testing Libraries

**Testing:**
- @testing-library/react
- @testing-library/jest-dom
- @testing-library/user-event

**Utilities:**
- jsdom (DOM simulation)
- vitest/ui (test interface)

---

### Code Quality

**Linting:** ESLint
```bash
npm run lint
npm run lint -- --fix    # Auto-fix issues
```

**Configuration:** `.eslintrc` with:
- TypeScript ESLint rules
- React hooks rules
- React refresh rules
- Strict type checking enabled

---

### Coverage Goals

Current: Limited (3 test files)

Target areas:
- Component rendering
- Hook behavior
- Security functions (validation, sanitization)
- API integration
- Error handling
- User interactions

---

## 10. Deployment & Configuration

### Deployment Platform: Cloudflare Pages

**Build Configuration:**
- **Build Command:** `npm run build`
- **Build Output:** `dist/`
- **Node.js Version:** 18+

**Configuration File:** `wrangler.toml`
```toml
name = "pearson-style-showcase"
pages_build_output_dir = "dist"
```

### Build Process

**Development Build:**
```bash
npm run dev       # Vite dev server at http://localhost:8080
```

**Production Build:**
```bash
npm run build      # Vite build → dist/
npm run preview    # Preview production build
```

**Build Output:**
- Minified JavaScript (esbuild)
- Gzipped CSS
- Optimized images
- Source maps (dev only)

### Environment Variables

**Required (.env file, never commit):**
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
VITE_SUPABASE_PROJECT_ID=your-project-id
```

**Optional:**
```env
# Analytics
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Note:** Variables prefixed with `VITE_` are exposed to client. Never put secrets here.

### Supabase Configuration

**Hosting:** Supabase (PostgreSQL database)
**Region:** Use your chosen region
**Authentication:** JWT-based

**Supabase Credentials:**
- Project URL
- Publishable Key (anon role)
- Service Role Key (for Edge Functions, never expose to client)

### Deployment Steps

1. **Setup Cloudflare Pages**
   - Connect GitHub repository
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node.js version: 18

2. **Environment Variables in Cloudflare**
   - Add VITE_SUPABASE_URL
   - Add VITE_SUPABASE_PUBLISHABLE_KEY
   - Add VITE_SUPABASE_PROJECT_ID

3. **Deploy**
   - Commit to GitHub
   - Cloudflare automatically triggers build and deploy
   - Production URL: https://danpearson.net

### Redirects Configuration

**For Cloudflare Pages (_redirects file):**
```
/* /index.html 200
```
Ensures client-side routing works on all routes.

---

## 11. Performance & Optimization

### Core Web Vitals Monitoring

**Implementation:** `/src/lib/performance.ts`

**Metrics Tracked:**
- **FCP** (First Contentful Paint) - When first content renders
- **LCP** (Largest Contentful Paint) - When main content renders
- **FID** (First Input Delay) - Responsiveness to user input
- **CLS** (Cumulative Layout Shift) - Visual stability
- **TTFB** (Time to First Byte) - Server response time

**Monitoring:**
```typescript
const perfObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration}ms`);
  }
});
```

---

### Bundle Size Analysis

**Current Bundle Sizes (gzipped):**
- Main bundle: ~45KB
- React vendor: ~140KB
- Three.js vendor: ~276KB (lazy-loaded)
- Markdown vendor: ~277KB (lazy-loaded)

**Optimization Strategies:**
1. **Code Splitting** - Routes lazy-loaded
2. **Vendor Chunking** - Separate heavy libraries
3. **Minification** - esbuild minification
4. **Compression** - Gzip compression
5. **Asset Optimization** - Image lazy-loading

---

### Network Optimization

**Resource Hints:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="dns-prefetch" href="https://analytics.google.com">
```

**Image Optimization:**
- OptimizedImage component with Intersection Observer
- Responsive sizing with srcset
- WebP format where supported
- Lazy loading by default

**Font Optimization:**
```css
font-display: swap; /* Use system font while loading */
```

---

### Caching Strategy

**HTTP Caching:**
- Static assets: Long cache (1 year)
- HTML: No-cache (check freshness)
- API responses: TanStack Query cache (5 min stale)

**TanStack Query Defaults:**
```typescript
staleTime: 5 * 60 * 1000,        // 5 minutes
gcTime: 10 * 60 * 1000,          // 10 minutes
retry: 1,                          // Retry once
refetchOnWindowFocus: false        // Don't refetch on focus
```

---

### Database Query Optimization

**Select Only Needed Columns:**
```typescript
// Good - fetch only needed fields
const { data } = await supabase
  .from('articles')
  .select('id, slug, title, excerpt, created_at');

// Bad - fetch everything
const { data } = await supabase
  .from('articles')
  .select('*');
```

**Indexes:**
- `idx_testimonials_featured` - For featured testimonials
- `idx_testimonials_status` - For status filtering
- `idx_ventures_featured` - For featured ventures
- `idx_ventures_status` - For status filtering

---

### Rendering Optimization

**Code Splitting:**
```typescript
const About = lazy(() => import('./pages/About'));
const Projects = lazy(() => import('./pages/Projects'));
```

**Skeleton Loading:**
- ArticleSkeleton.tsx
- ProjectSkeleton.tsx
- Prevents layout shifts

**Error Boundaries:**
- Catch rendering errors
- Display fallback UI
- Prevent white screen

---

## 12. Security Implementation

### Input Validation

**File:** `/src/lib/security.ts`

**Functions:**
- `validateTextInput()` - Text length and null byte checks
- `validateUrl()` - URL format validation (http/https only)
- `validateEmail()` - Email regex validation
- `validateSlug()` - URL-safe slug validation
- `validateJsonObject()` - JSON schema validation
- `sanitizeStringArray()` - Array input sanitization

**Example:**
```typescript
const cleaned = validateTextInput(userInput, maxLength: 1000);
if (!cleaned) {
  // Invalid input
}
```

---

### HTML Sanitization

**Library:** DOMPurify

**Configuration:**
```typescript
const sanitized = sanitizeHtml(dirty, {
  ALLOWED_TAGS: ['p', 'a', 'strong', 'em', 'h1', 'h2', ...],
  ALLOWED_ATTR: ['href', 'src', 'alt', ...],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false
});
```

**Prevents:**
- XSS (Cross-Site Scripting)
- Malicious event handlers
- Dangerous protocols (javascript:, data:, etc.)

---

### Content Security Policy (CSP)

**Headers (via Cloudflare):**
```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.example.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' https: data:;
  font-src 'self' https://fonts.gstatic.com;
```

---

### Authentication Security

**Features:**
- Secure password hashing (bcrypt)
- Session tokens (not JWTs in localStorage)
- Session expiration (24 hours default)
- HTTPS only (Cloudflare enforced)
- Rate limiting on login
- 2FA infrastructure ready

**Session Storage:**
```typescript
// Secure session in localStorage
localStorage.setItem('admin_session', sessionToken);

// Cleared on logout
localStorage.removeItem('admin_session');
```

---

### Database Security

**Row-Level Security (RLS):**
```sql
-- Example: Only admins can modify articles
CREATE POLICY "Only admins can update articles" 
ON articles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));
```

**Active Policies:**
- Public read access to articles, projects, AI tools
- Admin-only write access
- User role-based access
- Newsletter/analytics admin-only

---

### File Upload Security

**Constraints:**
- File type validation
- Size limits
- Virus scanning (via Supabase storage)
- Storage bucket RLS policies
- Only admins can upload to admin-uploads bucket

---

### API Security

**Edge Functions Security:**
- CORS headers configuration
- Rate limiting
- Input validation
- Environment variable isolation
- No sensitive data in logs
- Error message sanitization

**Example CORS:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get("ALLOWED_ORIGIN") || "https://danpearson.net",
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};
```

---

### Secrets Management

**Environment Variables:**
- Never commit .env files
- Use .env.example as template
- Cloudflare environment variables
- Supabase service role key (server-side only)
- API keys encrypted in database

---

### Logging & Monitoring

**Development Logging:**
```typescript
const logger = {
  debug: (msg, data?) => import.meta.env.DEV && console.log(msg, data),
  warn: (msg, data?) => import.meta.env.DEV && console.warn(msg, data),
  error: (msg, data?) => import.meta.env.DEV && console.error(msg, data)
};
```

**Production:**
- No sensitive data in logs
- Error tracking via Supabase
- Analytics via Google Analytics
- Email delivery logs in email_logs table

---

### Security Audit Results

**Previous Findings (SECURITY_AUDIT_REPORT.md):**
- Session persistence issues (FIXED)
- CSP header configuration (COMPLETED)
- Input validation requirements (IMPLEMENTED)
- 2FA infrastructure (ADDED)
- Rate limiting (IMPLEMENTED)

---

## Summary of Key Metrics

| Metric | Value |
|--------|-------|
| **Total Repository Size** | ~500MB (includes node_modules) |
| **Source Code Size** | 983K |
| **Backend Code Size** | 257K |
| **Database Migrations** | 24 files |
| **Pages/Routes** | 13 pages |
| **Admin Managers** | 15+ management interfaces |
| **Database Tables** | 35+ tables |
| **Edge Functions** | 11 functions |
| **React Components** | 50+ components |
| **Custom Hooks** | 5 hooks |
| **Test Files** | 3 test files |
| **Initial Bundle Size** | ~45KB (main, gzipped) |
| **Total Vendor Bundles** | ~700KB (lazy-loaded) |
| **Node.js Version** | 18+ required |
| **React Version** | 18.3.1 |
| **TypeScript Version** | 5.5.3 |

---

## 13. Comprehensive Improvement Roadmap

This section outlines strategic improvements across all aspects of the application to enhance user experience, performance, security, SEO, and mobile experience.

---

### 13.1 Feature Enhancements & New Functionality

#### High Priority Features

**1. Real-Time Collaboration Features**
- **Live Chat/Support Widget** - Integrate real-time chat for instant visitor engagement
  - Implementation: WebSocket via Supabase Realtime
  - Features: Typing indicators, read receipts, file sharing
  - Integration with support ticket system
  - Canned responses for quick replies
  - File: `/src/components/LiveChatWidget.tsx`

**2. Advanced Search & Discovery**
- **Full-Text Search** - Implement PostgreSQL full-text search
  - Index articles, projects, AI tools content
  - Fuzzy matching and typo tolerance
  - Search suggestions and autocomplete
  - Recent searches saved in localStorage
  - Search analytics tracking
  - File: `/src/components/GlobalSearch.tsx`

- **Smart Recommendations Engine**
  - "Related articles" based on content similarity
  - "You might also like" on project pages
  - User behavior tracking (views, clicks)
  - Collaborative filtering algorithm
  - A/B testing for recommendation strategies

**3. Content Personalization**
- **User Preferences System**
  - Save favorite articles/projects
  - Reading history tracking
  - Personalized content feed
  - Email digest preferences
  - Dark/light mode persistence
  - Font size preferences for accessibility

- **Bookmarking & Collections**
  - Allow visitors to bookmark content
  - Create custom collections
  - Share collections via unique URLs
  - Export bookmarks as JSON/CSV
  - Database: `user_bookmarks`, `user_collections` tables

**4. Enhanced Amazon Affiliate Features**
- **Price Tracking & Alerts**
  - Monitor product prices over time
  - Alert subscribers when prices drop
  - Price history charts with Recharts
  - Email notifications for deals
  - Database: `amazon_price_history` table

- **Product Comparison Tool**
  - Side-by-side product comparisons
  - Filterable comparison tables
  - Export comparisons as PDF
  - Share comparison links
  - Component: `/src/components/ProductComparison.tsx`

- **Affiliate Link Health Monitoring**
  - Automated link checking (404 detection)
  - Broken link reports in admin dashboard
  - Auto-update discontinued products
  - Commission rate tracking per product
  - Integration with maintenance-runner function

**5. Interactive Features**
- **Comment System**
  - Nested comment threads on articles
  - Markdown support in comments
  - Moderation dashboard
  - Spam detection (Akismet API)
  - Email notifications for replies
  - Database: `article_comments` table

- **Voting & Reactions**
  - Upvote/downvote on articles
  - Emoji reactions (👍, ❤️, 🔥, etc.)
  - "Was this helpful?" on knowledge base
  - Track most helpful content
  - Database: `content_reactions` table

- **Content Sharing**
  - Native Web Share API integration
  - Click-to-copy share links
  - Share count tracking
  - Social media preview cards
  - QR code generation for articles

**6. Advanced AI Features**
- **AI Content Assistant**
  - Article summarization on-demand
  - Key takeaways extraction
  - TL;DR generation
  - Multi-language translation
  - Audio narration (text-to-speech)

- **AI-Powered Chatbot**
  - Site navigation assistant
  - FAQ answering from knowledge base
  - Article recommendations
  - Integration with OpenAI GPT-4
  - Conversation history saved

**7. Enhanced Admin Features**
- **Bulk Operations**
  - Bulk article import from CSV
  - Bulk tag/category assignment
  - Batch publish/unpublish
  - Bulk SEO updates
  - Bulk image optimization

- **Content Scheduling**
  - Schedule articles for future publishing
  - Queue management interface
  - Recurring content (weekly digests)
  - Timezone support
  - Database: `scheduled_posts` table

- **Advanced Analytics Dashboard**
  - Traffic sources breakdown
  - Conversion funnel tracking
  - Revenue attribution (affiliate)
  - User journey mapping
  - Heatmap integration (Hotjar)
  - Custom date range comparisons

- **A/B Testing Framework**
  - Test headlines/thumbnails
  - CTA button variations
  - Layout experiments
  - Statistical significance tracking
  - Database: `ab_tests`, `ab_test_variants` tables

**8. Newsletter & Email Enhancements**
- **Email Campaign Builder**
  - Drag-and-drop email editor
  - Template library
  - A/B testing for subject lines
  - Send-time optimization
  - Engagement tracking (opens, clicks)

- **Drip Campaign Automation**
  - Welcome series for new subscribers
  - Re-engagement campaigns
  - Product recommendation emails
  - Trigger-based emails (abandoned cart)
  - Database: `email_campaigns`, `email_automations` tables

**9. Mobile App (Progressive Web App)**
- **PWA Implementation**
  - Service worker for offline support
  - Add to home screen prompt
  - Push notifications
  - Background sync for forms
  - App manifest configuration
  - File: `/public/manifest.json`

**10. Gamification Elements**
- **Reader Achievements**
  - Badges for reading milestones
  - Streaks for daily visits
  - Leaderboards for top readers
  - Share achievements on social
  - Database: `user_achievements`, `achievement_types` tables

#### Medium Priority Features

**11. Multi-Author Support**
- Author profiles with bios
- Author-specific RSS feeds
- Guest post submission workflow
- Author analytics dashboard
- Database: `authors` table with foreign keys

**12. Advanced SEO Tools**
- **Internal Linking Suggestions**
  - AI-powered link recommendations
  - Orphaned page detection
  - Link juice distribution analysis

- **Content Gap Analysis**
  - Identify missing topics
  - Competitor content analysis
  - Keyword opportunity finder
  - Integration with SEMrush/Ahrefs APIs

**13. Multimedia Enhancements**
- **Video Integration**
  - Embed YouTube/Vimeo videos
  - Video transcript generation
  - Video chapters and timestamps
  - Play tracking analytics

- **Podcast Integration**
  - Audio player component
  - Episode management
  - RSS feed for podcast directories
  - Transcript search

**14. E-Commerce Features**
- **Digital Product Sales**
  - Sell e-books, courses, templates
  - Stripe/PayPal integration
  - Download management
  - License key generation
  - Database: `products`, `orders`, `licenses` tables

---

### 13.2 Cohesion & Integration Improvements

#### Cross-Feature Integration

**1. Unified User Experience**
- **Consistent Navigation Patterns**
  - Standardize breadcrumbs across all pages
  - Unified filter/sort UI components
  - Consistent loading states
  - Uniform error messages
  - Component: `/src/components/Breadcrumbs.tsx`

- **Global State Management Optimization**
  - Migrate to Zustand or Jotai for client state
  - Reduce prop drilling
  - Persistent state across sessions
  - DevTools integration for debugging

**2. Admin Dashboard Consolidation**
- **Unified Data Tables**
  - Create reusable DataTable component
  - Consistent pagination, sorting, filtering
  - Export functionality across all tables
  - Keyboard navigation support
  - Component: `/src/components/admin/DataTable.tsx`

- **Dashboard Widget Library**
  - Reusable stat cards
  - Chart components library
  - Activity feed widget
  - Alert/notification widget
  - Draggable dashboard layout
  - Component: `/src/components/admin/DashboardWidget.tsx`

**3. Content Workflow Integration**
- **Content Lifecycle Management**
  - Draft → Review → Publish → Archive workflow
  - Content approval system
  - Version control for articles
  - Change history tracking
  - Rollback functionality
  - Database: `content_versions`, `content_workflows` tables

**4. Analytics Integration**
- **Cross-Platform Tracking**
  - Unified events across Google Analytics, Plausible
  - Custom event tracking library
  - E-commerce tracking for affiliates
  - Form submission tracking
  - Video engagement tracking
  - File: `/src/lib/analytics.ts`

**5. Notification System Unification**
- **Centralized Notification Hub**
  - In-app notification center
  - Email notification preferences
  - Push notification support
  - SMS notifications (Twilio)
  - Notification history
  - Database: `notifications`, `notification_preferences` tables

**6. AI Service Orchestration**
- **Unified AI Service Layer**
  - Abstract AI provider (GPT-4, Gemini, Claude)
  - Automatic fallback logic
  - Cost tracking per model
  - Response caching
  - Rate limiting across providers
  - File: `/src/services/AIOrchestrator.ts`

---

### 13.3 Performance Optimizations

#### Frontend Performance

**1. Bundle Size Reduction**
- **Tree Shaking Optimization**
  - Audit unused dependencies
  - Replace heavy libraries:
    - `moment` → `date-fns` (already done ✅)
    - Consider `react-markdown` alternatives
  - Remove duplicate dependencies

- **Dynamic Imports**
  - Lazy load admin dashboard components
  - Route-level code splitting (already done ✅)
  - Component-level lazy loading for modals
  - Lazy load Three.js only when visible

**2. Image Optimization**
- **Next-Gen Image Formats**
  - WebP with fallbacks
  - AVIF format support
  - Responsive image srcsets
  - Image CDN integration (Cloudinary/ImageKit)
  - Blur-up placeholder technique
  - Component enhancement: `/src/components/OptimizedImage.tsx`

- **Lazy Loading Enhancements**
  - Intersection Observer improvements
  - Blur placeholder while loading
  - Progressive image loading
  - Priority loading for above-fold images

**3. Font Optimization**
- **Variable Fonts**
  - Use variable fonts to reduce requests
  - Subset fonts to include only used glyphs
  - Self-host Google Fonts
  - WOFF2 format only (drop WOFF)

**4. CSS Optimization**
- **Tailwind Purging**
  - Verify unused CSS removal
  - Use PurgeCSS configuration
  - Critical CSS extraction
  - Inline critical CSS in HTML

- **CSS-in-JS Optimization**
  - Minimize runtime CSS generation
  - Use CSS variables for theming
  - Avoid dynamic styles when possible

**5. JavaScript Optimization**
- **React Performance**
  - Implement React.memo strategically
  - useMemo/useCallback for expensive operations
  - Virtual scrolling for long lists (react-window)
  - Pagination for large datasets
  - Debounce search inputs

- **Web Workers**
  - Offload heavy computations to workers
  - Background data processing
  - Image manipulation in workers
  - Large file parsing (CSV imports)

**6. Network Performance**
- **HTTP/2 & HTTP/3**
  - Verify HTTP/2 push (via Cloudflare)
  - Enable HTTP/3 (QUIC) if available
  - Multiplexing benefits

- **Resource Hints**
  - Preconnect to critical origins
  - DNS prefetch for third-party domains
  - Prefetch next-page navigation
  - Preload critical resources

- **Caching Strategy**
  - Service Worker with Workbox
  - Offline-first architecture
  - Stale-while-revalidate pattern
  - Cache versioning strategy
  - File: `/public/sw.js`

**7. API & Database Performance**
- **Database Optimization**
  - Add missing indexes:
    ```sql
    CREATE INDEX idx_articles_slug ON articles(slug);
    CREATE INDEX idx_articles_published_created ON articles(published, created_at DESC);
    CREATE INDEX idx_articles_category ON articles(category);
    CREATE INDEX idx_projects_published ON projects(published);
    ```
  - Query optimization (use EXPLAIN ANALYZE)
  - Connection pooling configuration
  - Read replicas for heavy reads

- **API Response Optimization**
  - GraphQL for flexible queries (vs REST)
  - Field-level selection (already doing ✅)
  - Response compression (gzip/brotli)
  - Pagination with cursor-based navigation
  - ETags for cache validation

- **Edge Functions Performance**
  - Cold start mitigation (keep-alive pings)
  - Response streaming for large payloads
  - Edge caching with Cloudflare KV
  - Minimize Edge Function dependencies

**8. Third-Party Script Management**
- **Script Loading Strategy**
  - Defer non-critical scripts
  - Async loading for analytics
  - Self-host tracking scripts
  - Use Partytown for heavy scripts (in Web Worker)

**9. Monitoring & Measurement**
- **Real User Monitoring (RUM)**
  - Track actual user performance
  - Core Web Vitals reporting
  - Browser/device segmentation
  - Integration: SpeedCurve or Sentry Performance

- **Synthetic Monitoring**
  - Automated Lighthouse CI
  - Performance budgets
  - Regression alerts
  - Tool: Lighthouse CI + GitHub Actions

---

### 13.4 Security Hardening

#### Application Security

**1. Advanced Authentication**
- **Multi-Factor Authentication (MFA)**
  - Complete 2FA implementation (infrastructure exists)
  - SMS-based 2FA via Twilio
  - Authenticator app support (TOTP)
  - Backup codes generation
  - Recovery email verification

- **OAuth Integration**
  - Google/GitHub OAuth login
  - Social login for comments
  - Supabase Auth providers
  - Unified user identity

- **Session Security**
  - Implement session rotation
  - Device fingerprinting
  - IP-based anomaly detection
  - Concurrent session limits
  - Force logout on password change

**2. API Security**
- **Rate Limiting Enhancement**
  - Per-user rate limits
  - Per-endpoint rate limits
  - Distributed rate limiting (Redis)
  - DDoS protection via Cloudflare
  - Database: `rate_limit_log` table

- **API Key Management**
  - Rotate API keys programmatically
  - Key expiration policies
  - Scoped permissions per key
  - Key usage analytics
  - Database: `api_keys` table

**3. Input Validation & Sanitization**
- **Enhanced Validation**
  - Implement Zod schemas everywhere
  - Server-side validation on Edge Functions
  - File upload validation (MIME type, size, content)
  - SQL injection prevention (parameterized queries)
  - NoSQL injection prevention

- **Content Security**
  - Strict CSP headers refinement
  - Remove `unsafe-inline` gradually
  - Implement nonces for inline scripts
  - Subresource Integrity (SRI) for CDN assets
  - Trusted Types API for DOM manipulation

**4. Data Protection**
- **Encryption at Rest**
  - Encrypt sensitive database fields
  - Use Supabase Vault for secrets
  - PII encryption (email, phone)
  - Encryption key rotation

- **Encryption in Transit**
  - Enforce HTTPS everywhere (HSTS)
  - TLS 1.3 minimum
  - Certificate pinning for APIs
  - Secure WebSocket connections

**5. Dependency Security**
- **Automated Vulnerability Scanning**
  - npm audit automation
  - Dependabot alerts
  - Snyk integration
  - Automated dependency updates
  - GitHub Actions: security-scan.yml

- **Supply Chain Security**
  - Lock file integrity checks
  - Subresource Integrity (SRI)
  - Package signature verification
  - Private npm registry for internal packages

**6. Access Control**
- **Fine-Grained RBAC**
  - Implement role hierarchy (admin > editor > viewer)
  - Permission-based access (read, write, delete)
  - Resource-level permissions
  - RLS policy refinement
  - Database: Expand `user_roles` with `permissions` JSONB

**7. Audit Logging**
- **Comprehensive Audit Trail**
  - Log all admin actions
  - Track data modifications (who, what, when)
  - Login/logout events
  - Failed access attempts
  - Export audit logs
  - Database: `audit_logs` table with JSONB metadata

**8. Security Headers**
- **Header Hardening**
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: restrictive
  - HSTS with preload
  - File: `/public/_headers` (Cloudflare)

**9. Regular Security Audits**
- **Penetration Testing**
  - Annual third-party security audit
  - OWASP Top 10 compliance
  - Automated security testing (OWASP ZAP)
  - Bug bounty program (HackerOne)

---

### 13.5 SEO Optimization

#### Technical SEO

**1. Core Web Vitals Optimization**
- **LCP (Largest Contentful Paint)**
  - Optimize hero images
  - Preload critical resources
  - Reduce server response time (TTFB < 200ms)
  - Use CDN for assets
  - Target: LCP < 2.5s

- **FID (First Input Delay)**
  - Minimize JavaScript execution time
  - Code split heavy bundles
  - Defer third-party scripts
  - Use Web Workers for heavy tasks
  - Target: FID < 100ms

- **CLS (Cumulative Layout Shift)**
  - Reserve space for images (aspect-ratio)
  - Reserve space for ads/embeds
  - Avoid dynamic content above-fold
  - Use CSS transforms for animations
  - Target: CLS < 0.1

**2. Structured Data Enhancement**
- **Rich Snippets**
  - Article schema with author, images
  - FAQ schema for Q&A content
  - HowTo schema for tutorials
  - BreadcrumbList schema
  - Organization schema
  - Person schema for author profiles
  - Product schema for affiliate products
  - Review schema for testimonials

- **Schema Validation**
  - Automated schema testing
  - Google Rich Results Test integration
  - Schema.org validation
  - File: `/src/lib/structuredData.ts`

**3. Sitemap Enhancements**
- **Dynamic Sitemap Generation**
  - Image sitemap
  - Video sitemap
  - News sitemap (for recent articles)
  - Priority and changefreq optimization
  - Lastmod timestamp accuracy
  - File: `/src/pages/SitemapXML.tsx` (enhance)

- **Sitemap Index**
  - Split large sitemaps (>50k URLs)
  - Separate sitemaps per content type
  - Automated submission to Google/Bing

**4. Internal Linking Strategy**
- **Automated Internal Links**
  - Contextual link insertion in content
  - Related posts linking
  - Pillar page strategy
  - Topic cluster organization
  - Breadcrumb navigation

- **Link Analytics**
  - Track internal link clicks
  - Identify orphaned pages
  - PageRank distribution analysis
  - Tool: Custom internal linking dashboard

**5. Content Optimization**
- **SEO Content Analysis**
  - Keyword density checker
  - Readability score (Flesch-Kincaid)
  - Content length recommendations
  - Heading structure analysis
  - Meta description optimization
  - Component: `/src/components/admin/SEOAnalyzer.tsx`

- **Duplicate Content Detection**
  - Canonical URL management
  - Pagination handling (rel="next/prev")
  - Parameter handling (?utm_source, etc.)
  - Content similarity detection

**6. Mobile SEO**
- **Mobile-First Indexing Optimization**
  - Responsive design validation
  - Mobile usability testing
  - Touch target sizing (44x44px min)
  - Viewport configuration
  - Mobile page speed optimization

**7. International SEO (Future)**
- **Multi-Language Support**
  - Hreflang tags
  - Language-specific URLs
  - Translated content management
  - Localized metadata
  - Currency/date localization

**8. URL Optimization**
- **Clean URL Structure**
  - Short, descriptive URLs
  - Remove stop words
  - Lowercase and hyphenated
  - Avoid parameters when possible
  - 301 redirects for changed URLs
  - Database: `url_redirects` table

**9. Image SEO**
- **Image Optimization**
  - Descriptive filenames
  - Alt text for all images
  - Image compression (TinyPNG/ImageOptim)
  - Lazy loading implementation
  - Image sitemap inclusion

**10. Local SEO (if applicable)**
- **Local Business Optimization**
  - Google Business Profile integration
  - LocalBusiness schema
  - NAP consistency (Name, Address, Phone)
  - Location pages
  - Local backlink building

**11. SEO Monitoring**
- **Rank Tracking**
  - Keyword position monitoring
  - SERP feature tracking
  - Competitor analysis
  - Integration: SEMrush/Ahrefs API
  - Dashboard: `/src/components/admin/SEORankings.tsx`

- **Search Console Integration**
  - Automated error monitoring
  - Index coverage tracking
  - Query performance analysis
  - API integration for data display

---

### 13.6 Mobile-First Refinements

#### Mobile User Experience

**1. Touch Optimization**
- **Touch Target Sizing**
  - Minimum 44x44px for all interactive elements
  - Increased spacing between buttons
  - Larger form inputs on mobile
  - Swipe gestures for carousels
  - Pull-to-refresh functionality

**2. Mobile Navigation**
- **Hamburger Menu Enhancement**
  - Slide-out drawer animation
  - Touch-friendly menu items
  - Search in mobile menu
  - Nested menu support
  - Gesture-based close (swipe)
  - Component: `/src/components/MobileNavigation.tsx`

- **Bottom Navigation Bar**
  - Sticky bottom nav for key actions
  - Icons with labels
  - Active state indicators
  - Haptic feedback (if supported)

**3. Mobile Performance**
- **Adaptive Loading**
  - Serve smaller images on mobile
  - Reduce animations on low-end devices
  - Lazy load below-the-fold content
  - Network-aware loading (slow 3G detection)
  - Battery-aware features

- **Mobile-Specific Optimizations**
  - Reduced JavaScript for mobile
  - Mobile-specific CSS
  - Disable hover effects on touch devices
  - Optimize font sizes for readability

**4. Form Optimization**
- **Mobile Form UX**
  - Appropriate input types (tel, email, number)
  - Autocomplete attributes
  - Single-column layout
  - Inline validation
  - Large, tappable submit buttons
  - Floating labels
  - Component: `/src/components/MobileForm.tsx`

**5. Mobile Content Layout**
- **Reading Experience**
  - Optimal line length (50-75 characters)
  - Larger font sizes (16px minimum)
  - Increased line height (1.5-1.7)
  - Readable contrast ratios (4.5:1 min)
  - Reader mode support

- **Card-Based Layout**
  - Swipeable cards for articles
  - Stack layout for mobile
  - Infinite scroll with pagination fallback
  - Skeleton screens while loading

**6. Mobile Gestures**
- **Swipe Navigation**
  - Swipe between articles
  - Swipe to dismiss modals
  - Pull-down to refresh
  - Pinch to zoom on images
  - Library: Hammer.js or React Spring

**7. Offline Support**
- **Progressive Web App (PWA)**
  - Service worker implementation
  - Offline page fallback
  - Cache articles for offline reading
  - Background sync for forms
  - Add to home screen prompt
  - File: `/public/sw.js`, `/public/manifest.json`

**8. Mobile Media**
- **Responsive Images**
  - Picture element with multiple sources
  - Art direction for mobile crops
  - Lazy loading with loading="lazy"
  - Blur-up placeholders

- **Video Optimization**
  - Lazy load videos
  - Poster images for videos
  - Auto-pause on scroll out
  - Mobile-friendly controls

**9. Mobile Accessibility**
- **Screen Reader Optimization**
  - ARIA labels on mobile
  - Semantic HTML structure
  - Focus management for modals
  - Skip navigation links
  - Live regions for dynamic content

- **Voice Navigation**
  - Voice search integration
  - Voice commands for actions
  - Text-to-speech for articles
  - Integration: Web Speech API

**10. Mobile Analytics**
- **Mobile-Specific Tracking**
  - Device type segmentation
  - Screen size analytics
  - Touch vs mouse interaction
  - Mobile conversion tracking
  - App install tracking (PWA)

**11. Safe Area Support**
- **Notch & Bottom Bar Handling**
  - CSS environment variables
  - Safe area insets
  - Full-screen support
  - iOS Safari compatibility
  - Android gesture navigation support

```css
.header {
  padding-top: env(safe-area-inset-top);
}
.footer {
  padding-bottom: env(safe-area-inset-bottom);
}
```

**12. Mobile Testing**
- **Cross-Device Testing**
  - BrowserStack integration
  - Real device testing
  - Emulator testing
  - Responsive design testing
  - Touch event debugging

---

### 13.7 Accessibility Improvements

#### WCAG 2.1 AA Compliance

**1. Keyboard Navigation**
- Skip to content links
- Focus indicators on all interactive elements
- Keyboard shortcuts documentation
- Tab order optimization
- Escape key to close modals

**2. Screen Reader Support**
- ARIA landmarks and labels
- Live regions for dynamic content
- Alt text for all images
- Form labels and descriptions
- Announcement of state changes

**3. Color Contrast**
- WCAG AA contrast ratios (4.5:1 text, 3:1 UI)
- High contrast mode support
- Color-blind friendly palettes
- Avoid color-only indicators

**4. Text Accessibility**
- Resizable text up to 200%
- No text in images
- Clear heading hierarchy
- Readable fonts
- Line spacing controls

---

### 13.8 Developer Experience

**1. Development Tooling**
- **Storybook Integration**
  - Component library documentation
  - Visual regression testing
  - Isolated component development
  - Accessibility addon

**2. Code Quality**
- **Pre-commit Hooks**
  - Husky + lint-staged
  - Automatic code formatting (Prettier)
  - Lint checks before commit
  - Type checking

**3. CI/CD Pipeline**
- **Automated Testing**
  - Unit test suite
  - Integration tests
  - E2E tests with Playwright
  - Visual regression tests
  - Performance tests

- **Deployment Automation**
  - Preview deployments for PRs
  - Automated rollbacks
  - Deployment notifications
  - Smoke tests post-deployment

---

### 13.9 Analytics & Business Intelligence

**1. Custom Analytics Dashboard**
- Revenue attribution
- Content performance metrics
- User engagement tracking
- Conversion funnel analysis
- Cohort analysis

**2. Predictive Analytics**
- Content success prediction
- Revenue forecasting
- User churn prediction
- Trend identification

---

### Priority Matrix

| Priority | Category | Items |
|----------|----------|-------|
| **P0 (Critical)** | Performance | Core Web Vitals, Bundle size, Image optimization |
| **P0 (Critical)** | Security | 2FA completion, Rate limiting, Security headers |
| **P0 (Critical)** | Mobile | Touch optimization, Mobile navigation, PWA basics |
| **P1 (High)** | Features | Search, Recommendations, Comments, Price tracking |
| **P1 (High)** | SEO | Structured data, Internal linking, Content optimization |
| **P1 (High)** | Cohesion | Unified components, Analytics integration |
| **P2 (Medium)** | Features | Chatbot, A/B testing, Email campaigns |
| **P2 (Medium)** | Performance | Web Workers, Service Worker, Database indexes |
| **P3 (Low)** | Features | Gamification, Multi-language, Podcast integration |

---

## Document Information

- **Version:** 2.0
- **Last Updated:** November 13, 2025
- **Maintainers:** Dan Pearson
- **Status:** Active Development
- **License:** Private/Proprietary

---

## Next Steps & Roadmap

### Planned Features
1. Enhanced analytics dashboard
2. A/B testing framework
3. Multi-language support
4. Advanced caching strategies
5. API rate limiting improvements
6. Comprehensive test coverage
7. Performance monitoring dashboard
8. Advanced SEO tools

### Technical Debt
- Expand test coverage (currently 3 test files)
- Implement comprehensive error handling
- Add monitoring and alerting
- Document API endpoints
- Create admin user roles (currently all-or-nothing)

---

