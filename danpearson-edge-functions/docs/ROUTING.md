# Routing Guide - danpearson.net Infrastructure

Complete guide to routing and DNS configuration for the danpearson.net self-hosted Supabase setup.

## 🌐 Domain Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      danpearson.net                              │
│                   (Main Website/Frontend)                        │
│                   Hosted on: Cloudflare Pages                    │
└────────────┬────────────────────────────────┬───────────────────┘
             │                                │
    ┌────────▼─────────┐            ┌────────▼────────────┐
    │ api.danpearson   │            │ functions.          │
    │    .net          │            │  danpearson.net     │
    │                  │            │                     │
    │ Supabase API     │            │ Edge Functions      │
    │ - Kong Gateway   │            │ - Deno Runtime      │
    │ - Auth Service   │            │ - 22 Functions      │
    │ - REST API       │            │                     │
    │ - Storage API    │            │                     │
    │ - Realtime       │            │                     │
    │                  │            │                     │
    │ Hosted on:       │            │ Hosted on:          │
    │ Coolify (Docker) │            │ Coolify (Docker)    │
    └──────────────────┘            └─────────────────────┘
```

## 📋 Domain Breakdown

### Primary Domains

| Domain | Purpose | Service | Port | SSL |
|--------|---------|---------|------|-----|
| `danpearson.net` | Main website/frontend | Cloudflare Pages | 443 | ✅ |
| `api.danpearson.net` | Supabase API Gateway | Coolify/Docker | 443 | ✅ |
| `functions.danpearson.net` | Edge Functions | Coolify/Docker | 443 | ✅ |

### Optional Subdomains

| Domain | Purpose | Service |
|--------|---------|---------|
| `studio.danpearson.net` | Supabase Studio (if exposed) | Coolify/Docker |
| `www.danpearson.net` | WWW redirect to apex | Cloudflare |
| `staging.danpearson.net` | Staging environment | Cloudflare Pages |

## 🔧 DNS Configuration

### Required DNS Records

Add these records in your DNS provider (Cloudflare, etc.):

```dns
# Main website (Cloudflare Pages)
danpearson.net.              A       76.76.21.21  (Cloudflare)
danpearson.net.              AAAA    2606:4700:...  (Cloudflare IPv6)
www.danpearson.net.          CNAME   danpearson.net.

# API Gateway (Coolify server)
api.danpearson.net.          A       YOUR_COOLIFY_SERVER_IP
api.danpearson.net.          AAAA    YOUR_COOLIFY_SERVER_IPV6 (if available)

# Edge Functions (Coolify server)
functions.danpearson.net.    A       YOUR_COOLIFY_SERVER_IP
functions.danpearson.net.    AAAA    YOUR_COOLIFY_SERVER_IPV6 (if available)

# Optional: Supabase Studio
studio.danpearson.net.       A       YOUR_COOLIFY_SERVER_IP
```

### Cloudflare DNS Settings

If using Cloudflare:

1. **Proxy Status**:
   - `danpearson.net` → ☁️ Proxied (orange cloud)
   - `api.danpearson.net` → 🌐 DNS Only (gray cloud) *
   - `functions.danpearson.net` → 🌐 DNS Only (gray cloud) *

   \* **Important**: Keep API and Functions as DNS Only to avoid double-SSL issues with Coolify's Let's Encrypt

2. **SSL/TLS Settings**:
   - Encryption mode: Full (strict)
   - Always Use HTTPS: On
   - Automatic HTTPS Rewrites: On

## 🔀 Routing Rules

### Frontend (danpearson.net)

All static content served from Cloudflare Pages:

```
https://danpearson.net/              → Main site
https://danpearson.net/blog          → Blog pages
https://danpearson.net/dashboard     → User dashboard
```

### API Gateway (api.danpearson.net)

All Supabase API calls:

```
https://api.danpearson.net/rest/v1/*         → PostgREST API
https://api.danpearson.net/auth/v1/*         → Auth endpoints
https://api.danpearson.net/storage/v1/*      → Storage API
https://api.danpearson.net/realtime/v1/*     → Realtime subscriptions
https://api.danpearson.net/                  → Supabase Studio (if exposed)
```

### Edge Functions (functions.danpearson.net)

All serverless function calls:

```
https://functions.danpearson.net/_health                     → Health check
https://functions.danpearson.net/                            → Function list
https://functions.danpearson.net/{function-name}             → Execute function
```

Example function URLs:
```
https://functions.danpearson.net/generate-ai-article
https://functions.danpearson.net/newsletter-signup
https://functions.danpearson.net/send-contact-email
```

## 💻 Client Code Configuration

### Supabase Client Setup

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL; // https://api.danpearson.net
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Edge Functions Client Setup

```typescript
// lib/functions.ts

const FUNCTIONS_URL = 'https://functions.danpearson.net';

export async function invokeFunction<T = any>(
  name: string,
  body?: any,
  options?: {
    token?: string;
    headers?: Record<string, string>;
  }
): Promise<T> {
  const response = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.token && { 'Authorization': `Bearer ${options.token}` }),
      ...options?.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Function ${name} failed: ${error.error || response.statusText}`);
  }

  return response.json();
}

// Usage example
const result = await invokeFunction('generate-ai-article', {
  title: 'My Article',
  content: 'Article content...',
}, {
  token: session.access_token,
});
```

### Environment Variables

**Development (`.env.local`)**:
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
VITE_FUNCTIONS_URL=http://localhost:8000
```

**Production (Cloudflare Pages Environment Variables)**:
```env
VITE_SUPABASE_URL=https://api.danpearson.net
VITE_SUPABASE_ANON_KEY=your-production-anon-key
VITE_FUNCTIONS_URL=https://functions.danpearson.net
```

## 🔒 SSL/TLS Configuration

### Coolify SSL

Coolify automatically provisions Let's Encrypt SSL certificates for:
- `api.danpearson.net`
- `functions.danpearson.net`

**Configuration**:
1. In Coolify, for each service:
   - Go to Domains tab
   - Add domain
   - Enable "Automatic HTTPS"
2. Coolify will automatically:
   - Request Let's Encrypt certificate
   - Renew certificates before expiration
   - Configure Traefik reverse proxy with SSL

### Certificate Renewal

Automatic renewal is handled by Coolify/Let's Encrypt:
- Certificates valid for 90 days
- Auto-renewal 30 days before expiration
- No manual intervention needed

Verify certificates:
```bash
# Check API certificate
curl -vI https://api.danpearson.net 2>&1 | grep "SSL certificate"

# Check Functions certificate
curl -vI https://functions.danpearson.net 2>&1 | grep "SSL certificate"
```

## 🛣️ Request Flow

### Example: User Sign In

```
1. User visits https://danpearson.net/login
   ↓
2. Frontend loads from Cloudflare Pages
   ↓
3. User enters credentials
   ↓
4. Frontend calls: https://api.danpearson.net/auth/v1/token
   ↓
5. Kong Gateway (api.danpearson.net) routes to Auth service
   ↓
6. Auth service validates credentials
   ↓
7. Returns JWT token
   ↓
8. Frontend stores token
```

### Example: Generate AI Article

```
1. User clicks "Generate Article" in dashboard
   ↓
2. Frontend calls: https://functions.danpearson.net/generate-ai-article
   Headers: { Authorization: Bearer <JWT> }
   Body: { title: "...", topic: "..." }
   ↓
3. Edge Functions server receives request
   ↓
4. Function verifies JWT with api.danpearson.net
   ↓
5. Function generates article using AI
   ↓
6. Function stores in database via api.danpearson.net/rest/v1
   ↓
7. Returns generated article to frontend
   ↓
8. Frontend displays article
```

### Example: Upload Image

```
1. User uploads image in dashboard
   ↓
2. Frontend calls: https://api.danpearson.net/storage/v1/object/images/file.jpg
   Headers: { Authorization: Bearer <JWT> }
   Body: FormData with file
   ↓
3. Kong Gateway routes to Storage service
   ↓
4. Storage service verifies JWT
   ↓
5. Checks RLS policies
   ↓
6. Stores file in storage bucket
   ↓
7. Returns public URL
   ↓
8. Frontend displays image
```

## 🔄 CORS Configuration

### API Gateway CORS

Kong (Supabase API Gateway) handles CORS automatically for:
- `https://danpearson.net`
- `https://www.danpearson.net`
- `http://localhost:3000` (development)

Configure in Supabase:
```sql
-- In your database
UPDATE auth.config 
SET site_url = 'https://danpearson.net',
    additional_redirect_urls = 'https://www.danpearson.net,http://localhost:3000';
```

### Edge Functions CORS

Configured in `server.ts`:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specific domain
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Max-Age': '86400',
};
```

For production, restrict to your domain:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://danpearson.net',
  // ... other headers
};
```

## 🌍 CDN & Caching

### Cloudflare Page Rules

Recommended Cloudflare settings:

**For `danpearson.net`**:
- Cache Level: Standard
- Browser Cache TTL: Respect Existing Headers
- Always Use HTTPS: On

**For `api.danpearson.net`**:
- Cache Level: Bypass (API calls should not be cached)
- SSL: Full (strict)

**For `functions.danpearson.net`**:
- Cache Level: Bypass (function responses should not be cached)
- SSL: Full (strict)

### Cache Headers

Add cache headers in your frontend:

```typescript
// For static assets
export const headers = {
  'Cache-Control': 'public, max-age=31536000, immutable',
};

// For API calls (no cache)
fetch('https://api.danpearson.net/rest/v1/...', {
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  },
});
```

## 🧪 Testing Routing

### Test DNS Resolution

```bash
# Check DNS propagation
dig danpearson.net
dig api.danpearson.net
dig functions.danpearson.net

# Or use online tools
# https://dnschecker.org
```

### Test SSL Certificates

```bash
# Check SSL
curl -vI https://api.danpearson.net
curl -vI https://functions.danpearson.net

# Check certificate expiry
echo | openssl s_client -servername api.danpearson.net \
  -connect api.danpearson.net:443 2>/dev/null | \
  openssl x509 -noout -dates
```

### Test Endpoints

```bash
# Main site
curl -I https://danpearson.net

# API
curl https://api.danpearson.net/rest/v1/

# Functions
curl https://functions.danpearson.net/_health
```

### Test CORS

```bash
# Test preflight
curl -X OPTIONS https://functions.danpearson.net/health-check \
  -H "Origin: https://danpearson.net" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Should return CORS headers
```

## 🐛 Troubleshooting Routing

### DNS Not Resolving

**Symptoms**: Domain doesn't resolve to IP

**Solutions**:
1. Check DNS records are correct
2. Wait for DNS propagation (up to 48 hours)
3. Clear DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
4. Test with different DNS: `nslookup danpearson.net 8.8.8.8`

### SSL Certificate Errors

**Symptoms**: Browser shows SSL warnings

**Solutions**:
1. Verify domain is configured in Coolify
2. Check Coolify has provisioned Let's Encrypt cert
3. Ensure DNS points to correct IP
4. Check Cloudflare proxy status (should be DNS Only)
5. Wait for certificate provisioning (can take a few minutes)

### CORS Errors

**Symptoms**: Browser blocks requests with CORS error

**Solutions**:
1. Check CORS headers in `server.ts`
2. Verify origin is allowed
3. Add `OPTIONS` handler
4. Check preflight request succeeds

### 502 Bad Gateway

**Symptoms**: Accessing domain returns 502

**Solutions**:
1. Verify service is running in Coolify
2. Check port is exposed correctly (8000)
3. Verify health check passes
4. Check Traefik logs in Coolify

## 📝 Routing Checklist

Before going live:

- [ ] DNS records configured
- [ ] DNS propagated (use dnschecker.org)
- [ ] SSL certificates provisioned
- [ ] Main site loads (danpearson.net)
- [ ] API accessible (api.danpearson.net)
- [ ] Functions accessible (functions.danpearson.net)
- [ ] Health checks pass
- [ ] CORS configured correctly
- [ ] Authentication works
- [ ] API calls work from frontend
- [ ] Function calls work from frontend
- [ ] Storage uploads work
- [ ] All subdomains resolve
- [ ] SSL certificates valid
- [ ] Redirects working (www to apex)

## 📚 Additional Resources

- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)
- [Coolify Domain Configuration](https://coolify.io/docs/knowledge-base/domains)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [CORS Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**Need help?** Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common routing issues!
