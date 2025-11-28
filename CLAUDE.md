# CLAUDE.md - AI Assistant Guide for Dan Pearson Portfolio

> **Purpose**: This document provides comprehensive guidance for AI assistants (like Claude) working on the Dan Pearson portfolio/showcase repository. It explains the codebase structure, conventions, workflows, and best practices to follow.

**Last Updated**: 2025-11-28
**Repository**: pearson-style-showcase
**Primary Branch**: main
**Tech Stack**: React 18 + TypeScript + Vite + Supabase + Tailwind CSS

---

## Table of Contents

1. [Repository Overview](#repository-overview)
2. [Tech Stack & Dependencies](#tech-stack--dependencies)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Code Patterns & Conventions](#code-patterns--conventions)
6. [Key Architectural Decisions](#key-architectural-decisions)
7. [Security Practices](#security-practices)
8. [Testing Approach](#testing-approach)
9. [Common Tasks](#common-tasks)
10. [Important Files](#important-files)
11. [Things to Avoid](#things-to-avoid)
12. [Troubleshooting](#troubleshooting)

---

## Repository Overview

### What This Project Is

A modern, full-stack portfolio and content management system featuring:
- **AI-powered article generation** using GPT-4
- **Amazon affiliate marketing automation** with product research and revenue tracking
- **Comprehensive admin dashboard** for content management
- **Full accounting/financial tracking module** with reports, invoices, and tax tools
- **Role-Based Access Control (RBAC)** with database-driven whitelist and permissions
- **SEO-optimized** public-facing website with structured data and AI search optimization
- **3D interactive elements** using Three.js with GSAP animations
- **Performance-first architecture** with code splitting, lazy loading, and PageSpeed optimizations
- **OAuth authentication support** with state machine architecture

### Target Platform

- **Hosting**: Cloudflare Pages
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Build**: Static site generation with client-side routing
- **Node Version**: 18+ required

### Key Features

- Public portfolio site (homepage, about, projects, news, AI tools)
- Admin dashboard with RBAC authentication and OAuth support
- AI article generator with GPT-4 integration
- Amazon affiliate pipeline automation
- **Comprehensive accounting module**:
  - Chart of Accounts management
  - Invoices and payments tracking
  - Journal entries and financial reports (P&L, Balance Sheet)
  - IRS Schedule C tax reporting
  - Document upload with OCR and AI parsing
  - CSV export functionality
- Newsletter management
- Analytics tracking
- Contact form handling
- SEO tools (sitemap, robots.txt, structured data, internal linking)
- Interactive 3D hero section with GSAP animations

---

## Tech Stack & Dependencies

### Core Framework

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "typescript": "^5.5.3",
  "vite": "^6.1.7"
}
```

**Important**: This is a **functional component, hooks-based** React application. No class components are used.

### Routing & State

- **react-router-dom** (v6.26.2): Client-side routing with lazy loading
- **@tanstack/react-query** (v5.56.2): Server state management, caching, and data fetching

### Backend Integration

- **@supabase/supabase-js** (v2.51.0): PostgreSQL database and Edge Functions
- **Database**: 20+ tables with Row Level Security enabled
- **Edge Functions**: 18 Deno-based serverless functions

### UI & Styling

- **Tailwind CSS** (v3.4.11): Utility-first CSS framework
- **shadcn/ui**: 48 Radix UI-based accessible components
- **lucide-react** (v0.462.0): Icon library
- **next-themes**: Dark/light mode theming
- **class-variance-authority**: Component variant styling

### Forms & Validation

- **react-hook-form** (v7.60.0): Form state management
- **zod** (v3.25.76): Schema validation
- **@hookform/resolvers**: Form validation integration

### Content Rendering

- **react-markdown** (v10.1.0): Markdown to React components
- **remark-gfm**: GitHub Flavored Markdown support
- **react-syntax-highlighter**: Code syntax highlighting
- **dompurify** (v3.2.7): HTML sanitization

### 3D Graphics & Animations

- **three** (v0.178.0): 3D graphics library
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Helper components for React Three Fiber
- **gsap** (v3.13.0): GreenSock Animation Platform for high-performance animations
- **@gsap/react** (v2.1.2): React integration for GSAP

### Testing

- **vitest** (v4.0.8): Test runner
- **@testing-library/react** (v16.3.0): Component testing
- **@testing-library/jest-dom**: DOM matchers
- **jsdom**: DOM implementation for testing

### Authentication & Security

- **otplib** (v12.0.1): One-time password library for 2FA
- **qrcode** (v1.5.3): QR code generation for authenticator apps
- **input-otp** (v1.2.4): OTP input component

### File Handling

- **react-dropzone** (v14.3.8): Drag-and-drop file uploads

### Other Key Libraries

- **date-fns**: Date manipulation
- **recharts**: Data visualization
- **sonner**: Toast notifications
- **cmdk**: Command palette
- **lucide-react** (v0.462.0): Icon library

---

## Project Structure

### Directory Overview

```
pearson-style-showcase/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui components (48 files)
│   │   ├── admin/          # Admin dashboard components (28 files)
│   │   │   ├── command-center/
│   │   │   ├── support/
│   │   │   ├── accounting/ # Financial tracking module (13 files)
│   │   │   │   ├── FinancialOverview.tsx
│   │   │   │   ├── ChartOfAccountsManager.tsx
│   │   │   │   ├── JournalEntriesManager.tsx
│   │   │   │   ├── PaymentsManager.tsx
│   │   │   │   ├── InvoicesManager.tsx
│   │   │   │   ├── ContactsManager.tsx
│   │   │   │   ├── FinancialReports.tsx
│   │   │   │   ├── TaxReports.tsx
│   │   │   │   ├── DocumentUpload.tsx
│   │   │   │   └── [4 more...]
│   │   │   ├── AccessReviewReport.tsx    # RBAC compliance
│   │   │   ├── ActivityLogViewer.tsx     # User activity tracking
│   │   │   └── [managers for articles, projects, etc.]
│   │   ├── SEO/            # SEO-related components
│   │   ├── article/        # Article-specific components
│   │   ├── auth/           # Authentication components
│   │   ├── homepage/       # Homepage sections (FAQSection, AuthoritySection)
│   │   ├── skeletons/      # Loading states
│   │   ├── HeroSection.tsx       # GSAP-animated hero with 3D orb
│   │   ├── Interactive3DOrb.tsx  # Three.js interactive orb
│   │   ├── RoutePrefetcher.tsx   # Route prefetching for performance
│   │   └── __tests__/      # Component tests
│   ├── pages/              # Route-level components
│   │   ├── Index.tsx       # Homepage
│   │   ├── About.tsx
│   │   ├── Projects.tsx
│   │   ├── News.tsx
│   │   ├── Article.tsx
│   │   ├── AITools.tsx
│   │   ├── Connect.tsx
│   │   ├── DateArchive.tsx # NEW: Date-based article archives
│   │   ├── AdminLogin.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── SitemapXML.tsx
│   │   ├── RobotsTxt.tsx
│   │   └── NotFound.tsx
│   ├── hooks/              # Custom React hooks (8 files)
│   │   ├── use-toast.ts
│   │   ├── use-mobile.tsx
│   │   ├── useAffiliateTracking.ts
│   │   ├── useGlobalSearch.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useReadingProgress.ts
│   │   ├── usePermission.ts        # NEW: RBAC permission checking
│   │   └── useDeviceCapabilities.ts # NEW: Device capability detection
│   ├── integrations/       # External service integrations
│   │   └── supabase/
│   │       ├── client.ts   # Supabase client setup
│   │       └── types.ts    # Auto-generated DB types (3619 lines)
│   ├── contexts/           # React contexts
│   │   └── AuthContext.tsx # Auth with state machine & OAuth support
│   ├── services/           # Business logic
│   │   └── accounting/
│   │       └── importers.ts # Financial data import utilities
│   ├── lib/                # Utility libraries
│   │   ├── security.ts     # Input validation & sanitization
│   │   ├── performance.ts  # Core Web Vitals monitoring
│   │   ├── registerSW.ts   # Service worker
│   │   ├── logger.ts       # Dev-only logging
│   │   └── utils.ts        # General utilities
│   ├── test/
│   │   └── setup.ts        # Test configuration
│   ├── App.tsx             # Root component with routing
│   ├── main.tsx            # Application entry point
│   ├── index.css           # Global styles (590 lines)
│   └── vite-env.d.ts       # Vite type definitions
├── supabase/
│   ├── functions/          # Edge Functions (18 total)
│   │   ├── admin-auth/
│   │   ├── generate-ai-article/
│   │   ├── amazon-article-pipeline/
│   │   ├── track-affiliate-click/
│   │   ├── send-contact-email/
│   │   ├── newsletter-signup/
│   │   ├── process-accounting-document/  # NEW: OCR & AI parsing
│   │   ├── maintenance-runner/           # NEW: Scheduled tasks
│   │   └── [10 more...]
│   └── migrations/         # Database schema migrations
├── public/                 # Static assets
│   ├── robots.txt
│   └── [images, fonts, etc.]
├── dist/                   # Build output (gitignored)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── vitest.config.ts
└── README.md
```

### File Naming Conventions

- **Components**: PascalCase (e.g., `ArticleCard.tsx`, `NewsletterSignup.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAffiliateTracking.ts`)
- **Utilities**: camelCase (e.g., `security.ts`, `performance.ts`)
- **Pages**: PascalCase matching route names (e.g., `Index.tsx`, `AdminDashboard.tsx`)
- **Tests**: `[ComponentName].test.tsx` pattern
- **Types**: `types.ts` (exports interfaces/types in PascalCase)

---

## Development Workflow

### Setup & Installation

```bash
# Install dependencies
npm install

# Start development server (http://localhost:8080)
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run linter
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

### Branch Strategy

- **main**: Production branch (auto-deploys to Cloudflare Pages)
- **claude/[feature]-[session-id]**: AI assistant feature branches
- **Feature branches**: `feature/[name]` for manual development

### Commit Message Convention

Follow **conventional commits**:

```
feat: Add dark mode toggle to settings
fix: Resolve hydration error in article page
docs: Update README with deployment instructions
style: Format code with Prettier
refactor: Extract article logic into custom hook
perf: Optimize Three.js scene rendering
test: Add unit tests for security utilities
chore: Update dependencies to latest versions
```

### Git Workflow for AI Assistants

When working on tasks:

1. **Check current branch**: Should be on `claude/[task]-[session-id]`
2. **Make changes**: Edit files, test locally
3. **Run linter**: `npm run lint` to catch issues
4. **Build test**: `npm run build` to ensure production build works
5. **Commit with clear messages**: Use conventional commit format
6. **Push to branch**: `git push -u origin <branch-name>`

**IMPORTANT**: Never push to `main` directly. Always work on feature branches.

### Adding New Pages

1. Create component in `src/pages/YourPage.tsx`
2. Add lazy import in `src/App.tsx`:
   ```typescript
   const YourPage = lazy(() => import("./pages/YourPage"));
   ```
3. Add route in `src/App.tsx`:
   ```typescript
   <Route path="/your-page" element={<YourPage />} />
   ```
4. Add SEO component with proper meta tags
5. Update sitemap generation if needed (`src/pages/SitemapXML.tsx`)

### Adding shadcn/ui Components

```bash
npx shadcn-ui@latest add [component-name]
```

This downloads the component source to `src/components/ui/` where it can be customized.

---

## Code Patterns & Conventions

### Component Structure

**Functional components with TypeScript**:

```typescript
import React from 'react';
import { Button } from '@/components/ui/button';

interface ComponentProps {
  title: string;
  description?: string;
  onClick?: () => void;
}

const Component: React.FC<ComponentProps> = ({ title, description, onClick }) => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description && <p className="text-gray-600">{description}</p>}
      <Button onClick={onClick}>Click me</Button>
    </div>
  );
};

export default Component;
```

**Key patterns**:
- Always define prop interfaces
- Use optional chaining for optional props
- Export as default for route components
- Named exports for utility components

### Import Patterns

**Always use path aliases**:

```typescript
// ✅ Good - Use @ alias
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { validateEmail } from '@/lib/security';

// ❌ Bad - Avoid deep relative imports
import { Button } from '../../../components/ui/button';
```

**Import order** (recommended):

1. React imports
2. Third-party libraries
3. Local components (using `@/components`)
4. Hooks (using `@/hooks`)
5. Utils/lib (using `@/lib`)
6. Types
7. CSS

### State Management

**Server state with TanStack Query**:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fetching data
const { data: articles, isLoading, error } = useQuery({
  queryKey: ['articles'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000,   // 10 minutes (formerly cacheTime)
});

// Mutating data
const queryClient = useQueryClient();

const createArticleMutation = useMutation({
  mutationFn: async (newArticle: ArticleInput) => {
    const { data, error } = await supabase
      .from('articles')
      .insert(newArticle)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['articles'] });
  },
});
```

**Local state with useState**:

```typescript
const [isOpen, setIsOpen] = useState(false);
const [formData, setFormData] = useState({ name: '', email: '' });
```

**Global state with Context**:

```typescript
// Only use for truly global state (auth, theme, etc.)
import { useAuth } from '@/contexts/AuthContext';

const { user, signIn, signOut } = useAuth();
```

### Routing Patterns

**Lazy loading for code splitting** (CRITICAL for performance):

```typescript
// App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const About = lazy(() => import("./pages/About"));
const Article = lazy(() => import("./pages/Article"));

<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/about" element={<About />} />
    <Route path="/news/:slug" element={<Article />} />
  </Routes>
</Suspense>
```

**Protected routes**:

```typescript
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

<Route
  path="/admin/dashboard"
  element={
    <ProtectedRoute requireAdmin={true}>
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
```

**Accessing route params**:

```typescript
import { useParams } from 'react-router-dom';

const Article = () => {
  const { slug } = useParams<{ slug: string }>();
  // ...
};
```

### Form Handling

**React Hook Form + Zod validation**:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

type FormData = z.infer<typeof formSchema>;

const MyForm = () => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      name: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    // Handle form submission
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
};
```

### Error Handling

**Async operations**:

```typescript
try {
  const { data, error } = await supabase
    .from('articles')
    .select('*');

  if (error) throw error;

  return data;
} catch (error) {
  logger.error('Failed to fetch articles:', error);
  // Show user-friendly error message
  toast.error('Failed to load articles. Please try again.');
  return null;
}
```

**Query error handling**:

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['article', slug],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Article not found');

    return data;
  },
});

if (error) {
  return <ErrorMessage message="Failed to load article" />;
}
```

### Styling Conventions

**Tailwind-first approach**:

```tsx
// ✅ Good - Use Tailwind classes
<div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-md">
  <h2 className="text-2xl font-bold text-gray-900">Title</h2>
  <p className="text-gray-600">Description</p>
</div>

// ✅ Also good - Combine with cn() utility for conditional classes
import { cn } from '@/lib/utils';

<div className={cn(
  "px-4 py-2 rounded-md",
  isActive && "bg-blue-500 text-white",
  !isActive && "bg-gray-100 text-gray-700"
)}>
  Content
</div>
```

**Responsive design (mobile-first)**:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Base: 1 column, sm: 2 columns, lg: 3 columns */}
</div>

<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold">
  {/* Progressive text sizing */}
</h1>
```

**Custom CSS only when necessary**:

```css
/* index.css - Use for global styles, animations, custom properties */
:root {
  --primary: 195 100% 50%;
  --tech-cyan: 195 100% 50%;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.floating-element {
  animation: float 4s ease-in-out infinite;
}
```

### Type Definitions

**Supabase types** (auto-generated from database schema):

```typescript
import { Tables } from '@/integrations/supabase/types';

type Article = Tables<'articles'>;
type Project = Tables<'projects'>;

// Using in components
const article: Article = {
  id: '123',
  title: 'My Article',
  slug: 'my-article',
  // ... other fields
};
```

**Component props**:

```typescript
interface ArticleCardProps {
  article: Tables<'articles'>;
  showExcerpt?: boolean;
  onSelect?: (article: Tables<'articles'>) => void;
}
```

**Custom types**:

```typescript
// For API responses, form data, etc.
interface SEOData {
  title?: string;
  description?: string;
  keywords?: string;
  url?: string;
  type?: 'website' | 'article' | 'person';
  structuredData?: Record<string, unknown>;
}
```

---

## Key Architectural Decisions

### 1. Code Splitting Strategy

**Why**: Reduce initial bundle size for faster page loads

**How**:
- Route-based lazy loading (all pages except Index)
- Vendor chunking (React, Three.js, Markdown)
- Dynamic imports for heavy libraries

**Result**: Main bundle ~45KB gzipped, Three.js lazy-loaded only when needed

### 2. Supabase for Backend

**Why**: Serverless, PostgreSQL-based, Edge Functions for API endpoints

**Benefits**:
- No backend server to maintain
- Row Level Security for data access control
- Real-time subscriptions (if needed)
- Edge Functions deployed globally

**Trade-offs**:
- Vendor lock-in
- Free tier limitations (pause after inactivity)

### 3. Custom Admin Authentication

**Why**: Need whitelist-based admin access beyond Supabase auth

**Implementation**:
- Supabase Auth for session management
- Custom Edge Function for admin verification
- Whitelist stored in database
- AuthContext for state management

### 4. Client-Side Rendering (CSR)

**Why**: Deployed as static site on Cloudflare Pages

**SEO Strategy**:
- Dynamic meta tags via React Helmet
- Server-side sitemap generation (static)
- Structured data (JSON-LD) injected client-side
- Semantic HTML for crawlers

**Limitations**: No server-side rendering, but SEO still works via proper meta tags

### 5. TanStack Query for Server State

**Why**: Better developer experience, caching, automatic refetching

**Benefits**:
- Automatic loading/error states
- Background refetching
- Cache invalidation
- Optimistic updates

### 6. shadcn/ui Component Library

**Why**: Copy-paste components instead of npm package

**Benefits**:
- Full customization (components in your codebase)
- No version lock-in
- Tree-shakeable
- Built on Radix UI (accessible)

### 7. Tailwind CSS for Styling

**Why**: Utility-first, fast development, small production bundle

**Benefits**:
- Consistent design system
- No CSS naming conflicts
- PurgeCSS removes unused styles
- Easy responsive design

### 8. Role-Based Access Control (RBAC)

**Why**: Fine-grained permission control beyond simple admin/user

**Implementation**:
- Database-driven whitelist with role assignments
- Permission checking hook (`usePermission`)
- Activity logging for compliance
- Access review reporting

**Components**:
- `AccessReviewReport.tsx`: Compliance reporting
- `ActivityLogViewer.tsx`: User activity tracking
- `AdminWhitelistManager.tsx`: User role management

### 9. Comprehensive Accounting Module

**Why**: Full financial tracking and reporting capabilities

**Features**:
- Double-entry bookkeeping with Chart of Accounts
- Invoice and payment management
- Journal entries with posting
- Financial reports (P&L, Balance Sheet)
- IRS Schedule C tax reporting
- Document upload with OCR/AI parsing
- CSV export for external tools

**Components**: 13 components in `src/components/admin/accounting/`

### 10. GSAP Animations for Hero Section

**Why**: High-performance animations for visual impact

**Implementation**:
- GSAP timeline-based animations
- Three.js integration for 3D orb
- Device capability detection to disable on low-end devices
- Lazy loading to prevent blocking initial render

---

## Security Practices

### Input Validation & Sanitization

**ALWAYS validate and sanitize user input**. Use utilities from `src/lib/security.ts`:

```typescript
import { validateEmail, validateTextInput, sanitizeHtml, validateUrl } from '@/lib/security';

// Email validation
const email = validateEmail(userInput);
if (!email) {
  return { error: 'Invalid email address' };
}

// Text input validation
const name = validateTextInput(userInput, 100); // Max 100 chars
if (!name) {
  return { error: 'Invalid name' };
}

// HTML sanitization (for markdown, user content)
const cleanHtml = sanitizeHtml(dirtyHtml, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'],
  ALLOWED_ATTR: ['href'],
});

// URL validation
const url = validateUrl(userInput);
if (!url) {
  return { error: 'Invalid URL' };
}
```

### Content Security Policy (CSP)

CSP headers are defined in `index.html`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  connect-src 'self' https://*.supabase.co;
  frame-src 'none';
  base-uri 'self';
  form-action 'self';
">
```

**When adding new external services**, update CSP headers accordingly.

### Authentication Flow

**Admin authentication** uses a state machine architecture with OAuth support:

**Auth States**:
- `idle`: Initial state
- `checking`: Verifying existing session
- `authenticated`: User verified and authorized
- `unauthenticated`: No valid session
- `error`: Authentication error

**Supported Auth Methods**:
1. Email/password authentication
2. OAuth providers (configured in Supabase)

**Process**:
1. Authenticate with Supabase Auth (email/password or OAuth)
2. Verify admin status via `admin-auth` Edge Function
3. Check RBAC permissions via whitelist
4. Log activity for compliance

```typescript
// Example from AuthContext.tsx
const signIn = async (email: string, password: string) => {
  // Step 1: Supabase Auth
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authError) return { success: false, error: authError.message };

  // Step 2: Verify admin access
  const { data, error } = await supabase.functions.invoke('admin-auth', {
    body: { action: 'login', email, password }
  });

  if (error || data?.error) {
    await supabase.auth.signOut();
    return { success: false, error: 'Access denied' };
  }

  return { success: true };
};

// OAuth callback handling in AuthCallback.tsx
// Handles redirect from OAuth providers
```

**RBAC Permission Checking**:

```typescript
import { usePermission } from '@/hooks/usePermission';

const MyComponent = () => {
  const { hasPermission, isLoading } = usePermission('manage_articles');

  if (isLoading) return <LoadingSpinner />;
  if (!hasPermission) return <AccessDenied />;

  return <ArticleManager />;
};
```

### Rate Limiting

**Edge Functions** implement rate limiting:

```typescript
// Example from admin-auth/index.ts
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const attempts = loginAttempts.get(ip);
  if (attempts && attempts.count >= MAX_ATTEMPTS) {
    if (Date.now() - attempts.lastAttempt < LOCKOUT_TIME) {
      return false;
    }
  }
  return true;
}
```

### Markdown Rendering Security

**ALWAYS sanitize markdown output**:

```typescript
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';

const MarkdownRenderer = ({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      components={{
        // Sanitize HTML in markdown
        html: ({ children }) => {
          const sanitized = DOMPurify.sanitize(children as string, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'code', 'pre'],
            ALLOWED_ATTR: ['href', 'class'],
          });
          return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
```

### Environment Variables

**NEVER commit sensitive data**:

```env
# .env (gitignored)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# ⚠️ IMPORTANT: Variables prefixed with VITE_ are exposed to the client!
# Never put API secrets, private keys, or credentials here.
```

**For server-side secrets**, use Supabase Edge Function environment variables.

---

## Testing Approach

### Test Configuration

**Vitest** is configured with:

- **Test environment**: jsdom (simulates browser)
- **Setup file**: `src/test/setup.ts` (global config)
- **Coverage**: v8 provider
- **Globals**: `describe`, `it`, `expect` available without imports

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# UI mode (recommended)
npm run test:ui

# Coverage report
npm run test:coverage
```

### Writing Component Tests

**Example** (`src/components/__tests__/OptimizedImage.test.tsx`):

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OptimizedImage from '../OptimizedImage';

describe('OptimizedImage Component', () => {
  it('should render with priority flag', async () => {
    render(<OptimizedImage src="/test.jpg" alt="Test Image" priority={true} />);

    await waitFor(() => {
      const img = screen.getByAltText('Test Image');
      expect(img).toBeInTheDocument();
      expect(img.getAttribute('loading')).toBe('eager');
    });
  });

  it('should lazy load by default', async () => {
    render(<OptimizedImage src="/test.jpg" alt="Test Image" />);

    await waitFor(() => {
      const img = screen.getByAltText('Test Image');
      expect(img.getAttribute('loading')).toBe('lazy');
    });
  });
});
```

### Testing Patterns

**Testing hooks**:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';

it('should fetch articles', async () => {
  const { result } = renderHook(() => useQuery({
    queryKey: ['articles'],
    queryFn: fetchArticles,
  }));

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(5);
});
```

**Testing forms**:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should validate email input', async () => {
  const user = userEvent.setup();
  render(<ContactForm />);

  const emailInput = screen.getByLabelText(/email/i);
  await user.type(emailInput, 'invalid-email');

  const submitButton = screen.getByRole('button', { name: /submit/i });
  await user.click(submitButton);

  await waitFor(() => {
    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
  });
});
```

### Mocking Supabase

```typescript
import { vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: mockArticles,
          error: null,
        })),
      })),
    })),
  },
}));
```

---

## Common Tasks

### 1. Adding a New Article

**Via Admin Dashboard**:
1. Navigate to `/admin/dashboard`
2. Click "Articles" tab
3. Click "New Article"
4. Fill in title, content (markdown), excerpt, tags
5. Upload featured image (optional)
6. Click "Publish"

**Programmatically**:

```typescript
const { data, error } = await supabase
  .from('articles')
  .insert({
    title: 'My New Article',
    slug: 'my-new-article',
    content: '# Article content here',
    excerpt: 'Short description',
    published: true,
    tags: ['AI', 'Technology'],
  })
  .select()
  .single();
```

### 2. Generating AI Article

**Via Admin Dashboard**:
1. Go to "AI Tools" → "Article Generator"
2. Enter topic/prompt
3. Select tone, length, target audience
4. Click "Generate"
5. Review generated content
6. Edit if needed
7. Publish

**Via Edge Function**:

```typescript
const { data, error } = await supabase.functions.invoke('generate-ai-article', {
  body: {
    topic: 'The Future of AI in Business',
    tone: 'professional',
    length: 'medium',
    targetAudience: 'business professionals',
  },
});
```

### 3. Adding a New Component

**Step-by-step**:

1. **Create component file**:
   ```bash
   # For UI component
   touch src/components/ui/my-component.tsx

   # For feature component
   touch src/components/MyFeature.tsx
   ```

2. **Define component**:
   ```typescript
   import React from 'react';

   interface MyComponentProps {
     title: string;
   }

   const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
     return <div>{title}</div>;
   };

   export default MyComponent;
   ```

3. **Import and use**:
   ```typescript
   import MyComponent from '@/components/MyFeature';

   <MyComponent title="Hello" />
   ```

### 4. Updating Database Schema

**WARNING**: Schema changes require Supabase migration

1. **Create migration** (in Supabase Dashboard):
   - Go to SQL Editor
   - Write migration SQL
   - Apply migration

2. **Update TypeScript types**:
   ```bash
   # Regenerate types from Supabase
   npx supabase gen types typescript --project-id [project-id] > src/integrations/supabase/types.ts
   ```

3. **Update code** to use new schema

### 5. Adding New shadcn/ui Component

```bash
# List available components
npx shadcn-ui@latest add

# Add specific component
npx shadcn-ui@latest add dialog

# Add multiple components
npx shadcn-ui@latest add dialog alert-dialog sheet
```

Component will be added to `src/components/ui/`.

### 6. Deploying to Production

**Automatic deployment** (via Cloudflare Pages):
- Push to `main` branch
- Cloudflare Pages auto-builds and deploys
- Build command: `npm run build`
- Output directory: `dist`

**Manual deployment**:
```bash
npm run build
# Upload dist/ contents to hosting provider
```

### 7. Adding Environment Variables

**Local development**:

1. Create `.env` file (if it doesn't exist)
2. Add variable with `VITE_` prefix:
   ```env
   VITE_MY_API_KEY=abc123
   ```
3. Access in code:
   ```typescript
   const apiKey = import.meta.env.VITE_MY_API_KEY;
   ```

**Production (Cloudflare Pages)**:

1. Go to Cloudflare Pages dashboard
2. Settings → Environment Variables
3. Add variable
4. Redeploy

### 8. Optimizing Images

**Use OptimizedImage component**:

```typescript
import OptimizedImage from '@/components/OptimizedImage';

// Lazy-loaded by default
<OptimizedImage
  src="/path/to/image.jpg"
  alt="Description"
/>

// Priority loading (for above-the-fold images)
<OptimizedImage
  src="/hero-image.jpg"
  alt="Hero"
  priority={true}
/>
```

**Features**:
- Lazy loading (Intersection Observer)
- Responsive sizing
- Blur placeholder
- Loading states

### 9. Adding SEO Meta Tags

**On any page**:

```typescript
import SEO from '@/components/SEO';

const MyPage = () => {
  return (
    <>
      <SEO
        title="Page Title"
        description="Page description for search engines"
        keywords="keyword1, keyword2, keyword3"
        url="https://danpearson.net/my-page"
        type="website"
      />

      {/* Page content */}
    </>
  );
};
```

**With structured data**:

```typescript
<SEO
  title="Article Title"
  description="Article description"
  type="article"
  structuredData={{
    type: 'article',
    data: {
      headline: 'Article Title',
      datePublished: '2025-01-01',
      author: { name: 'Dan Pearson' },
    },
  }}
/>
```

### 10. Running Amazon Affiliate Pipeline

**Via Admin Dashboard**:
1. Go to "Amazon Pipeline" tab
2. Enter product category or search term
3. Set filters (price range, rating, etc.)
4. Click "Run Pipeline"
5. System will:
   - Search Amazon for products
   - Scrape product data
   - Generate article with affiliate links
   - Save to database
6. Review and publish generated article

### 11. Using the Accounting Module

**Accessing Financial Tools**:
1. Navigate to Admin Dashboard
2. Click "Accounting" tab
3. Access various financial tools:
   - **Financial Overview**: Dashboard with key metrics
   - **Chart of Accounts**: Manage account structure
   - **Journal Entries**: Record transactions
   - **Invoices**: Create and track invoices
   - **Payments**: Record payments and allocations
   - **Reports**: Generate P&L, Balance Sheet
   - **Tax Reports**: IRS Schedule C generation

**Recording a Transaction**:
```typescript
// Via Journal Entry
const journalEntry = {
  date: new Date(),
  description: 'Office supplies purchase',
  entries: [
    { account: 'office_supplies', debit: 150.00, credit: 0 },
    { account: 'cash', debit: 0, credit: 150.00 }
  ]
};
```

**Uploading Documents**:
1. Go to "Document Upload" in Accounting
2. Drag and drop or select files (receipts, invoices)
3. System will:
   - Extract text via OCR
   - Parse with AI for key fields
   - Suggest categorization
4. Review and approve extracted data

### 12. Working with GSAP Animations

**Adding GSAP animations to components**:

```typescript
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

const AnimatedComponent = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from('.animated-element', {
      opacity: 0,
      y: 50,
      duration: 0.8,
      stagger: 0.1,
      ease: 'power2.out'
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef}>
      <div className="animated-element">Content</div>
    </div>
  );
};
```

**Best practices**:
- Use `useGSAP` hook for proper cleanup
- Scope animations to container refs
- Check device capabilities before heavy animations
- Prefer CSS transitions for simple animations

---

## Important Files

### Must-Know Configuration Files

#### `vite.config.ts`
**Purpose**: Vite build configuration

**Key settings**:
- Path alias: `@` → `./src`
- Dev server: Port 8080
- Manual chunking for vendor libs
- Build target: ES2020

**When to modify**: Adding new vendor chunks, changing build settings

#### `tailwind.config.ts`
**Purpose**: Tailwind CSS configuration

**Key settings**:
- Dark mode strategy: `class`
- Custom colors, animations
- Content paths for purging

**When to modify**: Adding custom colors, animations, or variants

#### `tsconfig.json` / `tsconfig.app.json`
**Purpose**: TypeScript configuration

**Key settings**:
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`
- ES2020 target

**When to modify**: Adding new path aliases, changing compiler options

#### `src/integrations/supabase/types.ts`
**Purpose**: Auto-generated TypeScript types from Supabase schema

**IMPORTANT**:
- **DO NOT edit manually**
- Regenerate after schema changes
- 3619 lines of type definitions
- Used throughout codebase

**How to regenerate**:
```bash
npx supabase gen types typescript --project-id [id] > src/integrations/supabase/types.ts
```

#### `src/integrations/supabase/client.ts`
**Purpose**: Supabase client initialization

**Key settings**:
- Auth storage: localStorage
- Persist sessions: true
- Auto-refresh tokens: true

**When to modify**: Changing Supabase configuration, auth settings

#### `src/lib/security.ts`
**Purpose**: Input validation and sanitization utilities

**Functions**:
- `validateEmail()`
- `validateTextInput()`
- `validateUrl()`
- `sanitizeHtml()`

**When to use**: ALWAYS when handling user input

#### `src/App.tsx`
**Purpose**: Root component with routing configuration

**Contains**:
- All route definitions
- Lazy-loaded page imports
- Protected route setup
- Layout structure

**When to modify**: Adding new routes, changing navigation

#### `src/contexts/AuthContext.tsx`
**Purpose**: Global authentication state management

**Provides**:
- User session
- Login/logout functions
- Admin status
- Loading states

**When to use**: Any component needing auth info

### Critical Files to Be Aware Of

- **`src/index.css`** (590 lines): Global styles, CSS variables, custom animations
- **`src/lib/performance.ts`**: Core Web Vitals monitoring
- **`src/lib/logger.ts`**: Dev-only logging utility
- **`src/components/SEO.tsx`**: Dynamic meta tag management
- **`src/components/ErrorBoundary.tsx`**: Error handling wrapper
- **`src/components/auth/ProtectedRoute.tsx`**: Auth route protection with RBAC
- **`src/hooks/usePermission.ts`**: RBAC permission checking hook
- **`src/components/HeroSection.tsx`**: GSAP-animated hero with 3D orb
- **`src/components/Interactive3DOrb.tsx`**: Three.js interactive orb component
- **`package.json`**: Dependencies, scripts, project metadata

---

## Things to Avoid

### ❌ Anti-Patterns

1. **Don't use relative imports beyond one level**
   ```typescript
   // ❌ Bad
   import { Component } from '../../../components/Component';

   // ✅ Good
   import { Component } from '@/components/Component';
   ```

2. **Don't bypass input validation**
   ```typescript
   // ❌ Bad - Direct insertion without validation
   await supabase.from('articles').insert({ title: userInput });

   // ✅ Good - Validate first
   const title = validateTextInput(userInput, 200);
   if (!title) return { error: 'Invalid title' };
   await supabase.from('articles').insert({ title });
   ```

3. **Don't ignore TypeScript errors**
   ```typescript
   // ❌ Bad
   const data: any = await fetchData();

   // ✅ Good
   const data: Article[] = await fetchData();
   ```

4. **Don't create barrel exports for components**
   ```typescript
   // ❌ Bad - Increases bundle size
   // components/index.ts
   export { Button } from './Button';
   export { Card } from './Card';
   // ... 50 more

   // ✅ Good - Direct imports
   import { Button } from '@/components/ui/button';
   ```

5. **Don't use inline styles**
   ```tsx
   // ❌ Bad
   <div style={{ padding: '16px', backgroundColor: 'blue' }}>

   // ✅ Good
   <div className="p-4 bg-blue-500">
   ```

6. **Don't skip lazy loading for routes**
   ```typescript
   // ❌ Bad - Increases initial bundle
   import About from './pages/About';

   // ✅ Good - Lazy load
   const About = lazy(() => import('./pages/About'));
   ```

7. **Don't forget error handling**
   ```typescript
   // ❌ Bad
   const data = await supabase.from('articles').select();

   // ✅ Good
   const { data, error } = await supabase.from('articles').select();
   if (error) {
     logger.error('Failed to fetch:', error);
     return null;
   }
   ```

8. **Don't hardcode URLs**
   ```typescript
   // ❌ Bad
   const url = 'http://localhost:8080/api/articles';

   // ✅ Good
   const url = `${import.meta.env.VITE_API_URL}/articles`;
   ```

9. **Don't use console.log in production code**
   ```typescript
   // ❌ Bad
   console.log('User data:', userData);

   // ✅ Good
   logger.log('User data:', userData); // Only logs in dev
   ```

10. **Don't modify auto-generated files**
    - `src/integrations/supabase/types.ts` (regenerate instead)
    - `dist/` build output
    - `node_modules/`

### ⚠️ Common Pitfalls

1. **Forgetting to invalidate queries after mutations**
   ```typescript
   // After creating/updating data, invalidate related queries
   queryClient.invalidateQueries({ queryKey: ['articles'] });
   ```

2. **Not handling loading states**
   ```typescript
   const { data, isLoading } = useQuery(...);

   if (isLoading) return <LoadingSpinner />;
   if (!data) return <EmptyState />;
   ```

3. **Forgetting to clean up effects**
   ```typescript
   useEffect(() => {
     const subscription = supabase
       .channel('changes')
       .on('postgres_changes', handleChange)
       .subscribe();

     // ✅ Clean up
     return () => {
       subscription.unsubscribe();
     };
   }, []);
   ```

4. **Not optimizing images**
   - Always use `<OptimizedImage>` component
   - Set `priority={true}` for above-the-fold images

5. **Skipping SEO meta tags on new pages**
   - Every page should have `<SEO>` component
   - Set appropriate title, description, keywords

6. **Not testing production build**
   ```bash
   # Always test before deploying
   npm run build
   npm run preview
   ```

---

## Troubleshooting

### Build Issues

#### Error: `ROLLUP_BINARY_NOT_FOUND` on Cloudflare Pages

**Cause**: Optional dependencies issue with Rollup on Cloudflare Pages

**Solution**:
- Use `npm install` instead of `npm ci`
- Check `.npmrc` has `engine-strict=false`

#### TypeScript Errors During Build

**Solutions**:
1. Run `npm run lint` to identify issues
2. Check `tsconfig.app.json` for strict mode settings
3. Verify all imports have correct paths
4. Restart TypeScript server: VS Code → `Cmd+Shift+P` → "Restart TS Server"

#### `Cannot find module '@/...'`

**Solutions**:
1. Check `tsconfig.json` has path aliases configured:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```
2. Restart TypeScript server
3. Restart dev server

### Runtime Issues

#### 404 Errors on Page Refresh

**Cause**: Client-side routing not configured on server

**Solution** (Cloudflare Pages):
- Add `_redirects` file in `public/`:
  ```
  /* /index.html 200
  ```

#### Images Not Loading

**Solutions**:
1. Check Supabase storage bucket permissions
2. Verify image URLs are absolute, not relative
3. Check CSP headers allow image domain
4. Inspect Network tab for 403/404 errors

#### Supabase Connection Errors

**Solutions**:
1. Verify `.env` has correct Supabase URL and keys
2. Check Supabase project is not paused (free tier)
3. Test in Supabase Dashboard → API docs
4. Check Network tab for 401/403 errors

### Performance Issues

#### Slow Page Loads

**Solutions**:
1. Run Lighthouse audit to identify bottlenecks
2. Check bundle sizes: `npm run build` → inspect `dist/` folder sizes
3. Verify lazy loading is working (Network tab)
4. Check for unnecessary re-renders (React DevTools Profiler)

#### High Memory Usage

**Causes**:
- Three.js scenes not properly disposed
- Memory leaks in components

**Solutions**:
1. Check for memory leaks (Chrome DevTools → Memory tab)
2. Verify useEffect cleanup functions
3. Dispose Three.js objects properly:
   ```typescript
   useEffect(() => {
     // Three.js setup
     return () => {
       geometry.dispose();
       material.dispose();
       renderer.dispose();
     };
   }, []);
   ```

### Development Issues

#### Hot Reload Not Working

**Solutions**:
1. Restart dev server: `npm run dev`
2. Clear browser cache and hard reload
3. Check for console errors blocking execution
4. Check Vite config for HMR settings

#### ESLint Errors

**Solutions**:
1. Run `npm run lint` to see all issues
2. Auto-fix: `npm run lint -- --fix`
3. Check `eslint.config.js` for rule configuration
4. Update ESLint: `npm update eslint`

---

## Conclusion

This guide should help you understand the codebase structure, conventions, and best practices for the Dan Pearson portfolio project. When making changes:

1. **Follow established patterns** (component structure, imports, styling)
2. **Prioritize security** (validate input, sanitize output)
3. **Test thoroughly** (run tests, build, preview)
4. **Optimize for performance** (lazy loading, code splitting)
5. **Write clear commits** (conventional commit format)

For questions or clarifications, refer to:
- **README.md** for project overview and setup
- **Source code** for implementation examples
- **Supabase Dashboard** for database schema
- **TypeScript types** (`types.ts`) for data structures

---

**Last Updated**: 2025-11-28
**Maintained By**: AI Assistants (Claude)
**Repository**: https://github.com/dj-pearson/pearson-style-showcase
