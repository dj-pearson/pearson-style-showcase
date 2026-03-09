# Supabase Auth CORS Fix for api.danpearson.net

## Problem

When loading the login page or refreshing tokens, you see:

```
Access to fetch at 'https://api.danpearson.net/auth/v1/token?grant_type=refresh_token' 
from origin 'https://danpearson.net' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

This means the **Supabase Auth API** (GoTrue) at `api.danpearson.net` is not returning CORS headers that allow requests from `https://danpearson.net`.

## Solution: Configure Supabase / Kong / GoTrue

The fix must be applied on your **Supabase infrastructure** (api.danpearson.net), not in the frontend code.

### Option 1: Supabase Docker (Standard Self-Hosted)

If you use the official Supabase Docker setup, add/update these in your `docker-compose.yml` or `.env` for the **auth** (GoTrue) service:

```yaml
# For auth (GoTrue) service
auth:
  environment:
    GOTRUE_SITE_URL: "https://danpearson.net"
    GOTRUE_URI_ALLOW_LIST: "https://danpearson.net,https://www.danpearson.net,http://localhost:8080"
```

### Option 2: Kong API Gateway CORS Plugin

If CORS is still blocked, Kong (the API gateway in front of Supabase) may need a CORS plugin. Add a Kong plugin or update `kong.yml`:

```yaml
plugins:
  - name: cors
    config:
      origins:
        - https://danpearson.net
        - https://www.danpearson.net
        - http://localhost:8080
      methods:
        - GET
        - POST
        - PUT
        - PATCH
        - DELETE
        - OPTIONS
      headers:
        - Accept
        - Authorization
        - Content-Type
        - apikey
        - x-client-info
      exposed_headers:
        - X-Auth-Token
      credentials: true
```

### Option 3: Reverse Proxy (Nginx / Cloudflare / Traefik)

If `api.danpearson.net` sits behind Nginx, Cloudflare, or another proxy, ensure it forwards CORS headers or adds them for OPTIONS (preflight) requests:

**Nginx example:**
```nginx
location /auth/ {
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' 'https://danpearson.net';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, apikey, x-client-info';
        add_header 'Access-Control-Allow-Credentials' 'true';
        add_header 'Access-Control-Max-Age' 86400;
        return 204;
    }
    # ... proxy_pass to Supabase
}
```

**Cloudflare:** Ensure "CORS" or custom headers are not stripping or blocking. Check Transform Rules for any overrides.

### Option 4: Coolify / Self-Hosted Platform

If you use Coolify or another platform to run Supabase:

1. Open the Supabase stack (api.danpearson.net) environment variables.
2. Add for the auth service:
   - `GOTRUE_SITE_URL` = `https://danpearson.net`
   - `GOTRUE_URI_ALLOW_LIST` = `https://danpearson.net,https://www.danpearson.net`
3. Restart the auth container.
4. If you have a Kong or custom config, add CORS headers as in Option 2.

## Quick Test

After applying the fix:

```bash
curl -X OPTIONS -H "Origin: https://danpearson.net" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  -v https://api.danpearson.net/auth/v1/token
```

The response should include `Access-Control-Allow-Origin: https://danpearson.net` (or your configured origin).

## Temporary Workaround: Clear Session

If you had a session that is now failing to refresh:

1. Open DevTools → Application → Storage.
2. Clear site data for `danpearson.net` (or at least Local Storage).
3. Try logging in again.

This removes the old refresh token and forces a fresh login. If CORS is still wrong, login will still fail.

## References

- [Supabase Auth Self-hosting Config](https://supabase.com/docs/guides/self-hosting/auth/config)
- [Supabase Self-Hosting Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [GoTrue Configuration](https://github.com/supabase/auth?tab=readme-ov-file#configuration)
