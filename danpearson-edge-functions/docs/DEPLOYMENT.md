# Deployment Guide - danpearson.net Edge Functions

Complete deployment guide for danpearson.net Edge Functions to various platforms.

## 🎯 Deployment Overview

This service (`functions.danpearson.net`) is designed to run alongside your self-hosted Supabase instance (`api.danpearson.net`). They work together but are deployed separately.

```
┌─────────────────┐         ┌──────────────────┐
│  Supabase       │         │  Edge Functions  │
│  (Coolify)      │◄────────┤  (Coolify)       │
│  api.danpearson │         │  functions.      │
│     .net        │         │  danpearson.net  │
└─────────────────┘         └──────────────────┘
```

## 🚀 Deployment to Coolify (Recommended)

### Prerequisites

- Coolify instance running
- Self-hosted Supabase already deployed at `api.danpearson.net`
- GitHub repository with this code
- Supabase API keys (from your self-hosted instance)

### Step 1: Create New Service

1. Log into Coolify dashboard
2. Navigate to your project
3. Click **"Add New Service"**
4. Select **"Docker Compose"** or **"Dockerfile"**

### Step 2: Configure Git Repository

1. **Repository**: Select your GitHub repo
2. **Branch**: `main` (or your production branch)
3. **Build Pack**: Docker
4. **Dockerfile Location**: `danpearson-edge-functions/Dockerfile`
5. **Context**: `danpearson-edge-functions`

### Step 3: Set Environment Variables

**CRITICAL: Use Coolify's Environment Secrets feature!**

Go to your service → **Environment** tab:

```env
# Supabase Configuration
SUPABASE_URL=https://api.danpearson.net
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Server Configuration
PORT=8000
DOMAIN=functions.danpearson.net
API_GATEWAY_URL=https://api.danpearson.net

# Deno Configuration
DENO_DIR=/app/.deno_cache
```

**Getting Supabase Keys**:
1. Access your self-hosted Supabase Studio at `api.danpearson.net`
2. Go to Settings → API
3. Copy **anon (public)** key
4. Copy **service_role** key

### Step 4: Configure Networking

1. **Ports Exposed**: `8000`
   - This is CRITICAL! Coolify needs to know which port to proxy
2. **Health Check Path**: `/_health`
3. **Health Check Interval**: `10s`

### Step 5: Configure Domain

1. Go to **Domains** tab
2. Add domain: `functions.danpearson.net`
3. Enable **Automatic HTTPS** (Let's Encrypt)
4. Save

### Step 6: Deploy

1. Click **"Deploy"**
2. Watch the build logs
3. Wait for deployment to complete
4. Verify health check: `https://functions.danpearson.net/_health`

### Step 7: Verify Deployment

```bash
# Health check
curl https://functions.danpearson.net/_health

# List functions
curl https://functions.danpearson.net/

# Test a function
curl -X POST https://functions.danpearson.net/health-check \
  -H "Content-Type: application/json"
```

Expected health check response:
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
  "functions": 22
}
```

## 🔄 Continuous Deployment

### Auto-Deploy on Git Push

Coolify can automatically redeploy when you push to your repository.

1. Go to your service in Coolify
2. Enable **"Auto Deploy"**
3. Configure webhook (Coolify provides this)
4. Add webhook to GitHub:
   - Repository → Settings → Webhooks
   - Add the Coolify webhook URL
   - Select events: Push

Now every push to `main` will trigger a deployment!

### Manual Deployment

```bash
# Option 1: Via Coolify UI
# Click "Deploy" button in service dashboard

# Option 2: Via Coolify CLI
coolify deploy <service-id>

# Option 3: Via webhook
curl -X POST https://your-coolify-instance/webhooks/<webhook-id>
```

## 🐳 Deployment via Docker (Generic)

For any Docker host (AWS, DigitalOcean, etc.):

### Build and Push to Registry

```bash
# Build image
cd danpearson-edge-functions
docker build -t danpearson/edge-functions:latest .

# Tag for your registry
docker tag danpearson/edge-functions:latest \
  your-registry.com/danpearson/edge-functions:latest

# Push to registry
docker push your-registry.com/danpearson/edge-functions:latest
```

### Deploy on Server

```bash
# Pull image
docker pull your-registry.com/danpearson/edge-functions:latest

# Run container
docker run -d \
  --name danpearson-functions \
  --restart unless-stopped \
  -p 8000:8000 \
  -e SUPABASE_URL=https://api.danpearson.net \
  -e SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  -e PORT=8000 \
  -e DOMAIN=functions.danpearson.net \
  your-registry.com/danpearson/edge-functions:latest

# Check logs
docker logs -f danpearson-functions

# Verify health
curl http://localhost:8000/_health
```

### Setup Reverse Proxy (Nginx)

```nginx
# /etc/nginx/sites-available/functions.danpearson.net
server {
    listen 80;
    listen [::]:80;
    server_name functions.danpearson.net;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /_health {
        proxy_pass http://localhost:8000/_health;
        access_log off;
    }
}
```

Enable site and get SSL:
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/functions.danpearson.net \
  /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d functions.danpearson.net
```

## 🚢 Deployment via GitHub Actions

Automate deployment with GitHub Actions.

### Setup GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions:

```
COOLIFY_WEBHOOK_URL=https://your-coolify.com/webhooks/xxx
SUPABASE_URL=https://api.danpearson.net
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Create Workflow

See `deployment/deploy-github.yml` for complete workflow.

The workflow will:
1. Trigger on push to `main` (only if edge functions changed)
2. Build Docker image
3. Push to registry
4. Trigger Coolify deployment via webhook
5. Verify deployment health check

## 🔧 Environment Configuration

### Development Environment

For local development:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
PORT=8000
```

Start local Supabase first:
```bash
# In your main project
cd ../
supabase start

# Then start edge functions
cd danpearson-edge-functions
docker-compose up
```

### Staging Environment

For staging:

```env
SUPABASE_URL=https://staging-api.danpearson.net
SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
PORT=8000
DOMAIN=staging-functions.danpearson.net
```

### Production Environment

For production (what you're deploying now):

```env
SUPABASE_URL=https://api.danpearson.net
SUPABASE_ANON_KEY=<production-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>
PORT=8000
DOMAIN=functions.danpearson.net
API_GATEWAY_URL=https://api.danpearson.net
```

## 🔐 Security Checklist

Before going to production:

- [ ] Environment variables stored in secrets (not plaintext)
- [ ] Service role key is secure and rotated regularly
- [ ] HTTPS enabled (via Coolify/Let's Encrypt)
- [ ] CORS configured for your domains only (update `server.ts`)
- [ ] Health checks enabled
- [ ] Logging configured
- [ ] Monitoring/alerts set up
- [ ] Backup strategy for functions code (Git)
- [ ] DNS properly configured
- [ ] Firewall rules configured (if applicable)

## 📊 Monitoring & Logs

### Viewing Logs

**In Coolify**:
1. Go to your service
2. Click "Logs" tab
3. View real-time or historical logs

**Via Docker**:
```bash
docker logs -f danpearson-functions
```

**Via docker-compose**:
```bash
docker-compose logs -f edge-functions
```

### Health Monitoring

Set up external monitoring (e.g., UptimeRobot, Better Uptime):

- **URL**: `https://functions.danpearson.net/_health`
- **Interval**: 5 minutes
- **Expected**: 200 status code
- **Alert**: Email/Slack on failure

### Performance Monitoring

Monitor function execution times:
```typescript
// In your functions
const startTime = Date.now();
// ... your function logic
const duration = Date.now() - startTime;
console.log(`Function executed in ${duration}ms`);
```

## 🐛 Troubleshooting Deployment

### Build Fails

**Symptom**: Docker build fails

**Solutions**:
1. Check Dockerfile syntax
2. Verify base image exists: `denoland/deno:1.40.0`
3. Check build logs in Coolify
4. Test build locally:
   ```bash
   cd danpearson-edge-functions
   docker build -t test .
   ```

### Container Starts but Health Check Fails

**Symptom**: Container running but health endpoint returns error

**Solutions**:
1. Check environment variables are set correctly
2. Verify Supabase URL is accessible from container
3. Check logs: `docker logs danpearson-functions`
4. Test health endpoint: `curl http://localhost:8000/_health`

### 502 Bad Gateway

**Symptom**: Accessing domain returns 502

**Solutions**:
1. **Verify port exposure**: Must be `8000` in Coolify
2. Check container is running: `docker ps`
3. Check health endpoint internally: `docker exec danpearson-functions curl http://localhost:8000/_health`
4. Verify reverse proxy configuration

### Functions Not Loading

**Symptom**: Health check works but functions return 404

**Solutions**:
1. Verify functions directory copied: `docker exec danpearson-functions ls /app/functions`
2. Check function structure: `functions/{name}/index.ts`
3. Review function logs
4. Restart container: `docker restart danpearson-functions`

### Environment Variables Not Working

**Symptom**: Container starts but functions can't access Supabase

**Solutions**:
1. Verify variables are set in Coolify
2. Check variable names match exactly
3. Test inside container:
   ```bash
   docker exec danpearson-functions env | grep SUPABASE
   ```
4. Re-deploy after fixing variables

## 🔄 Rolling Back

### Via Coolify

1. Go to service → Deployments
2. Find previous successful deployment
3. Click "Redeploy"

### Via Docker

```bash
# Pull previous image version
docker pull your-registry.com/danpearson/edge-functions:previous-tag

# Stop current container
docker stop danpearson-functions
docker rm danpearson-functions

# Start with previous version
docker run -d --name danpearson-functions ... \
  your-registry.com/danpearson/edge-functions:previous-tag
```

### Via Git

```bash
# Revert to previous commit
git revert HEAD
git push

# Coolify will auto-deploy the revert
```

## 📝 Deployment Checklist

Use this checklist for each deployment:

- [ ] Code tested locally
- [ ] All functions working
- [ ] Environment variables configured
- [ ] Health check passing locally
- [ ] Committed to Git
- [ ] Pushed to repository
- [ ] Build successful
- [ ] Container started
- [ ] Health check passing in production
- [ ] Functions accessible
- [ ] Logs looking good
- [ ] No errors in monitoring
- [ ] DNS resolving correctly
- [ ] HTTPS working
- [ ] Performance acceptable

## 🎯 Next Steps

After successful deployment:

1. **Update Client Code** - Point your frontend to `functions.danpearson.net`
2. **Migrate Database** - See [MIGRATION.md](./MIGRATION.md)
3. **Configure Routing** - See [ROUTING.md](./ROUTING.md)
4. **Set Up Monitoring** - Configure alerts and monitoring
5. **Test All Functions** - Verify each function works correctly
6. **Clean Up Old References** - Remove old cloud Supabase URLs

## 📚 Additional Resources

- [Coolify Documentation](https://coolify.io/docs)
- [Deno Deploy Documentation](https://deno.com/deploy/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Supabase Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting)

---

**Need help?** Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or review the logs!
