# Environment Variables Reference

> **Purpose**: Complete reference of all environment variables required by the Dan Pearson Portfolio platform. This includes frontend variables, Supabase Edge Function secrets, and database-stored configurations.

**Last Updated**: 2025-12-27

---

## Table of Contents

1. [Frontend Variables (Vite)](#frontend-variables-vite)
2. [Supabase Edge Function Secrets](#supabase-edge-function-secrets)
3. [Database-Stored API Keys](#database-stored-api-keys)
4. [Build & Deploy Configuration](#build--deploy-configuration)
5. [Quick Setup Checklist](#quick-setup-checklist)

---

## Frontend Variables (Vite)

These variables are prefixed with `VITE_` and are exposed to the client-side code. They should be set in your `.env` file for local development or in your hosting provider's environment settings (e.g., Cloudflare Pages).

> **WARNING**: Variables prefixed with `VITE_` are bundled into the client-side code and visible in the browser. Never store sensitive secrets here.

### Required Variables

| Variable | Type | Description | Where to Set | Example |
|----------|------|-------------|--------------|---------|
| `VITE_SUPABASE_URL` | Plain text URL | Self-hosted Supabase API endpoint | `.env` / Cloudflare Pages | `https://api.danpearson.net` |
| `VITE_SUPABASE_ANON_KEY` | Plain text JWT | Supabase anonymous/public key (not sensitive - RLS handles security) | `.env` / Cloudflare Pages | `eyJhbGciOiJIUzI1NiIs...` |

### Optional Variables

| Variable | Type | Description | Where to Set | Default | Example |
|----------|------|-------------|--------------|---------|---------|
| `VITE_FUNCTIONS_URL` | Plain text URL | Edge Functions URL (separate from API for self-hosted) | `.env` / Cloudflare Pages | `https://functions.danpearson.net` | `https://functions.danpearson.net` |
| `VITE_LOG_LEVEL` | Plain text | Logging level: `debug`, `info`, `warn`, `error` | `.env` / Cloudflare Pages | `info` | `debug` |
| `VITE_ERROR_TRACKING_ENDPOINT` | Plain text URL | Custom error tracking endpoint | `.env` / Cloudflare Pages | (empty) | `https://errors.example.com` |
| `VITE_SENTRY_DSN` | Plain text | Sentry Data Source Name for error tracking | `.env` / Cloudflare Pages | (empty) | `https://xxx@sentry.io/123` |
| `VITE_ERROR_SAMPLE_RATE` | Plain text number | Error sampling rate (0.0 to 1.0) | `.env` / Cloudflare Pages | `1.0` | `0.1` |
| `VITE_ERROR_TRACKING_DEV` | Plain text boolean | Enable error tracking in development | `.env` / Cloudflare Pages | `false` | `true` |
| `VITE_BUILD_VERSION` | Plain text | Build version for error reports | `.env` / Cloudflare Pages | (empty) | `1.2.3` |

### Built-in Vite Variables

These are automatically provided by Vite and don't need configuration:

| Variable | Description | Value |
|----------|-------------|-------|
| `import.meta.env.DEV` | True if running in development mode | `true` / `false` |
| `import.meta.env.PROD` | True if running in production mode | `true` / `false` |
| `import.meta.env.MODE` | Current mode (development/production) | `development` / `production` |

---

## Supabase Edge Function Secrets

These are server-side secrets that must be configured in your Supabase project's Edge Function secrets. They are accessed via `Deno.env.get()` and are never exposed to the client.

> **HOW TO SET**: In Supabase Dashboard → Settings → Edge Functions → Secrets, or via CLI: `supabase secrets set KEY=value`

### Core Supabase Variables (Auto-Provided)

These are automatically available to all Edge Functions when deployed to Supabase:

| Variable | Description | Provided By |
|----------|-------------|-------------|
| `SUPABASE_URL` | Supabase project URL | Supabase (auto) |
| `SUPABASE_ANON_KEY` | Anonymous/public API key | Supabase (auto) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (full database access) | Supabase (auto) |

### AI & Content Generation

| Variable | Type | Required | Used By | Description |
|----------|------|----------|---------|-------------|
| `LOVABLE_API_KEY` | Secret | **Required** | `generate-ai-article`, `amazon-article-pipeline`, `generate-social-content`, `process-accounting-document`, `extract-from-url`, `test-api-setup` | Lovable AI Gateway API key for AI content generation |
| `OPENAI_API_KEY` | Secret | Optional | `health-check` | OpenAI API key (used in health checks) |
| `OPENAI_API` | Secret | Optional | `ai-content-generator` | OpenAI API key (legacy naming) |
| `GEMINI_API_KEY` | Secret | Optional | AI model configs (database) | Google Gemini API key (paid tier) |
| `GEMINI_API_KEY_FREE` | Secret | Optional | AI model configs (database) | Google Gemini API key (free tier) |
| `CLAUDE_API_KEY` | Secret | Optional | AI model configs (database) | Anthropic Claude API key |

### Amazon Affiliate Pipeline

| Variable | Type | Required | Used By | Description |
|----------|------|----------|---------|-------------|
| `SERPAPI_KEY` | Secret | Recommended | `amazon-article-pipeline`, `test-api-setup` | SerpAPI key for product discovery |
| `GOOGLE_SEARCH_API_KEY` | Secret | Fallback | `amazon-article-pipeline`, `test-api-setup` | Google Custom Search API key (alternative to SerpAPI) |
| `GOOGLE_SEARCH_ENGINE_ID` | Secret | Fallback | `amazon-article-pipeline`, `test-api-setup` | Google Custom Search Engine ID (required with `GOOGLE_SEARCH_API_KEY`) |
| `DATAFORSEO_API_LOGIN` | Secret | Optional | `test-api-setup` | DataForSEO API login |
| `DATAFORSEO_API_PASSWORD` | Secret | Optional | `test-api-setup` | DataForSEO API password |

### Email (Resend)

| Variable | Type | Required | Used By | Description |
|----------|------|----------|---------|-------------|
| `RESEND_API` | Secret | **Required** | `send-contact-email`, `newsletter-signup`, `health-check` | Resend API key for transactional emails |

### Email (Amazon SES SMTP)

| Variable | Type | Required | Used By | Description |
|----------|------|----------|---------|-------------|
| `AMAZON_SMTP_ENDPOINT` | Secret | Optional* | `admin-auth`, `send-notification-email`, `send-ticket-email` | Amazon SES SMTP endpoint (e.g., `email-smtp.us-east-1.amazonaws.com`) |
| `AMAZON_SMTP_USER_NAME` | Secret | Optional* | `admin-auth`, `send-notification-email`, `send-ticket-email` | Amazon SES SMTP username |
| `AMAZON_SMTP_PASSWORD` | Secret | Optional* | `admin-auth`, `send-notification-email`, `send-ticket-email` | Amazon SES SMTP password |

> *Required if using Amazon SES for email sending. Alternative to Resend for some email functions.

### Security & Webhooks

| Variable | Type | Required | Used By | Description |
|----------|------|----------|---------|-------------|
| `VAULT_ENCRYPTION_KEY` | Secret | **Required** | `secure-vault` | Encryption key for secure vault storage (base64-encoded 32 bytes) |
| `MAKE_WEBHOOK_SECRET` | Secret | Optional | `receive-email` | Webhook secret for Make.com integration |

### CORS & Environment

| Variable | Type | Required | Used By | Description |
|----------|------|----------|---------|-------------|
| `ALLOWED_ORIGIN` | Plain text | Optional | `optimize-image`, `newsletter-signup`, `_shared/validation.ts` | Allowed CORS origin (defaults to `https://danpearson.net`) |
| `FUNCTION_VERSION` | Plain text | Optional | `health-check` | Version string for health checks (defaults to `1.0.0`) |
| `LOG_LEVEL` | Plain text | Optional | `_shared/production-logger.ts` | Edge Function log level: `debug`, `info`, `warn`, `error` |
| `DENO_ENV` / `ENV` / `NODE_ENV` | Plain text | Optional | `_shared/production-logger.ts` | Environment indicator (set to `production` for production mode) |

---

## Database-Stored API Keys

The platform uses a database table `ai_model_configs` to store AI model configurations. The `api_key_secret_name` column references Supabase Edge Function secrets by name.

### AI Model Configuration Table

| Provider | Model | Secret Name | Priority | Use Case |
|----------|-------|-------------|----------|----------|
| `gemini-paid` | `gemini-3-pro-preview` | `GEMINI_API_KEY` | 1 (highest) | General |
| `gemini-free` | `gemini-2.5-flash` | `GEMINI_API_KEY_FREE` | 2 | General |
| `claude` | `claude-sonnet-4-5-20250929` | `CLAUDE_API_KEY` | 3 | General |
| `lovable` | `google/gemini-2.5-flash` | `LOVABLE_API_KEY` | 4 | General |

> **HOW IT WORKS**: Edge Functions like `generate-ticket-response`, `generate-ai-tasks`, and `test-ai-model` query this table and use the `api_key_secret_name` value to dynamically fetch the corresponding secret from `Deno.env.get()`.

---

## Build & Deploy Configuration

### Cloudflare Pages

Set these in Cloudflare Pages Dashboard → Settings → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | `https://api.danpearson.net` | Your Supabase API URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Your Supabase anon key |
| `VITE_FUNCTIONS_URL` | `https://functions.danpearson.net` | Your Edge Functions URL |
| `NODE_VERSION` | `18` | Required Node version |

### Wrangler Configuration

The `wrangler.toml` file contains Cloudflare Pages build settings:

```toml
name = "pearson-style-showcase"
pages_build_output_dir = "dist"
```

### Build Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Production build |
| `npm run dev` | Development server (port 8080) |
| `npm run preview` | Preview production build locally |

---

## Quick Setup Checklist

### Minimum Required for Development

```bash
# .env file (local development)
VITE_SUPABASE_URL=https://api.danpearson.net
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_FUNCTIONS_URL=https://functions.danpearson.net
```

### Minimum Required Supabase Secrets

For basic functionality, you need at minimum:

```bash
# Set via Supabase CLI or Dashboard
supabase secrets set LOVABLE_API_KEY=your-lovable-key
supabase secrets set RESEND_API=your-resend-key
supabase secrets set VAULT_ENCRYPTION_KEY=your-32-byte-base64-key
```

### Full Feature Set Secrets

For all features including Amazon affiliate pipeline:

```bash
# AI & Content
supabase secrets set LOVABLE_API_KEY=your-lovable-key
supabase secrets set GEMINI_API_KEY=your-gemini-key
supabase secrets set GEMINI_API_KEY_FREE=your-gemini-free-key
supabase secrets set CLAUDE_API_KEY=your-claude-key
supabase secrets set OPENAI_API_KEY=your-openai-key

# Email
supabase secrets set RESEND_API=your-resend-key
supabase secrets set AMAZON_SMTP_ENDPOINT=email-smtp.us-east-1.amazonaws.com
supabase secrets set AMAZON_SMTP_USER_NAME=your-smtp-username
supabase secrets set AMAZON_SMTP_PASSWORD=your-smtp-password

# Amazon Affiliate Pipeline
supabase secrets set SERPAPI_KEY=your-serpapi-key
# OR alternatively:
supabase secrets set GOOGLE_SEARCH_API_KEY=your-google-key
supabase secrets set GOOGLE_SEARCH_ENGINE_ID=your-engine-id

# Optional
supabase secrets set DATAFORSEO_API_LOGIN=your-login
supabase secrets set DATAFORSEO_API_PASSWORD=your-password
supabase secrets set VAULT_ENCRYPTION_KEY=your-encryption-key
supabase secrets set MAKE_WEBHOOK_SECRET=your-webhook-secret
supabase secrets set ALLOWED_ORIGIN=https://danpearson.net
```

---

## Variable Usage by Edge Function

| Edge Function | Required Variables | Optional Variables |
|---------------|-------------------|-------------------|
| `admin-auth` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `AMAZON_SMTP_*` |
| `amazon-article-pipeline` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY` | `SERPAPI_KEY`, `GOOGLE_SEARCH_*` |
| `ai-content-generator` | `OPENAI_API` | |
| `email-webhook-receiver` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | |
| `extract-from-url` | `LOVABLE_API_KEY` | |
| `generate-ai-article` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY` | |
| `generate-ai-tasks` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Dynamic from `ai_model_configs` |
| `generate-social-content` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY` | |
| `generate-ticket-response` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Dynamic from `ai_model_configs` |
| `health-check` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `RESEND_API`, `OPENAI_API_KEY`, `FUNCTION_VERSION` |
| `maintenance-runner` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | |
| `newsletter-signup` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API` | `ALLOWED_ORIGIN` |
| `optimize-image` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `ALLOWED_ORIGIN` |
| `process-accounting-document` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY` | |
| `receive-email` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `MAKE_WEBHOOK_SECRET` |
| `secure-vault` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAULT_ENCRYPTION_KEY` | |
| `send-article-webhook` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | |
| `send-contact-email` | `RESEND_API` | |
| `send-notification-email` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `AMAZON_SMTP_*` |
| `send-ticket-email` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `AMAZON_SMTP_*` (or from mailbox config) |
| `slack-test` | (none - webhook URL passed in request) | |
| `test-ai-model` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Dynamic from `ai_model_configs` |
| `test-api-setup` | | `SERPAPI_KEY`, `GOOGLE_SEARCH_*`, `LOVABLE_API_KEY`, `DATAFORSEO_*` |
| `track-affiliate-click` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | |

---

## Troubleshooting

### "SUPABASE_URL is undefined"
- Ensure your `.env` file exists and has `VITE_SUPABASE_URL` set
- Restart your development server after changing `.env`

### "Edge Function returns 500 error"
- Check Supabase Dashboard → Edge Functions → Logs
- Verify required secrets are set: Settings → Edge Functions → Secrets
- Run `test-api-setup` function to verify API keys

### "API key not found in environment"
- The AI model system uses dynamic secret names from `ai_model_configs` table
- Ensure the secret name in the database matches the actual secret you've set
- Check: `SELECT api_key_secret_name FROM ai_model_configs WHERE is_active = true`

### "CORS error in browser"
- Set `ALLOWED_ORIGIN` secret to your domain
- Or verify the CORS headers in the Edge Function allow your origin

---

**Document Version**: 1.0.0
**Maintained By**: AI Assistants (Claude)
