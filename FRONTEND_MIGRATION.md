# Frontend Migration to Self-Hosted Supabase

Complete guide for migrating your frontend from cloud Supabase to self-hosted danpearson.net infrastructure.

## ✅ **What's Already Done**

- ✅ Supabase client updated to use environment variables
- ✅ Edge functions helper created (`src/lib/edge-functions.ts`)
- ✅ Environment setup script created
- ✅ Self-hosted infrastructure deployed and running

## 🔄 **Migration Steps**

### Step 1: Set Up Environment Variables

Run the setup script:

```powershell
.\setup-frontend-env.ps1
```

This creates `.env.local` with:
```env
VITE_SUPABASE_URL=https://api.danpearson.net
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
VITE_FUNCTIONS_URL=https://functions.danpearson.net
```

### Step 2: Update Function Invocations

Your code currently uses `supabase.functions.invoke()` which works with cloud Supabase but needs updating for self-hosted.

**Files that need updating** (found 15+ instances):
- `src/hooks/useAffiliateTracking.ts`
- `src/components/NewsletterSignup.tsx`
- `src/contexts/AuthContext.tsx`
- `src/lib/session-rotation.ts`
- `src/lib/error-alerting.ts`
- `src/pages/AdminLogin.tsx`
- `src/components/AffiliateLink.tsx`
- `src/components/ContactForm.tsx`
- `src/hooks/useImageOptimization.ts`
- And more...

#### Migration Pattern

**Before** (cloud Supabase):
```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.functions.invoke('my-function', {
  body: { key: 'value' }
});
```

**After** (self-hosted):
```typescript
import { invokeEdgeFunction } from '@/lib/edge-functions';

const { data, error } = await invokeEdgeFunction('my-function', {
  body: { key: 'value' }
});
```

The API is identical - it's a drop-in replacement!

### Step 3: Automated Migration

Use the helper script to update function calls automatically:

```powershell
# Dry run - see what would change
cd danpearson-edge-functions\deployment
.\cleanup-old-supabase.ps1 -DryRun

# Apply changes with backup
.\cleanup-old-supabase.ps1 -Backup
```

### Step 4: Manual Updates (If Needed)

Some function calls may need manual review. Search for:

```typescript
supabase.functions.invoke(
```

And replace with:

```typescript
import { invokeEdgeFunction } from '@/lib/edge-functions';
// ...
invokeEdgeFunction(
```

### Step 5: Update Production Environment

Update Cloudflare Pages environment variables:

1. Go to Cloudflare Pages Dashboard
2. Select your project (pearson-style-showcase)
3. Go to Settings → Environment variables
4. Update these variables:

```env
VITE_SUPABASE_URL=https://api.danpearson.net
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NjAwMTU0MCwiZXhwIjo0OTIxNjc1MTQwLCJyb2xlIjoiYW5vbiJ9.smyKT5KYiVNCQLTvQR-r1V3auuuxr7eQznTYzSCThUY
VITE_FUNCTIONS_URL=https://functions.danpearson.net
```

5. Save and redeploy

### Step 6: Test Locally

```bash
# Install dependencies (if needed)
npm install

# Start dev server
npm run dev
```

Test critical flows:
- [ ] User authentication (sign up, login, logout)
- [ ] Data fetching from database
- [ ] Function calls (newsletter signup, contact form, etc.)
- [ ] Admin functions
- [ ] File uploads

### Step 7: Deploy to Production

```bash
git add .
git commit -m "Migrate to self-hosted Supabase at api.danpearson.net"
git push
```

Cloudflare Pages will auto-deploy.

## 🔍 **Verification Checklist**

After deployment:

- [ ] Health check: `curl https://api.danpearson.net/rest/v1/`
- [ ] Functions health: `curl https://functions.danpearson.net/_health`
- [ ] Frontend loads without errors
- [ ] Authentication works
- [ ] Database reads/writes work
- [ ] Function calls work
- [ ] Storage uploads work
- [ ] No console errors

## 📋 **Function Migration Reference**

### Authentication Functions

```typescript
// admin-auth
const { data, error } = await invokeEdgeFunction('admin-auth', {
  body: { action: 'me' }
});
```

### Newsletter & Contact

```typescript
// newsletter-signup
await invokeEdgeFunction('newsletter-signup', {
  body: { email: 'user@example.com' }
});

// send-contact-email
await invokeEdgeFunction('send-contact-email', {
  body: { name, email, message }
});
```

### AI Functions

```typescript
// generate-ai-article
await invokeEdgeFunction('generate-ai-article', {
  body: { title, topic, keywords }
});

// generate-ai-tasks
await invokeEdgeFunction('generate-ai-tasks', {
  body: { context }
});
```

### Tracking & Analytics

```typescript
// track-affiliate-click
await invokeEdgeFunction('track-affiliate-click', {
  body: { url, productId }
});
```

## 🐛 **Troubleshooting**

### Issue: Functions return 404

**Cause**: Function name mismatch or function not deployed

**Fix**:
```bash
curl https://functions.danpearson.net/
# Check if your function is listed
```

### Issue: Authentication errors

**Cause**: Old session tokens or JWT issues

**Fix**:
1. Clear localStorage
2. Log out and log back in
3. Check JWT token is valid

### Issue: CORS errors

**Cause**: Domain not allowed in CORS headers

**Fix**: Update `danpearson-edge-functions/server.ts`:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://danpearson.net',
  // ...
};
```

### Issue: Environment variables not loading

**Cause**: .env.local not being read or wrong variable names

**Fix**:
1. Verify `.env.local` exists
2. Restart dev server
3. Check variable names start with `VITE_`
4. Use `import.meta.env.VITE_...`

## 📚 **Additional Resources**

- [Edge Functions Helper](./src/lib/edge-functions.ts)
- [Supabase Client](./src/integrations/supabase/client.ts)
- [Edge Functions Docs](./danpearson-edge-functions/README.md)
- [Deployment Guide](./danpearson-edge-functions/docs/DEPLOYMENT.md)

## 🆘 **Need Help?**

1. Check browser console for errors
2. Check edge functions logs in Coolify
3. Verify environment variables are set
4. Test API and functions health endpoints

---

**Ready to migrate?** Follow the steps above in order!
