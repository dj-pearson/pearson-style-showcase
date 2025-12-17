# Migration Guide - Cloud to Self-Hosted Supabase

Complete guide for migrating from cloud Supabase to self-hosted danpearson.net infrastructure.

## 🎯 Migration Overview

This guide covers migrating from:
- **From**: Cloud Supabase (`qazhdcqvjppbbjxzvisp.supabase.co`)
- **To**: Self-hosted Supabase (`api.danpearson.net`) + Edge Functions (`functions.danpearson.net`)

## 📋 Migration Phases

```
Phase 1: Backup & Preparation (30 minutes)
   ↓
Phase 2: Deploy Self-Hosted Supabase (1-2 hours)
   ↓
Phase 3: Deploy Edge Functions (30 minutes)
   ↓
Phase 4: Migrate Database (1-2 hours)
   ↓
Phase 5: Update Client Applications (1 hour)
   ↓
Phase 6: Testing & Validation (1-2 hours)
   ↓
Phase 7: Cut Over & Cleanup (30 minutes)
```

**Total Estimated Time**: 6-9 hours

## 🔄 Phase 1: Backup & Preparation

### 1.1 Backup Cloud Database

```bash
# Using Supabase CLI (logged into cloud project)
supabase db dump -f backup-$(date +%Y%m%d).sql

# Or using pg_dump directly
pg_dump "postgresql://postgres:[PASSWORD]@db.qazhdcqvjppbbjxzvisp.supabase.co:5432/postgres" \
  > backup-$(date +%Y%m%d).sql

# Create compressed backup
gzip backup-$(date +%Y%m%d).sql
```

### 1.2 Export Storage Files

```bash
# List all buckets
supabase storage list

# Download all files from each bucket
mkdir -p storage-backup
supabase storage download --bucket images --output storage-backup/images
supabase storage download --bucket documents --output storage-backup/documents
# ... repeat for each bucket
```

### 1.3 Document Current Configuration

Save current settings:

```bash
# Get project settings
curl https://qazhdcqvjppbbjxzvisp.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY" \
  > current-api-config.json

# Document edge functions
supabase functions list > functions-list.txt

# Export auth settings
# (from Supabase Dashboard → Authentication → Settings)
# Save screenshots or notes of all auth provider configurations
```

### 1.4 Inventory Assets

Create checklist:
- [ ] Database schema
- [ ] Database data
- [ ] Storage buckets and files
- [ ] Edge functions
- [ ] Auth providers configuration
- [ ] RLS policies
- [ ] Database functions and triggers
- [ ] Extensions enabled

## 🚀 Phase 2: Deploy Self-Hosted Supabase

### 2.1 Deploy Supabase to Coolify

**Prerequisites**:
- Coolify instance running
- Docker support
- At least 4GB RAM, 2 CPUs
- 20GB+ storage

**Steps**:

1. **Create New Service in Coolify**:
   - Service Type: Docker Compose
   - Repository: https://github.com/supabase/supabase
   - Branch: master
   - Compose file: `docker/docker-compose.yml`

2. **Configure Environment Variables**:

```env
# PostgreSQL
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=postgres

# Supabase URLs
SITE_URL=https://danpearson.net
ADDITIONAL_REDIRECT_URLS=https://www.danpearson.net,http://localhost:3000

# API URLs
API_EXTERNAL_URL=https://api.danpearson.net
SUPABASE_PUBLIC_URL=https://api.danpearson.net

# JWT Secret (generate new one!)
JWT_SECRET=<generate-secure-jwt-secret>

# Anonymous Key (generate with JWT secret)
ANON_KEY=<generated-anon-key>

# Service Role Key (generate with JWT secret)
SERVICE_ROLE_KEY=<generated-service-role-key>

# Dashboard
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<secure-password>

# SMTP (if using email)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<resend-api-key>
SMTP_SENDER_NAME=danpearson.net
SMTP_ADMIN_EMAIL=admin@danpearson.net
```

3. **Configure Domains**:
   - Add domain: `api.danpearson.net`
   - Enable HTTPS (Let's Encrypt)
   - Configure health check: `/rest/v1/`

4. **Deploy and Verify**:

```bash
# Check API is accessible
curl https://api.danpearson.net/rest/v1/

# Should return: {"message":"This is Supabase API"}

# Check Studio (if exposed)
# Open: https://api.danpearson.net (or studio subdomain)
```

### 2.2 Generate JWT Keys

If you need to generate JWT keys:

```bash
# Generate JWT secret (32+ characters)
openssl rand -base64 32

# Generate Anon Key and Service Role Key
# Use: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
# Or use JWT.io with your secret
```

## 📦 Phase 3: Deploy Edge Functions

### 3.1 Deploy to Coolify

Follow [DEPLOYMENT.md](./DEPLOYMENT.md) to deploy edge functions to `functions.danpearson.net`.

Quick steps:
1. Create service in Coolify
2. Point to `danpearson-edge-functions/`
3. Set environment variables (SUPABASE_URL, keys)
4. Set domain: `functions.danpearson.net`
5. Deploy

### 3.2 Verify Edge Functions

```bash
# Health check
curl https://functions.danpearson.net/_health

# Test function
curl -X POST https://functions.danpearson.net/health-check \
  -H "Content-Type: application/json"
```

## 💾 Phase 4: Migrate Database

### 4.1 Restore Database Schema

```bash
# Decompress backup
gunzip backup-YYYYMMDD.sql.gz

# Connect to self-hosted Supabase
# Get connection string from Coolify environment variables

# Option 1: Via Docker
docker exec -i supabase-db psql -U postgres < backup-YYYYMMDD.sql

# Option 2: Via psql
psql "postgresql://postgres:PASSWORD@api.danpearson.net:5432/postgres" \
  < backup-YYYYMMDD.sql
```

### 4.2 Verify Database Migration

```bash
# Check tables exist
psql "postgresql://..." -c "\dt"

# Check row counts
psql "postgresql://..." -c "SELECT 
  schemaname, 
  tablename, 
  n_live_tup as rows 
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;"

# Check extensions
psql "postgresql://..." -c "\dx"
```

### 4.3 Run Migrations

If you have pending migrations:

```bash
# Using Supabase CLI (pointed to self-hosted)
supabase db reset
supabase db push

# Or using migration files
cd ../supabase
supabase migration up
```

### 4.4 Migrate Storage Files

```bash
# Upload to self-hosted storage
# Using Supabase client or API

# Create buckets
curl -X POST https://api.danpearson.net/storage/v1/bucket \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": "images", "name": "images", "public": true}'

# Upload files
for file in storage-backup/images/*; do
  curl -X POST https://api.danpearson.net/storage/v1/object/images/$(basename $file) \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
    -F "file=@$file"
done
```

### 4.5 Configure RLS Policies

Ensure RLS policies are active:

```sql
-- Check RLS is enabled on tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Re-enable if needed
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Verify policies
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

## 🔄 Phase 5: Update Client Applications

### 5.1 Update Frontend Configuration

**Before**:
```typescript
// Old cloud Supabase
const supabase = createClient(
  'https://qazhdcqvjppbbjxzvisp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // old key
);
```

**After**:
```typescript
// Self-hosted
const supabase = createClient(
  'https://api.danpearson.net',
  'your-new-anon-key' // new key from self-hosted
);
```

### 5.2 Update Environment Variables

Update `.env` files:

```env
# Before
VITE_SUPABASE_URL=https://qazhdcqvjppbbjxzvisp.supabase.co
VITE_SUPABASE_ANON_KEY=old-anon-key

# After
VITE_SUPABASE_URL=https://api.danpearson.net
VITE_SUPABASE_ANON_KEY=new-anon-key
```

Update production environment (Cloudflare Pages):
1. Go to Cloudflare Pages → Your project → Settings → Environment variables
2. Update `VITE_SUPABASE_URL` to `https://api.danpearson.net`
3. Update `VITE_SUPABASE_ANON_KEY` to your new anon key
4. Save and redeploy

### 5.3 Update Edge Function Calls

**Before**:
```typescript
const { data } = await supabase.functions.invoke('my-function', {
  body: { data: 'test' }
});
```

**After**:
```typescript
// Functions are at functions.danpearson.net
const response = await fetch('https://functions.danpearson.net/my-function', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({ data: 'test' }),
});
const data = await response.json();
```

Or create a helper:
```typescript
// lib/functions.ts
export async function invokeFunction(
  name: string, 
  body: any, 
  token?: string
) {
  const response = await fetch(
    `https://functions.danpearson.net/${name}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Function ${name} failed: ${response.statusText}`);
  }
  
  return response.json();
}
```

### 5.4 Update API Calls

Search and replace all hardcoded URLs:

```bash
# Find all references to old Supabase URL
rg "qazhdcqvjppbbjxzvisp.supabase.co" --type ts --type tsx

# Replace with new URL
# Use your IDE's find & replace feature
```

## ✅ Phase 6: Testing & Validation

### 6.1 Test Database Access

```bash
# Test REST API
curl https://api.danpearson.net/rest/v1/users?select=* \
  -H "apikey: YOUR_ANON_KEY"

# Test auth
curl -X POST https://api.danpearson.net/auth/v1/signup \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "testpass123"}'
```

### 6.2 Test Edge Functions

Test each function:

```bash
# Health check function
curl -X POST https://functions.danpearson.net/health-check

# Auth required function
curl -X POST https://functions.danpearson.net/generate-ai-article \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test"}'

# Public function
curl -X POST https://functions.danpearson.net/newsletter-signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com"}'
```

### 6.3 Test Storage

```bash
# Upload test file
curl -X POST https://api.danpearson.net/storage/v1/object/images/test.jpg \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -F "file=@test.jpg"

# Download test file
curl https://api.danpearson.net/storage/v1/object/images/test.jpg \
  -H "apikey: YOUR_ANON_KEY"
```

### 6.4 Test Authentication

```bash
# Sign up
curl -X POST https://api.danpearson.net/auth/v1/signup \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"email": "test@test.com", "password": "TestPass123!"}'

# Sign in
curl -X POST https://api.danpearson.net/auth/v1/token?grant_type=password \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"email": "test@test.com", "password": "TestPass123!"}'

# Get user
curl https://api.danpearson.net/auth/v1/user \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 6.5 Frontend Testing

1. Deploy updated frontend to staging
2. Test all critical user flows:
   - [ ] User registration
   - [ ] User login
   - [ ] Data fetching
   - [ ] Data mutations
   - [ ] File uploads
   - [ ] Edge function calls
   - [ ] Real-time subscriptions (if used)

## 🎬 Phase 7: Cut Over & Cleanup

### 7.1 DNS Updates

If you're using custom domain for the old setup:
1. Update DNS records to point to self-hosted
2. Wait for DNS propagation (can take 24-48 hours)

### 7.2 Deploy to Production

```bash
# Deploy updated frontend
git add .
git commit -m "Migrate to self-hosted Supabase"
git push

# Cloudflare Pages will auto-deploy
```

### 7.3 Monitor Deployment

- Check error rates in Cloudflare analytics
- Monitor edge function logs in Coolify
- Check Supabase logs
- Monitor database performance

### 7.4 Cleanup Old References

Run the cleanup script (see Phase 8 below) to remove old references:

```bash
# From project root
./danpearson-edge-functions/deployment/cleanup-old-supabase.ps1
```

### 7.5 Disable Old Cloud Instance

**⚠️ Only after confirming everything works!**

1. Go to cloud Supabase dashboard
2. Pause the project (keeps data for 7 days)
3. Monitor for any issues
4. After 7 days of successful operation:
   - Download final backup
   - Delete cloud project

## 📊 Post-Migration Checklist

- [ ] Database fully migrated
- [ ] All storage files uploaded
- [ ] Edge functions deployed and working
- [ ] Frontend updated and deployed
- [ ] All API calls working
- [ ] Authentication working
- [ ] Storage access working
- [ ] Real-time working (if used)
- [ ] All cron jobs/scheduled tasks updated
- [ ] Monitoring configured
- [ ] Backups configured
- [ ] Documentation updated
- [ ] Team notified
- [ ] Old references removed
- [ ] Old cloud instance paused/deleted

## 🔄 Rollback Plan

If migration fails:

### Quick Rollback

```bash
# Revert frontend changes
git revert HEAD
git push

# Or revert environment variables in Cloudflare Pages
# Change URLs back to old cloud Supabase
```

### Database Rollback

```bash
# Restore from backup
psql "postgresql://..." < backup-pre-migration.sql
```

## 🆘 Common Migration Issues

### Issue: Database restore fails

**Solution**:
- Check PostgreSQL version compatibility
- Restore schema first, then data
- Check for extension conflicts

### Issue: Authentication not working

**Solution**:
- Verify JWT secret matches between services
- Check auth provider configuration
- Verify email templates

### Issue: Functions returning 500 errors

**Solution**:
- Check environment variables
- Verify Supabase URL is accessible from functions
- Check function logs

### Issue: Storage files not accessible

**Solution**:
- Check bucket policies
- Verify RLS policies on storage.objects
- Check CORS configuration

## 📚 Additional Resources

- [Supabase Self-Hosting Docs](https://supabase.com/docs/guides/self-hosting)
- [Coolify Documentation](https://coolify.io/docs)
- [PostgreSQL Migration Guide](https://www.postgresql.org/docs/current/backup-dump.html)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

**Questions?** Review the troubleshooting guide or check the logs for more details!
