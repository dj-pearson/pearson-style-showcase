# danpearson.net Edge Functions

Complete, production-ready setup for running Supabase Edge Functions for danpearson.net with self-hosted Supabase.

**Where the code lives**: function source is in `supabase/functions/` at the repository root, and that is the single source of truth. This directory holds only the runtime that serves it: `server.ts`, the Dockerfile, compose file, deployment scripts and docs. There is no `functions/` directory here any more; a second copy used to exist and drifted from the first. Because the image needs both halves, the Docker build context is the repository root:

```bash
docker build -f danpearson-edge-functions/Dockerfile .
```

## 🌐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     danpearson.net                           │
│                    (Main Website)                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴────────────────┐
          │                                │
    ┌─────▼──────────┐          ┌────────▼─────────┐
    │ api.danpearson │          │ functions.       │
    │    .net        │          │ danpearson.net   │
    │  (Kong/API)    │          │ (Edge Functions) │
    │                │          │                  │
    │ - REST API     │          │ - Deno Runtime   │
    │ - Auth         │          │ - Dynamic Load   │
    │ - Storage      │          │ - 31 Functions   │
    │ - Realtime     │          │ - Health Checks  │
    └────────┬───────┘          └──────────────────┘
             │
    ┌────────▼──────────┐
    │  Self-Hosted      │
    │  Supabase         │
    │  PostgreSQL DB    │
    │  (Coolify)        │
    └───────────────────┘
```

## 📋 Features

- ✅ **31 Edge Functions** - Served from `supabase/functions/` at the repo root
- ✅ **Deno Runtime** - v1.40.0 with full TypeScript support
- ✅ **Dynamic Loading** - Auto-discovers functions, no restart needed
- ✅ **Health Checks** - Built-in monitoring endpoints
- ✅ **CORS Support** - Pre-configured for all origins
- ✅ **Docker Ready** - Production Dockerfile + docker-compose
- ✅ **Self-Hosted** - Works with your Coolify Supabase instance
- ✅ **GitHub Actions** - Automated deployment workflow
- ✅ **Environment Secrets** - Never commits sensitive data

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Self-hosted Supabase instance running at `api.danpearson.net`
- Supabase API keys (anon and service role)

### Local Development

1. **Copy environment file**:

   ```bash
   cp env.example .env
   ```

2. **Edit `.env`** with your Supabase credentials:

   ```env
   SUPABASE_URL=https://api.danpearson.net
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Start the server**:

   ```bash
   docker-compose up
   ```

4. **Test health endpoint**:

   ```bash
   curl http://localhost:8000/_health
   ```

5. **Test a function**:
   ```bash
   curl -X POST http://localhost:8000/health-check \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

## 📁 Directory Structure

The runtime and the function source sit side by side under the repository root:

```
<repo root>/
├── danpearson-edge-functions/    # Runtime only (this directory)
│   ├── Dockerfile                # Production Docker image (build from repo root)
│   ├── docker-compose.yml        # Local development
│   ├── server.ts                 # Deno HTTP server
│   ├── .env                      # Local secrets (gitignored)
│   ├── env.example               # Environment template
│   │
│   ├── deployment/               # Deployment scripts
│   │   ├── deploy-github.yml     # GitHub Actions workflow
│   │   ├── deploy-coolify.sh     # Coolify deployment
│   │   ├── setup-secrets.ps1     # Environment setup
│   │   └── cleanup-old-supabase.ps1 # Old cloud URL rewrite
│   │
│   └── docs/                     # Documentation
│       ├── DEPLOYMENT.md         # Deployment guide
│       ├── MIGRATION.md          # Migration from cloud
│       ├── ROUTING.md            # Domain routing
│       └── TROUBLESHOOTING.md    # Common issues
│
└── supabase/functions/           # Edge Functions (single source of truth)
    ├── _shared/                  # Shared utilities
    │   ├── cors.ts              # CORS helpers
    │   ├── csrf-protection.ts   # CSRF protection
    │   ├── production-logger.ts # Logging
    │   ├── rate-limiter.ts      # Rate limiting
    │   ├── require-admin.ts     # Admin caller checks
    │   ├── validation.ts        # Input validation
    │   ├── webhook-security.ts  # Webhook verification
    │   └── ...                  # 12 more helpers, plus __tests__/
    │
    ├── admin-auth/              # Admin authentication
    ├── ai-content-generator/    # AI content generation
    ├── amazon-article-pipeline/ # Amazon article workflow
    ├── auth-proxy/              # GoTrue auth proxy with CORS
    ├── coolify-health/          # Coolify container health
    ├── coolify-proxy/           # Coolify API proxy
    ├── create-invoice-from-document/ # Invoice from parsed document
    ├── email-webhook-receiver/  # Email webhook handler
    ├── extract-from-url/        # URL content extraction
    ├── generate-ai-article/     # AI article generation
    ├── generate-ai-tasks/       # AI task generation
    ├── generate-social-content/ # Social media content
    ├── generate-ticket-response/# Support ticket responses
    ├── google-indexing/         # Google Indexing API submissions
    ├── health-check/            # Health check function
    ├── health-dashboard/        # System health JSON for /status
    ├── maintenance-runner/      # Maintenance tasks
    ├── newsletter-signup/       # Newsletter subscriptions
    ├── oauth-proxy/             # OAuth authorize/callback flow
    ├── optimize-image/          # Image optimization
    ├── process-accounting-document/ # Document processing
    ├── receive-email/           # Email receiver
    ├── secure-vault/            # Secure vault operations
    ├── send-article-webhook/    # Article webhooks
    ├── send-contact-email/      # Contact form emails
    ├── send-notification-email/ # Notification emails
    ├── send-ticket-email/       # Support ticket emails
    ├── slack-test/              # Slack webhook test
    ├── test-ai-model/           # AI model testing
    ├── test-api-setup/          # API setup testing
    └── track-affiliate-click/   # Affiliate tracking
```

Inside the container the functions land at `/app/functions/<name>/index.ts`, so container paths in these docs are unaffected by where the source lives in Git.

## 🔧 Configuration

### Environment Variables

| Variable                    | Required | Description                                           |
| --------------------------- | -------- | ----------------------------------------------------- |
| `SUPABASE_URL`              | Yes      | Self-hosted Supabase URL (https://api.danpearson.net) |
| `SUPABASE_ANON_KEY`         | Yes      | Public API key                                        |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Admin API key (keep secret!)                          |
| `PORT`                      | No       | Server port (default: 8000)                           |
| `DOMAIN`                    | No       | Functions domain (functions.danpearson.net)           |
| `API_GATEWAY_URL`           | No       | API gateway URL (https://api.danpearson.net)          |

### Domain Routing

- **api.danpearson.net** → Self-hosted Supabase (Kong, Auth, REST, Storage, Realtime)
- **functions.danpearson.net** → Edge Functions (this service)
- **danpearson.net** → Main website (Cloudflare Pages)

## 🚢 Deployment

### Option 1: Coolify (Recommended)

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed Coolify deployment instructions.

**Quick Steps**:

1. Create new service in Coolify
2. Connect to GitHub repository
3. Set build context: repository root (`.`)
4. Set Dockerfile path: `danpearson-edge-functions/Dockerfile`
5. Configure environment variables
6. Set domain: `functions.danpearson.net`
7. Deploy!

### Option 2: Docker (Generic)

```bash
# Build image (run from the repository root)
docker build -f danpearson-edge-functions/Dockerfile -t danpearson-edge-functions .

# Run container
docker run -d \
  --name danpearson-functions \
  -p 8000:8000 \
  -e SUPABASE_URL=https://api.danpearson.net \
  -e SUPABASE_ANON_KEY=your-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  danpearson-edge-functions
```

### Option 3: GitHub Actions

Automated deployment on push to `main`:

```yaml
# .github/workflows/deploy-edge-functions.yml
name: Deploy Edge Functions
on:
  push:
    branches: [main]
    paths:
      - 'supabase/functions/**'
      - 'danpearson-edge-functions/**'
# ... see deployment/deploy-github.yml for full workflow
```

## 🧪 Testing

### Local Testing

```bash
# Start server
docker-compose up

# Health check
curl http://localhost:8000/_health

# List all functions
curl http://localhost:8000/

# Test specific function
curl -X POST http://localhost:8000/health-check \
  -H "Content-Type: application/json" \
  -d '{}'

# Test with authentication
curl -X POST http://localhost:8000/generate-ai-article \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"title": "Test Article"}'
```

### Production Testing

```bash
# Health check
curl https://functions.danpearson.net/_health

# Test function
curl -X POST https://functions.danpearson.net/health-check \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 📊 Monitoring

### Health Endpoint Response

```json
{
  "status": "healthy",
  "timestamp": "2025-12-17T...",
  "domain": "functions.danpearson.net",
  "runtime": "deno",
  "version": "1.40.0",
  "environment": {
    "supabaseUrlConfigured": true,
    "anonKeyConfigured": true,
    "serviceRoleKeyConfigured": true
  },
  "functions": 31,
  "functionList": [
    "admin-auth",
    "ai-content-generator",
    "amazon-article-pipeline",
    ...
  ]
}
```

### Logging

View logs in real-time:

```bash
docker-compose logs -f edge-functions
```

Or in Coolify:

- Navigate to your service
- Click "Logs" tab
- View real-time or historical logs

## 🔒 Security

### Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use Coolify/GitHub secrets for production
   - Rotate keys regularly

2. **Service Role Key**
   - Only use in server-side functions
   - Never expose to client-side code
   - Has full database access - protect it!

3. **CORS Configuration**
   - Update `server.ts` for production domains
   - Restrict origins if needed

4. **Rate Limiting**
   - Implement at API Gateway level (Kong)
   - Use shared rate-limiter utility

5. **Input Validation**
   - Use shared validation utilities
   - Validate all function inputs

### JWT Verification

Functions can verify JWT tokens:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// In your function
const authHeader = req.headers.get('Authorization');
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  { global: { headers: { Authorization: authHeader } } }
);

const {
  data: { user },
  error,
} = await supabase.auth.getUser();
if (error || !user) {
  return new Response('Unauthorized', { status: 401 });
}
```

## 🐛 Troubleshooting

### Common Issues

**Container won't start**:

- Check `.env` file exists and has all required values
- Verify Supabase URL is accessible
- Check logs: `docker-compose logs edge-functions`

**Function not found (404)**:

- Verify function directory exists: `supabase/functions/{name}/index.ts`
- Check function name in URL matches directory
- Restart container: `docker-compose restart`

**Bad Gateway (502)**:

- Verify port is exposed correctly (8000)
- Check health endpoint: `curl http://localhost:8000/_health`
- Verify reverse proxy configuration

**CORS errors**:

- Update `corsHeaders` in `server.ts`
- Add your domain to allowed origins
- Rebuild: `docker-compose up --build`

See [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for more.

## 📚 Additional Documentation

- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Detailed deployment instructions
- **[MIGRATION.md](./docs/MIGRATION.md)** - Migrating from cloud Supabase
- **[ROUTING.md](./docs/ROUTING.md)** - Domain routing configuration
- **[TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🔄 Migration from Cloud Supabase

See [docs/MIGRATION.md](./docs/MIGRATION.md) for complete migration guide including:

1. Database backup and export
2. Data migration to self-hosted instance
3. Function migration (this repo)
4. DNS and routing updates
5. Client code updates
6. Cleanup of old references

## 📝 Function Development

### Creating a New Function

1. Create function directory under the canonical source tree:

   ```bash
   mkdir -p supabase/functions/my-new-function
   ```

2. Create `supabase/functions/my-new-function/index.ts`. It must export a default
   handler; `server.ts` dispatches on `functionModule.default` and `serve(handler)`
   will not be called:

   ```typescript
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

   export default async (req: Request): Promise<Response> => {
     try {
       // Your function logic here
       const { data } = await req.json();

       // Create Supabase client
       const supabase = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_ANON_KEY') ?? ''
       );

       // Process request
       const result = await processData(data);

       return new Response(JSON.stringify({ success: true, result }), {
         headers: { 'Content-Type': 'application/json' },
         status: 200,
       });
     } catch (error) {
       console.error('Function error:', error);
       return new Response(JSON.stringify({ error: 'Function execution failed' }), { status: 500 });
     }
   };
   ```

3. Test locally:

   ```bash
   curl -X POST http://localhost:8000/my-new-function \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-jwt-token" \
     -d '{"test": "data"}'
   ```

   New functions require a bearer token by default. To make one reachable without
   auth, add its name to `PUBLIC_FUNCTIONS` in `danpearson-edge-functions/server.ts`;
   that set is what the deployment enforces, not `supabase/config.toml`.

4. Deploy:
   ```bash
   git add supabase/functions/my-new-function/
   git commit -m "Add my-new-function"
   git push
   ```

## 🤝 Contributing

When adding or modifying functions:

1. Test locally first
2. Follow existing function patterns
3. Use shared utilities in `supabase/functions/_shared/`
4. Add appropriate error handling
5. Update this README if needed

## 📄 License

Part of the danpearson.net project.

---

**Ready to deploy?** See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) to get started!
