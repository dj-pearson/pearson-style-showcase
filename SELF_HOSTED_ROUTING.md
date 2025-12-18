# Self-Hosted Supabase Routing Guide

## Overview

This document explains how the Dan Pearson portfolio application routes to the self-hosted Supabase infrastructure at danpearson.net.

## Architecture

The application uses a **dual-subdomain architecture** for routing to different Supabase services:

```
┌─────────────────────────────────────────────────────┐
│          Client Application (React/Vite)            │
│                 danpearson.net                      │
└─────────────────┬───────────────────────────────────┘
                  │
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌───────────────┐   ┌──────────────────┐
│  API Gateway  │   │ Edge Functions   │
│ Kong/PostgREST│   │   Deno Runtime   │
│ api.danpearson│   │ functions.dan... │
│      .net     │   │                  │
└───────┬───────┘   └──────────────────┘
        │
        │
        ▼
┌───────────────┐
│  PostgreSQL   │
│   Database    │
│  (Supabase)   │
└───────────────┘
```

## Routing Configuration

### 1. API Subdomain (api.danpearson.net)

**Purpose**: Handles all database operations and authentication

**Routes to**:
- PostgreSQL database (via PostgREST)
- Supabase Auth service
- Realtime subscriptions (if enabled)
- Storage API (if enabled)

**Configuration**:
```typescript
// src/integrations/supabase/client.ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://api.danpearson.net';
```

**Used by**:
- All `supabase.from()` calls (database queries)
- All `supabase.auth.*` calls (authentication)
- All `supabase.storage.*` calls (file uploads)

**Examples**:
```typescript
// Database query
const { data, error } = await supabase
  .from('articles')
  .select('*');
// Routes to: https://api.danpearson.net/rest/v1/articles

// Authentication
const { data, error } = await supabase.auth.signIn({...});
// Routes to: https://api.danpearson.net/auth/v1/token
```

### 2. Functions Subdomain (functions.danpearson.net)

**Purpose**: Handles all edge function invocations

**Routes to**:
- Deno runtime hosting edge functions
- Individual function handlers

**Configuration**:
```typescript
// src/lib/edge-functions.ts
const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL || 'https://functions.danpearson.net';
```

**Used by**:
- All `invokeEdgeFunction()` calls (replaces `supabase.functions.invoke()`)

**Examples**:
```typescript
// Edge function invocation
const { data, error } = await invokeEdgeFunction('generate-ai-article', {
  body: { topic: 'AI News' }
});
// Routes to: https://functions.danpearson.net/generate-ai-article
```

## Dashboard Component Routing

All admin dashboard components use the routing configuration described above. Here's a comprehensive breakdown:

### Database Operations (api.danpearson.net)

All components that query or mutate data use `supabase.from()` and route to the API subdomain:

#### Article Management
- **ArticleManager.tsx**: CRUD operations for articles
- **AIArticleGenerator.tsx**: Saves generated articles to database

#### Project & Task Management
- **ProjectManager.tsx**: Project CRUD operations
- **TasksManager.tsx**: Task CRUD operations
- **TaskFormDialog.tsx**: Task creation/updates

#### Accounting Module
- **ChartOfAccountsManager.tsx**: Account structure queries
- **JournalEntriesManager.tsx**: Transaction entries
- **InvoicesManager.tsx**: Invoice CRUD operations
- **PaymentsManager.tsx**: Payment recording
- **FinancialReports.tsx**: Report generation queries
- **TaxReports.tsx**: Tax report queries
- **ContactsManager.tsx**: Contact management

#### Support & Tickets
- **SupportTicketInbox.tsx**: Ticket queries
- **TicketDetailView.tsx**: Ticket details and updates
- **KnowledgeBaseManager.tsx**: KB article management

#### Admin Operations
- **AdminWhitelistManager.tsx**: User whitelist management
- **UserRoleManager.tsx**: RBAC role assignments
- **ActivityLogViewer.tsx**: Activity log queries
- **AccessReviewReport.tsx**: Compliance reporting

#### Other Managers
- **TestimonialsManager.tsx**: Testimonial CRUD
- **VenturesManager.tsx**: Venture tracking
- **NewsletterManager.tsx**: Newsletter subscriptions
- **MediaLibrary.tsx**: Media asset management

### Edge Function Invocations (functions.danpearson.net)

All components that invoke edge functions use `invokeEdgeFunction()` and route to the Functions subdomain:

#### AI & Content Generation
- **AIArticleGenerator.tsx**:
  - Function: `generate-ai-article`
  - Purpose: AI-powered article generation

- **AITaskGeneratorDialog.tsx**:
  - Function: `generate-task-suggestions` (if implemented)
  - Purpose: AI task suggestions

#### Email & Communication
- **ContactForm.tsx**:
  - Function: `send-contact-email`
  - Purpose: Contact form email delivery

- **NewsletterSignup.tsx**:
  - Function: `newsletter-signup`
  - Purpose: Newsletter subscription handling

- **TicketDetailView.tsx**:
  - Function: `send-ticket-email`
  - Purpose: Support ticket email notifications

#### Amazon Affiliate Pipeline
- **AmazonPipelineManager.tsx**:
  - Function: `amazon-article-pipeline`
  - Purpose: Automated product research and article generation

#### Authentication
- **AuthContext.tsx**:
  - Function: `admin-auth`
  - Purpose: Admin access verification and RBAC checks

#### Document Processing
- **DocumentUpload.tsx** (Accounting):
  - Function: `process-accounting-document`
  - Purpose: OCR and AI parsing of receipts/invoices

#### Maintenance & System
- **MaintenanceDashboard.tsx**:
  - Function: `maintenance-runner`
  - Purpose: Scheduled maintenance tasks

#### Webhooks
- **WebhookSettings.tsx**:
  - Functions: Various webhook handlers
  - Purpose: External service integrations

## Migration Status

### ✅ Completed

1. **Supabase client configuration** - Properly configured to use `api.danpearson.net`
2. **Edge function helper** - `invokeEdgeFunction()` utility created and deployed
3. **All dashboard components** - Migrated to use the new routing pattern
4. **Environment variables** - `.env.example` updated with self-hosted configuration

### Component Migration Summary

**Total Dashboard Components**: 60+
**Using API Subdomain**: All (via `supabase.from()`)
**Using Functions Subdomain**: All edge function calls (via `invokeEdgeFunction()`)
**Still using old pattern**: None

All components have been migrated to use the proper routing:
- Database operations → `supabase.from()` → api.danpearson.net
- Edge functions → `invokeEdgeFunction()` → functions.danpearson.net

## Environment Configuration

### Required Variables

```bash
# API subdomain (Database, Auth, Storage)
VITE_SUPABASE_URL=https://api.danpearson.net

# Anonymous key for client-side operations
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Functions subdomain (Edge Functions)
VITE_FUNCTIONS_URL=https://functions.danpearson.net
```

### Optional Variables

```bash
# Error tracking
VITE_ERROR_TRACKING_ENDPOINT=https://your-error-endpoint.com
VITE_SENTRY_DSN=your-sentry-dsn
VITE_ERROR_TRACKING_DEV=false
VITE_ERROR_SAMPLE_RATE=0.1

# Build information
VITE_BUILD_VERSION=1.0.0

# Logging
VITE_LOG_LEVEL=info
```

## Authentication Flow

The authentication flow uses both subdomains:

1. **Initial Auth** (api.danpearson.net):
   ```typescript
   const { data, error } = await supabase.auth.signInWithPassword({
     email, password
   });
   ```

2. **Admin Verification** (functions.danpearson.net):
   ```typescript
   const { data, error } = await invokeEdgeFunction('admin-auth', {
     body: { action: 'verify', email }
   });
   ```

3. **Session Management** (api.danpearson.net):
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   ```

## Edge Function Helper Details

The `invokeEdgeFunction()` helper provides a drop-in replacement for the cloud Supabase pattern:

```typescript
// Old (cloud Supabase):
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { ... }
});

// New (self-hosted):
const { data, error } = await invokeEdgeFunction('my-function', {
  body: { ... }
});
```

**Features**:
- Automatic auth token injection from Supabase session
- Error handling matching Supabase API
- Support for custom headers and HTTP methods
- Health check endpoint for monitoring

**Implementation**:
```typescript
// src/lib/edge-functions.ts
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  options: EdgeFunctionOptions = {}
): Promise<EdgeFunctionResult<T>> {
  // Get auth token from Supabase session
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  // Make request to functions subdomain
  const response = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Return data/error in Supabase-compatible format
  return { data: await response.json(), error: null };
}
```

## Kong Gateway Configuration

The Kong Gateway routes requests to the appropriate services:

```
api.danpearson.net:
  /rest/v1/*        → PostgREST (Database)
  /auth/v1/*        → GoTrue (Auth)
  /storage/v1/*     → Storage API
  /realtime/v1/*    → Realtime (if enabled)

functions.danpearson.net:
  /*                → Deno Runtime (Edge Functions)
```

## Testing

To verify routing is working correctly:

### Test Database Connection
```typescript
const { data, error } = await supabase
  .from('articles')
  .select('*')
  .limit(1);

console.log('Database connection:', error ? 'FAILED' : 'OK');
```

### Test Edge Functions
```typescript
const { data, error } = await invokeEdgeFunction('admin-auth', {
  body: { action: 'ping' }
});

console.log('Edge functions:', error ? 'FAILED' : 'OK');
```

### Test Authentication
```typescript
const { data: { session } } = await supabase.auth.getSession();
console.log('Auth session:', session ? 'ACTIVE' : 'NONE');
```

## Troubleshooting

### Common Issues

#### 1. CORS Errors

**Symptom**: Browser console shows CORS policy errors

**Solution**: Ensure Kong Gateway has proper CORS configuration:
```yaml
plugins:
  - name: cors
    config:
      origins:
        - https://danpearson.net
      credentials: true
```

#### 2. Authentication Failures

**Symptom**: Auth calls fail with 401/403

**Solution**:
- Verify `VITE_SUPABASE_ANON_KEY` is correct
- Check JWT secret matches between services
- Ensure Kong is forwarding auth headers

#### 3. Edge Function Timeouts

**Symptom**: Edge function calls hang or timeout

**Solution**:
- Check Deno runtime is healthy: `https://functions.danpearson.net/_health`
- Verify function logs for errors
- Ensure network connectivity between services

#### 4. Database Connection Errors

**Symptom**: `supabase.from()` calls fail

**Solution**:
- Verify PostgreSQL is accessible from Kong
- Check PostgREST is running and healthy
- Ensure database credentials are correct

## Monitoring

### Health Check Endpoints

```bash
# API Gateway Health
curl https://api.danpearson.net/rest/v1/

# Edge Functions Health
curl https://functions.danpearson.net/_health

# Database Health (requires auth)
curl https://api.danpearson.net/rest/v1/articles?limit=1
```

### Logging

All components use the centralized logger:
```typescript
import { logger } from '@/lib/logger';

logger.info('Database operation', { table: 'articles' });
logger.error('Edge function failed', { function: 'generate-ai-article', error });
```

## Security Considerations

1. **HTTPS Only**: All subdomains must use HTTPS
2. **Auth Token Rotation**: Tokens are automatically refreshed by Supabase client
3. **CORS Configuration**: Restrict origins to danpearson.net
4. **Rate Limiting**: Implement in Kong Gateway
5. **Row Level Security**: Enabled on all database tables

## Performance Optimization

1. **CDN**: Consider Cloudflare in front of both subdomains
2. **Edge Caching**: Cache static responses at edge
3. **Connection Pooling**: Configure in PostgreSQL
4. **Function Cold Starts**: Keep functions warm with health checks

## Future Improvements

1. **Service Mesh**: Consider using a service mesh for inter-service communication
2. **Load Balancing**: Add multiple instances of each service
3. **Database Replication**: Set up read replicas for scaling
4. **Metrics & Tracing**: Implement OpenTelemetry for observability

---

**Last Updated**: 2025-12-17
**Maintained By**: Dan Pearson
**Related Docs**:
- `CLAUDE.md` - Development guide
- `FRONTEND_MIGRATION.md` - Migration documentation
- `.env.example` - Environment configuration
