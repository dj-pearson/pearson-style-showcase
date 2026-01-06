# Webhook 500 Error Fix Guide

**Issue**: `send-article-webhook` Edge Function returns 500 error when testing in Settings

**Root Cause**: Empty `webhook_settings` table + Edge Function using `.single()` query

**Date**: 2025-01-06

---

## Quick Fix (2 minutes)

### Option A: Apply Migration (Recommended)

This adds a default row and improves RLS policies:

1. **Apply the migration**:
   ```bash
   # Push migration to your self-hosted Supabase
   cd supabase
   supabase db push
   ```

2. **Redeploy Edge Functions** in Coolify:
   - Go to Edge Functions service
   - Click "Redeploy"
   - Wait for completion

3. **Test webhook** in Admin Dashboard

### Option B: Manual Database Fix

If you can't run migrations, manually insert a row:

1. **Access Supabase Studio** at `https://api.danpearson.net`
2. **Go to SQL Editor**
3. **Run this SQL**:
   ```sql
   INSERT INTO public.webhook_settings (id, webhook_url, enabled)
   VALUES (gen_random_uuid(), '', false)
   ON CONFLICT DO NOTHING;
   ```
4. **Test webhook** in Admin Dashboard

---

## Understanding the Error

### What Happened?

The Edge Function code tries to connect to Supabase:

```typescript
// supabase/functions/send-article-webhook/index.ts
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',          // ❌ Was undefined
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // ❌ Was undefined
);
```

Without these environment variables:
1. Supabase client fails to initialize
2. Cannot query `webhook_settings` table
3. Function returns 500 error

### Why Did This Happen?

When deploying to Coolify, environment variables must be **explicitly configured** in the Coolify UI. They don't automatically transfer from your local `.env` file or Supabase configuration.

---

## Complete Environment Setup (Recommended)

For full functionality, configure all these variables in Coolify:

### Core (Required)

```env
SUPABASE_URL=https://api.danpearson.net
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>
PORT=8000
DOMAIN=functions.danpearson.net
API_GATEWAY_URL=https://api.danpearson.net
DENO_DIR=/app/.deno_cache
```

### AI Services (For article generation)

```env
LOVABLE_API_KEY=<your-lovable-api-key>
OPENAI_API_KEY=<your-openai-key>  # Optional
```

### Email Services (For notifications)

```env
RESEND_API=<your-resend-api-key>
AMAZON_SMTP_ENDPOINT=email-smtp.us-east-1.amazonaws.com
AMAZON_SMTP_USER_NAME=<your-aws-ses-username>
AMAZON_SMTP_PASSWORD=<your-aws-ses-password>
```

### Amazon Pipeline (If using)

```env
SERPAPI_KEY=<your-serpapi-key>
GOOGLE_SEARCH_API_KEY=<your-google-custom-search-key>
GOOGLE_SEARCH_ENGINE_ID=<your-google-cse-id>
```

### Security

```env
VAULT_ENCRYPTION_KEY=<your-32-byte-encryption-key>
MAKE_WEBHOOK_SECRET=<your-webhook-verification-secret>
```

### Optional Configuration

```env
ALLOWED_ORIGIN=https://danpearson.net
FUNCTION_VERSION=1.0.0
LOG_LEVEL=info
```

---

## Troubleshooting

### Still Getting 500 Error After Fix?

**Check 1: Variables Are Set**
```bash
# In Coolify logs, you should NOT see these errors:
# "SUPABASE_URL is not set"
# "SUPABASE_SERVICE_ROLE_KEY is not set"
```

**Check 2: Correct Keys**
```bash
# Test Supabase connectivity directly
curl https://api.danpearson.net/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"

# Should return: 200 OK
```

**Check 3: Service Role Key Has Permissions**
The service role key should have full database access. Verify in Supabase Studio → Settings → API.

### Webhook Settings Not Saving?

**Issue**: Frontend can't reach webhook settings table

**Solution**: Check RLS policies on `webhook_settings` table:
```sql
-- Verify table exists
SELECT * FROM webhook_settings LIMIT 1;

-- Check RLS policies allow authenticated users
SELECT * FROM pg_policies WHERE tablename = 'webhook_settings';
```

### Other Functions Also Failing?

If multiple functions are failing, it's likely all functions are missing environment variables.

**Solution**: Add all variables from "Complete Environment Setup" section above.

---

## Prevention

### For Future Deployments

1. **Document Required Variables**: Keep `danpearson-edge-functions/env.example` updated
2. **Use Secrets Management**: Store in Coolify, not in code
3. **Verify After Deploy**: Always run `verify-edge-functions.ps1` after deploying
4. **Monitor Health**: Set up monitoring for `/_health` endpoint

### Deployment Checklist

- [ ] Code deployed to Coolify
- [ ] Environment variables configured
- [ ] Redeployed service
- [ ] Health check passing (`/_health`)
- [ ] Environment shows configured: `supabaseUrlConfigured: true`
- [ ] Test webhook succeeds
- [ ] No 500 errors in logs

---

## Resources

- **Deployment Guide**: `danpearson-edge-functions/docs/DEPLOYMENT.md`
- **Environment Example**: `danpearson-edge-functions/env.example`
- **Audit Report**: `SELF_HOSTED_SUPABASE_AUDIT.md`
- **Troubleshooting**: `danpearson-edge-functions/docs/TROUBLESHOOTING.md`

---

## Summary

**Problem**: Missing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Coolify

**Solution**: Add environment variables to Coolify and redeploy

**Time to Fix**: ~5 minutes

**Test**: Run `verify-edge-functions.ps1` and test webhook in dashboard

---

**Last Updated**: 2025-01-06  
**Status**: ✅ Resolved
