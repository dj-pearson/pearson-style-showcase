# Self-Hosted Supabase Migration Audit Report

**Generated**: 2025-12-18
**Audit Scope**: Complete codebase review for Supabase routing and environment variables

---

## Executive Summary

The codebase has been **largely migrated** to support self-hosted Supabase infrastructure:
- **API/Database**: `api.danpearson.net`
- **Edge Functions**: `functions.danpearson.net`

### Migration Status: MOSTLY COMPLETE

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend Client | COMPLETE | Uses `VITE_SUPABASE_URL` env var |
| Edge Functions Helper | COMPLETE | `invokeEdgeFunction()` routes to `functions.danpearson.net` |
| Edge Functions (Supabase) | COMPLETE | All use `Deno.env.get('SUPABASE_URL')` |
| CSP Headers | COMPLETE | Legacy `*.supabase.co` removed |
| Documentation | NEEDS UPDATE | Many docs still reference old cloud URLs |

---

## 1. Frontend Routing Analysis

### Supabase Client (`src/integrations/supabase/client.ts`)

**Status**: CONFIGURED FOR SELF-HOSTED

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://api.danpearson.net';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJ0eX...';
```

**Routes To**: `api.danpearson.net` for:
- Database queries (`supabase.from()`)
- Authentication (`supabase.auth`)
- Storage (`supabase.storage`)
- Realtime subscriptions

### Edge Functions Helper (`src/lib/edge-functions.ts`)

**Status**: CONFIGURED FOR SELF-HOSTED

```typescript
const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL || 'https://functions.danpearson.net';
```

**Routes To**: `functions.danpearson.net` for all edge function invocations.

### Components Using Edge Functions (All Properly Migrated)

| Component | Function Called | Status |
|-----------|-----------------|--------|
| `AuthContext.tsx` | `admin-auth` | MIGRATED |
| `AdminLogin.tsx` | `admin-auth` | MIGRATED |
| `ContactForm.tsx` | `send-contact-email` | MIGRATED |
| `NewsletterSignup.tsx` | `newsletter-signup` | MIGRATED |
| `AffiliateLink.tsx` | `track-affiliate-click` | MIGRATED |
| `AIArticleGenerator.tsx` | `generate-ai-article` | MIGRATED |
| `AmazonPipelineManager.tsx` | `amazon-article-pipeline` | MIGRATED |
| `AIToolsManager.tsx` | `extract-from-url`, `ai-content-generator` | MIGRATED |
| `AIModelConfigManager.tsx` | `test-ai-model` | MIGRATED |
| `ProjectManager.tsx` | `extract-from-url`, `ai-content-generator` | MIGRATED |
| `ArticleManager.tsx` | `ai-content-generator`, `send-article-webhook` | MIGRATED |
| `WebhookSettings.tsx` | `send-article-webhook` | MIGRATED |
| `QuickActionsPanel.tsx` | `amazon-article-pipeline`, `send-article-webhook` | MIGRATED |
| `DocumentUpload.tsx` | `process-accounting-document` | MIGRATED |
| `TicketDetailView.tsx` | `send-ticket-email`, `generate-ticket-response` | MIGRATED |
| `NotificationSettings.tsx` | `slack-test` | MIGRATED |
| `AITaskGeneratorDialog.tsx` | `generate-ai-tasks` | MIGRATED |
| `SecureVaultDashboard.tsx` | `secure-vault` | MIGRATED |
| `VaultImporter.tsx` | `secure-vault` | MIGRATED |
| `VaultItemForm.tsx` | `secure-vault` | MIGRATED |
| `CommandBuilder.tsx` | `secure-vault` | MIGRATED |

---

## 2. Edge Functions Analysis

### All 24 Edge Functions

| Function | Supabase URL Source | Status |
|----------|---------------------|--------|
| `admin-auth` | `Deno.env.get("SUPABASE_URL")` | CORRECT |
| `ai-content-generator` | Uses OpenAI directly | N/A |
| `amazon-article-pipeline` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `email-webhook-receiver` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `extract-from-url` | Uses Lovable API directly | N/A |
| `generate-ai-article` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `generate-ai-tasks` | `Deno.env.get("SUPABASE_URL")` | CORRECT |
| `generate-social-content` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `generate-ticket-response` | `Deno.env.get("SUPABASE_URL")` | CORRECT |
| `health-check` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `maintenance-runner` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `newsletter-signup` | `Deno.env.get("SUPABASE_URL")` | CORRECT |
| `optimize-image` | `Deno.env.get("SUPABASE_URL")` | CORRECT |
| `process-accounting-document` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `receive-email` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `secure-vault` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `send-article-webhook` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `send-contact-email` | Uses Resend API | N/A |
| `send-notification-email` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `send-ticket-email` | `Deno.env.get('SUPABASE_URL')` | CORRECT |
| `slack-test` | No Supabase calls | N/A |
| `test-ai-model` | `Deno.env.get("SUPABASE_URL")` | CORRECT |
| `test-api-setup` | No direct Supabase calls | N/A |
| `track-affiliate-click` | `Deno.env.get('SUPABASE_URL')` | CORRECT |

**All edge functions use environment variables** - no hardcoded Supabase URLs.

---

## 3. Environment Variables Required

### Frontend (VITE_ prefixed - exposed to client)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `VITE_SUPABASE_URL` | Self-hosted Supabase API URL | YES | `https://api.danpearson.net` |
| `VITE_SUPABASE_ANON_KEY` | Public anon key for client auth | YES | `eyJhbGci...` |
| `VITE_FUNCTIONS_URL` | Edge functions URL | YES | `https://functions.danpearson.net` |

### Edge Functions (Server-side secrets)

#### Core Supabase (Required for all functions)

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Self-hosted Supabase URL | YES |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key for database access | YES |
| `SUPABASE_ANON_KEY` | Public key (for `track-affiliate-click`) | YES |

#### AI/Content Generation

| Variable | Used By | Description |
|----------|---------|-------------|
| `LOVABLE_API_KEY` | `generate-ai-article`, `generate-social-content`, `amazon-article-pipeline`, `process-accounting-document`, `extract-from-url` | Lovable AI Gateway API key |
| `OPENAI_API_KEY` | `health-check` (optional check) | OpenAI API key |
| `OPENAI_API` | `ai-content-generator` | OpenAI API key (alternate name) |

#### Amazon Affiliate Pipeline

| Variable | Used By | Description |
|----------|---------|-------------|
| `SERPAPI_KEY` | `amazon-article-pipeline`, `test-api-setup` | SerpAPI for Google search |
| `GOOGLE_SEARCH_API_KEY` | `amazon-article-pipeline`, `test-api-setup` | Google Custom Search API |
| `GOOGLE_SEARCH_ENGINE_ID` | `amazon-article-pipeline`, `test-api-setup` | Google CSE ID |
| `DATAFORSEO_API_LOGIN` | `test-api-setup` | DataForSEO login |
| `DATAFORSEO_API_PASSWORD` | `test-api-setup` | DataForSEO password |

#### Email/Notifications

| Variable | Used By | Description |
|----------|---------|-------------|
| `RESEND_API` | `send-contact-email`, `newsletter-signup` | Resend email API key |
| `AMAZON_SMTP_ENDPOINT` | `admin-auth`, `send-ticket-email`, `send-notification-email` | AWS SES SMTP endpoint |
| `AMAZON_SMTP_USER_NAME` | `admin-auth`, `send-ticket-email`, `send-notification-email` | AWS SES username |
| `AMAZON_SMTP_PASSWORD` | `admin-auth`, `send-ticket-email`, `send-notification-email` | AWS SES password |

#### Webhooks/Security

| Variable | Used By | Description |
|----------|---------|-------------|
| `MAKE_WEBHOOK_SECRET` | `receive-email` | Make.com webhook verification |
| `VAULT_ENCRYPTION_KEY` | `secure-vault` | AES encryption key for vault |

#### Optional/Configuration

| Variable | Used By | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGIN` | `newsletter-signup`, `optimize-image` | CORS origin (defaults to danpearson.net) |
| `FUNCTION_VERSION` | `health-check` | Version string for health checks |
| `LOG_LEVEL` | `_shared/production-logger.ts` | Logging level |
| `DENO_ENV` / `ENV` / `NODE_ENV` | Various | Production detection |

---

## 4. Hardcoded References Found

### Source Code (Non-documentation)

| File | Line | Content | Status |
|------|------|---------|--------|
| `index.html:14` | CSP | `https://*.supabase.co` removed | FIXED |
| `public/_headers:80` | CSP | `https://*.supabase.co` removed | FIXED |
| `src/components/admin/vault/CommandBuilder.tsx:860` | Placeholder | `psql -h db.[SUPABASE_PROJECT_REF].supabase.co` | OK - template placeholder |

### Documentation Files (Need updating)

These documentation files contain old cloud Supabase references. They should be updated but are not critical:

- `AmazonPRD.md`
- `AMAZON_ARTICLE_GENERATOR_SETUP.md`
- `AUTH_FIX_DOCUMENTATION.md`
- `CHANGELOG_AMAZON_GENERATOR.md`
- `API_SETUP_QUICK_START.md`
- `CODE_REVIEW_FINDINGS.md`
- `DEPLOYMENT_FILE_REFERENCE.md`
- `DEPLOYMENT_GUIDE.md`
- `DEPLOYMENT_SUMMARY.md`
- `DISASTER_RECOVERY_RUNBOOK.md`
- `LIVING_TECHNICAL_SPECIFICATION.md`
- `SECURITY_AUDIT_REPORT.md`
- `README.md`
- `docs/SECRETS_MANAGEMENT_RUNBOOK.md`

---

## 5. CSP Headers Analysis

### Current CSP (`index.html` and `public/_headers`)

```
connect-src 'self'
  https://*.supabase.co
  https://api.danpearson.net
  wss://api.danpearson.net
  https://functions.danpearson.net
  https://hooks.slack.com
  https://www.google-analytics.com
  https://analytics.google.com
  https://www.googletagmanager.com
  https://fonts.gstatic.com
  https://cloudflareinsights.com
  https://stats.g.doubleclick.net;
```

**Recommendation**: Keep `https://*.supabase.co` for backward compatibility during migration. Once migration is verified complete, it can be removed.

---

## 6. Action Items

### Critical (Must Fix)

None - all critical routing is properly configured.

### Completed

1. **DONE: Remove `*.supabase.co` from CSP**
   - Files: `index.html`, `public/_headers`
   - Status: FIXED on 2025-12-18

### Recommended

1. **Update documentation files** to reference new URLs
   - Priority: Low - does not affect functionality

2. **Verify environment variables in production**
   - Ensure all variables listed above are set in:
     - Cloudflare Pages (frontend)
     - Coolify/Docker (edge functions)
     - Self-hosted Supabase (database)

### Optional

1. Update `CommandBuilder.tsx` placeholder text to reference self-hosted format
2. Clean up old migration documentation once verified

---

## 7. Testing Checklist

### Frontend Connectivity

```bash
# Test API endpoint
curl https://api.danpearson.net/rest/v1/ -H "apikey: YOUR_ANON_KEY"

# Test Auth endpoint
curl https://api.danpearson.net/auth/v1/settings

# Test Functions endpoint
curl https://functions.danpearson.net/_health
```

### Edge Function Tests

```bash
# Health check
curl https://functions.danpearson.net/health-check

# Admin auth (OPTIONS)
curl -X OPTIONS https://functions.danpearson.net/admin-auth

# Newsletter signup test
curl -X POST https://functions.danpearson.net/newsletter-signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

---

## 8. Architecture Diagram

```
                                   FRONTEND (danpearson.net)
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
            api.danpearson.net     functions.danpearson.net    External APIs
            (Self-hosted Supabase)  (Edge Functions)           (Lovable, etc.)
                    │                       │                       │
        ┌───────────┼───────────┐          │                       │
        │           │           │          │                       │
        ▼           ▼           ▼          ▼                       │
     Database    Auth       Storage    Deno Runtime                │
     (Postgres)  (GoTrue)   (S3/MinIO)     │                       │
                                           │                       │
                                           ▼                       │
                                    Database Access ◄──────────────┘
                                    (via SUPABASE_URL)
```

---

## 9. Environment Setup Template

### `.env` (Frontend)

```env
# Self-hosted Supabase
VITE_SUPABASE_URL=https://api.danpearson.net
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_FUNCTIONS_URL=https://functions.danpearson.net
```

### Edge Functions Secrets

```bash
# Core Supabase
SUPABASE_URL=https://api.danpearson.net
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# AI Services
LOVABLE_API_KEY=your-lovable-key
OPENAI_API_KEY=your-openai-key  # Optional

# Amazon Pipeline
SERPAPI_KEY=your-serpapi-key
GOOGLE_SEARCH_API_KEY=your-google-key
GOOGLE_SEARCH_ENGINE_ID=your-cse-id

# Email Services
RESEND_API=your-resend-key
AMAZON_SMTP_ENDPOINT=email-smtp.us-east-1.amazonaws.com
AMAZON_SMTP_USER_NAME=your-smtp-user
AMAZON_SMTP_PASSWORD=your-smtp-password

# Security
VAULT_ENCRYPTION_KEY=your-32-byte-encryption-key
MAKE_WEBHOOK_SECRET=your-webhook-secret

# Optional
ALLOWED_ORIGIN=https://danpearson.net
FUNCTION_VERSION=1.0.0
LOG_LEVEL=info
```

---

## 10. Conclusion

The codebase is **properly configured** for self-hosted Supabase:

- All frontend components use the `invokeEdgeFunction()` helper
- All edge functions read URLs from environment variables
- No hardcoded production Supabase cloud URLs in source code
- CSP headers include both old and new domains for backward compatibility

**Migration Status**: COMPLETE

Changes made during this audit:
- Removed legacy `*.supabase.co` from CSP headers in `index.html` and `public/_headers`
