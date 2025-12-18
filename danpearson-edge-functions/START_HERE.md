# 🎯 START HERE - danpearson.net Edge Functions

Welcome to your complete edge functions setup for danpearson.net with self-hosted Supabase!

## 📦 What You Have

Your `danpearson-edge-functions` directory contains everything you need to run 22 serverless functions on your self-hosted infrastructure:

```
✅ 22 Edge Functions (ready to deploy)
✅ Deno Runtime (v1.40.0)
✅ Docker Configuration (production-ready)
✅ Deployment Scripts (Coolify, GitHub Actions)
✅ Complete Documentation
✅ Migration Guides
✅ Cleanup Scripts
```

## 🚀 Quick Start (Choose Your Path)

### Path 1: Deploy to Production NOW ⚡ (30 minutes)

**Prerequisites**: Self-hosted Supabase running at `api.danpearson.net`

1. **Configure Environment**:
   ```powershell
   cd danpearson-edge-functions\deployment
   .\setup-secrets.ps1 production
   ```

2. **Deploy to Coolify**:
   - Go to Coolify dashboard
   - Create new service → Docker
   - Repository: Your GitHub repo
   - Dockerfile path: `danpearson-edge-functions/Dockerfile`
   - Domain: `functions.danpearson.net`
   - Copy environment variables from step 1

3. **Verify**:
   ```bash
   curl https://functions.danpearson.net/_health
   ```

**Done!** ✨ Your functions are live at `functions.danpearson.net`

---

### Path 2: Test Locally FIRST 🧪 (15 minutes)

**Perfect for**: Testing before production deployment

1. **Setup Environment**:
   ```powershell
   cd danpearson-edge-functions
   cp env.example .env
   # Edit .env with your local Supabase credentials
   ```

2. **Start Local Supabase** (if not running):
   ```bash
   cd ..  # Go to project root
   supabase start
   ```

3. **Start Edge Functions**:
   ```bash
   cd danpearson-edge-functions
   docker-compose up
   ```

4. **Test**:
   ```bash
   curl http://localhost:8000/_health
   curl -X POST http://localhost:8000/health-check
   ```

**Next**: When ready, follow Path 1 to deploy to production

---

### Path 3: Complete Migration 📦 (6-9 hours)

**Perfect for**: Migrating from cloud Supabase to self-hosted

Follow the complete guide: [docs/MIGRATION.md](./docs/MIGRATION.md)

Steps:
1. Backup cloud database
2. Deploy self-hosted Supabase
3. Deploy edge functions (Path 1)
4. Migrate database
5. Update client code
6. Clean up old references
7. Test and verify

---

## 📚 Documentation Index

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[README.md](./README.md)** | Complete overview and features | For understanding the system |
| **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** | Deployment guide (Coolify, Docker, etc.) | When deploying to production |
| **[docs/MIGRATION.md](./docs/MIGRATION.md)** | Cloud to self-hosted migration | When migrating from cloud Supabase |
| **[docs/ROUTING.md](./docs/ROUTING.md)** | Domain routing and DNS setup | When configuring domains |
| **[docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)** | Common issues and solutions | When things go wrong |
| **[START_HERE.md](./START_HERE.md)** | This file - your starting point | Always start here! |

## 🌐 Your Architecture

```
┌─────────────────────────────────────────────────────────┐
│              danpearson.net (Frontend)                   │
│              Hosted on: Cloudflare Pages                 │
└────────────┬─────────────────────────┬──────────────────┘
             │                         │
    ┌────────▼──────────┐    ┌────────▼────────────┐
    │ api.danpearson    │    │ functions.          │
    │    .net           │    │  danpearson.net     │
    │                   │    │                     │
    │ - Kong Gateway    │    │ - 22 Edge Functions │
    │ - Auth Service    │    │ - Deno Runtime      │
    │ - REST API        │    │ - This Folder!      │
    │ - Storage API     │    │                     │
    │ - PostgreSQL DB   │    │                     │
    │                   │    │                     │
    │ Self-hosted       │    │ Self-hosted         │
    │ Supabase          │    │ on Coolify          │
    └───────────────────┘    └─────────────────────┘
```

## ✅ Pre-Flight Checklist

Before deploying, ensure you have:

### Infrastructure
- [ ] Self-hosted Supabase running at `api.danpearson.net`
- [ ] Supabase API keys (anon and service role)
- [ ] Coolify instance with Docker support
- [ ] Domain: `functions.danpearson.net` (DNS configured)

### Repository
- [ ] Code committed to Git
- [ ] GitHub repository accessible
- [ ] No secrets in repository

### Environment
- [ ] `.env` file created (locally)
- [ ] Environment secrets configured in Coolify
- [ ] All required variables set

## 🎬 Step-by-Step Deployment

### Step 1: Verify Self-Hosted Supabase

```bash
# Test Supabase API
curl https://api.danpearson.net/rest/v1/

# Should return: {"message":"This is Supabase API"}
```

If this fails, deploy Supabase first before continuing.

### Step 2: Configure Environment

Run the setup script:

```powershell
cd danpearson-edge-functions\deployment
.\setup-secrets.ps1 production
```

This creates `.env.production` with your configuration.

### Step 3: Create Service in Coolify

1. **Login to Coolify**
2. **Navigate to your project**
3. **Click "Add New Service"**
4. **Select "Docker"**

### Step 4: Configure Service

**General**:
- Name: `danpearson-edge-functions`
- Description: `Edge Functions for danpearson.net`

**Source**:
- Repository: `your-github-repo`
- Branch: `main`
- Build Pack: `Dockerfile`
- Dockerfile Location: `danpearson-edge-functions/Dockerfile`
- Docker Build Context: `danpearson-edge-functions`

**Network**:
- Ports Exposed: `8000` ⚠️ **CRITICAL!**
- Health Check Path: `/_health`
- Health Check Interval: `10s`

**Domain**:
- Domain: `functions.danpearson.net`
- Automatic HTTPS: ✅ Enabled

**Environment**:

Copy these from your `.env.production`:
```env
SUPABASE_URL=https://api.danpearson.net
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=8000
DOMAIN=functions.danpearson.net
API_GATEWAY_URL=https://api.danpearson.net
```

### Step 5: Deploy!

1. Click **"Save"**
2. Click **"Deploy"**
3. Watch the build logs
4. Wait for deployment (2-5 minutes)

### Step 6: Verify Deployment

```bash
# Health check
curl https://functions.danpearson.net/_health

# Should return JSON with:
# - status: "healthy"
# - functions: 22
# - functionList: [array of function names]

# Test a function
curl -X POST https://functions.danpearson.net/health-check \
  -H "Content-Type: application/json"
```

## ✨ What's Next?

After successful deployment:

### 1. Update Frontend

Update your frontend to use the new URLs:

```typescript
// Before (cloud Supabase)
const supabase = createClient(
  'https://qazhdcqvjppbbjxzvisp.supabase.co',
  'old-anon-key'
);

// After (self-hosted)
const supabase = createClient(
  'https://api.danpearson.net',
  'new-anon-key'
);
```

Update function calls:

```typescript
// Before
const { data } = await supabase.functions.invoke('my-function');

// After
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

### 2. Clean Up Old References

Run the cleanup script:

```powershell
cd danpearson-edge-functions\deployment
.\cleanup-old-supabase.ps1 -Backup
```

This finds and replaces all old Supabase URLs with new self-hosted URLs.

### 3. Migrate Database

If you're migrating from cloud Supabase, follow [docs/MIGRATION.md](./docs/MIGRATION.md).

### 4. Set Up Monitoring

- Configure health check monitoring (UptimeRobot, Better Uptime)
- Set up alerts for downtime
- Monitor function execution times

### 5. Configure Auto-Deployment

Set up GitHub Actions for automatic deployment on push:

1. Copy `deployment/deploy-github.yml` to `.github/workflows/`
2. Add secrets to GitHub repository:
   - `COOLIFY_WEBHOOK_URL`
3. Push to trigger deployment

## 🛠️ Useful Commands

```bash
# Local Development
docker-compose up              # Start locally
docker-compose down            # Stop
docker-compose logs -f         # View logs
docker-compose build --no-cache # Rebuild

# Production (via Coolify)
# All done through Coolify UI or webhook

# Testing
curl https://functions.danpearson.net/_health
curl https://functions.danpearson.net/
curl -X POST https://functions.danpearson.net/function-name

# Logs (if using Docker directly)
docker logs -f danpearson-functions
docker stats danpearson-functions
```

## 🐛 Troubleshooting

### Issue: 502 Bad Gateway

**Fix**: Ensure **Ports Exposed** is set to `8000` in Coolify

### Issue: Function Not Found

**Fix**: Check function directory structure: `functions/{name}/index.ts`

### Issue: Can't Connect to Supabase

**Fix**: Verify `SUPABASE_URL` is accessible from container

### More Issues?

See [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for comprehensive troubleshooting.

## 📊 Your Functions

You have **22 edge functions** ready to deploy:

**Public Functions** (no auth required):
- `health-check` - System health check
- `newsletter-signup` - Newsletter subscriptions
- `send-contact-email` - Contact form handler
- `track-affiliate-click` - Affiliate tracking
- `receive-email` - Email webhook receiver
- `email-webhook-receiver` - Email webhook handler

**Authenticated Functions** (require JWT):
- `generate-ai-article` - AI article generation
- `generate-ai-tasks` - AI task generation
- `generate-social-content` - Social media content
- `ai-content-generator` - General AI content
- `amazon-article-pipeline` - Amazon article workflow
- `extract-from-url` - URL content extraction
- `generate-ticket-response` - Support ticket AI responses
- `send-article-webhook` - Article webhooks
- `send-ticket-email` - Support ticket emails
- `send-notification-email` - Notification emails
- `admin-auth` - Admin authentication
- `secure-vault` - Secure vault operations
- `optimize-image` - Image optimization
- `process-accounting-document` - Document processing
- `test-ai-model` - AI model testing
- `test-api-setup` - API testing

**Maintenance**:
- `maintenance-runner` - Scheduled maintenance tasks

## 📦 What's Included

```
danpearson-edge-functions/
├── functions/              # 22 edge functions + shared utilities
├── docs/                   # Complete documentation
├── deployment/             # Deployment scripts and workflows
├── Dockerfile             # Production Docker image
├── docker-compose.yml     # Local development
├── server.ts              # Deno HTTP server
├── env.example            # Environment template
├── README.md              # Full documentation
└── START_HERE.md          # This file!
```

## 🎓 Learning Resources

- **Deno Manual**: https://deno.land/manual
- **Supabase Docs**: https://supabase.com/docs
- **Coolify Docs**: https://coolify.io/docs
- **Docker Docs**: https://docs.docker.com

## 🆘 Need Help?

1. **Check logs**: Always start with logs
2. **Review docs**: Most issues are covered in documentation
3. **Test locally**: Use `docker-compose up` to debug
4. **Check environment**: Verify all variables are set correctly

### Documentation

- [README.md](./README.md) - Complete overview
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Deployment guide
- [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) - Common issues
- [MIGRATION.md](./docs/MIGRATION.md) - Migration guide
- [ROUTING.md](./docs/ROUTING.md) - Domain configuration

## ✅ Final Checklist

Before going live:

- [ ] Self-hosted Supabase running
- [ ] Edge functions deployed
- [ ] Health check passing
- [ ] All functions accessible
- [ ] DNS configured correctly
- [ ] SSL certificates valid
- [ ] Environment variables set
- [ ] Frontend updated
- [ ] Old references cleaned up
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Team informed

## 🎉 Success!

Once deployed, your functions will be available at:

**🔗 https://functions.danpearson.net**

Each function accessible at:
- `https://functions.danpearson.net/{function-name}`

Example:
- `https://functions.danpearson.net/generate-ai-article`
- `https://functions.danpearson.net/newsletter-signup`

---

## 🚀 Ready to Deploy?

Choose your path:

1. **⚡ Quick Deploy** - Follow Path 1 above (30 minutes)
2. **🧪 Test First** - Follow Path 2 above (15 minutes)
3. **📦 Full Migration** - See [MIGRATION.md](./docs/MIGRATION.md) (6-9 hours)

---

**Questions?** Check the documentation or review the logs!

**Ready?** Let's deploy! 🎯
