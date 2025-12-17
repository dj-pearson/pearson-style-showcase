# Troubleshooting Guide - danpearson.net Edge Functions

Common issues and solutions for danpearson.net Edge Functions deployment and operation.

## 🔍 Quick Diagnostics

Run these commands to check the status of your deployment:

```bash
# Check health endpoint
curl https://functions.danpearson.net/_health

# Check Docker container status (if using Docker)
docker ps | grep danpearson

# Check logs
docker logs danpearson-functions

# Check DNS resolution
nslookup functions.danpearson.net

# Check SSL certificate
curl -vI https://functions.danpearson.net 2>&1 | grep "SSL certificate"
```

## 🐛 Common Issues

### 1. Container Won't Start

**Symptoms**:
- Container exits immediately after starting
- Health check fails
- No logs

**Possible Causes**:
- Missing environment variables
- Invalid Dockerfile
- Port already in use
- Permission issues

**Solutions**:

```bash
# Check logs
docker logs danpearson-functions

# Verify environment variables
docker inspect danpearson-functions | grep -A 20 "Env"

# Check if port is in use
netstat -ano | findstr :8000  # Windows
lsof -i :8000                  # Linux/Mac

# Test with docker-compose locally
cd danpearson-edge-functions
docker-compose up

# Rebuild without cache
docker-compose build --no-cache
```

**Fix**: Ensure all required environment variables are set:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 2. 502 Bad Gateway

**Symptoms**:
- Accessing `functions.danpearson.net` returns 502
- Container is running
- Logs show server started

**Possible Causes**:
- Port not exposed in Coolify
- Reverse proxy misconfigured
- Server not listening on correct port
- Health check failing

**Solutions**:

```bash
# Test health endpoint internally
docker exec danpearson-functions curl http://localhost:8000/_health

# Check if server is listening
docker exec danpearson-functions netstat -tlnp | grep 8000

# Check Traefik/reverse proxy logs in Coolify
# Coolify → Your Service → Logs → Traefik
```

**Fix in Coolify**:
1. Go to your service settings
2. Set **"Ports Exposes"** to `8000`
3. Redeploy

### 3. Function Not Found (404)

**Symptoms**:
- Health endpoint works
- Calling function returns 404
- Function list doesn't show your function

**Possible Causes**:
- Function directory doesn't exist
- Function missing `index.ts`
- Function name mismatch
- Volume mount issue

**Solutions**:

```bash
# Check if functions directory exists
docker exec danpearson-functions ls -la /app/functions

# Check specific function
docker exec danpearson-functions ls -la /app/functions/your-function

# Check function has index.ts
docker exec danpearson-functions cat /app/functions/your-function/index.ts

# Get list of available functions
curl https://functions.danpearson.net/
```

**Fix**:
- Ensure function structure is correct: `functions/{name}/index.ts`
- Rebuild and redeploy
- Check function name matches directory name exactly (case-sensitive)

### 4. Function Crashes on Execution

**Symptoms**:
- Health endpoint works
- Function returns 500 error
- Logs show error

**Possible Causes**:
- Syntax error in function code
- Missing dependencies
- Timeout
- Invalid environment variables

**Solutions**:

```bash
# Check logs for error details
docker logs -f danpearson-functions

# Test function locally
cd danpearson-edge-functions
docker-compose up
curl -X POST http://localhost:8000/your-function -d '{"test":"data"}'

# Test function directly with Deno
docker exec danpearson-functions deno run \
  --allow-all \
  /app/functions/your-function/index.ts
```

**Fix**:
- Review error in logs
- Fix syntax errors
- Ensure all imports are valid URLs
- Add proper error handling

### 5. CORS Errors

**Symptoms**:
- Browser console shows CORS error
- Function works in curl/Postman
- Preflight request fails

**Possible Causes**:
- CORS headers not configured
- Origin not allowed
- Missing OPTIONS handler

**Solutions**:

```bash
# Test preflight request
curl -X OPTIONS https://functions.danpearson.net/your-function \
  -H "Origin: https://danpearson.net" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Should return CORS headers
```

**Fix**:

Update `server.ts`:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://danpearson.net', // Your domain
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};
```

Rebuild and redeploy.

### 6. Environment Variables Not Working

**Symptoms**:
- Function can't access Supabase
- `Deno.env.get()` returns undefined
- Connection refused errors

**Possible Causes**:
- Environment variables not set in Coolify
- Variable name mismatch
- Special characters in values not escaped

**Solutions**:

```bash
# Check environment variables in container
docker exec danpearson-functions env | grep SUPABASE

# Test Supabase connection
docker exec danpearson-functions deno eval "
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_ANON_KEY')
);
console.log('Connected:', !!supabase);
"
```

**Fix in Coolify**:
1. Go to service → Environment tab
2. Add/update variables
3. Save
4. Redeploy (important!)

### 7. SSL Certificate Errors

**Symptoms**:
- Browser shows "Not Secure"
- SSL certificate warning
- Certificate expired

**Possible Causes**:
- Certificate not provisioned
- DNS not pointing to server
- Coolify SSL disabled

**Solutions**:

```bash
# Check certificate
echo | openssl s_client -servername functions.danpearson.net \
  -connect functions.danpearson.net:443 2>/dev/null | \
  openssl x509 -noout -dates

# Check DNS
nslookup functions.danpearson.net
```

**Fix in Coolify**:
1. Verify domain is configured
2. Enable "Automatic HTTPS"
3. Wait for certificate provisioning (2-5 minutes)
4. Check DNS points to correct IP

### 8. Slow Function Execution

**Symptoms**:
- Functions take too long to respond
- Timeouts
- Poor performance

**Possible Causes**:
- Cold start (first request)
- Heavy computation
- Slow external API calls
- No caching

**Solutions**:

```bash
# Test function performance
time curl -X POST https://functions.danpearson.net/your-function \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}'

# Check function logs for timing
docker logs danpearson-functions | grep "executed in"
```

**Fixes**:
- Add caching for expensive operations
- Use async operations
- Optimize database queries
- Consider moving heavy work to background jobs
- Increase container resources in Coolify

### 9. Database Connection Fails

**Symptoms**:
- Function can't connect to Supabase
- Connection refused
- Timeout errors

**Possible Causes**:
- Wrong Supabase URL
- Network issues
- Invalid API keys
- Supabase service down

**Solutions**:

```bash
# Test Supabase API from container
docker exec danpearson-functions curl https://api.danpearson.net/rest/v1/

# Test with API key
docker exec danpearson-functions curl https://api.danpearson.net/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"

# Check Supabase health
curl https://api.danpearson.net/rest/v1/
```

**Fix**:
- Verify `SUPABASE_URL` is correct
- Check Supabase service is running
- Verify API keys are valid
- Check network connectivity

### 10. Deployment Fails in Coolify

**Symptoms**:
- Build fails
- Deployment stuck
- Image pull errors

**Possible Causes**:
- Build errors in Dockerfile
- Out of disk space
- Network issues
- Docker issues

**Solutions**:

```bash
# Check Coolify logs
# Coolify → Your Service → Logs → Build Logs

# Test build locally
cd danpearson-edge-functions
docker build -t test .

# Check disk space on Coolify server
df -h

# Clean up old images
docker system prune -a
```

**Fix**:
- Fix Dockerfile errors
- Free up disk space
- Check Docker daemon is running
- Retry deployment

## 🔧 Advanced Troubleshooting

### Enable Debug Logging

Update `server.ts` to add more logging:

```typescript
console.log(`[DEBUG] Environment:`, {
  url: Deno.env.get('SUPABASE_URL'),
  hasAnonKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
  hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
});
```

### Test Function Directly

```bash
# Enter container
docker exec -it danpearson-functions bash

# Run function with Deno
deno run --allow-all /app/functions/your-function/index.ts

# Test imports
deno eval "import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'; console.log('OK');"
```

### Check Resource Usage

```bash
# CPU and memory usage
docker stats danpearson-functions

# Check for memory leaks
docker exec danpearson-functions ps aux
```

### Network Debugging

```bash
# Test network connectivity from container
docker exec danpearson-functions ping api.danpearson.net

# Test DNS resolution
docker exec danpearson-functions nslookup api.danpearson.net

# Test HTTPS connection
docker exec danpearson-functions curl -v https://api.danpearson.net
```

## 🆘 Getting Help

If you're still stuck:

1. **Check Logs**:
   - Coolify service logs
   - Docker container logs
   - Browser console (for frontend errors)

2. **Gather Information**:
   - Error messages
   - Steps to reproduce
   - Environment details
   - Recent changes

3. **Test Locally**:
   - Use `docker-compose up` to test locally
   - Isolate the issue

4. **Review Documentation**:
   - [README.md](../README.md)
   - [DEPLOYMENT.md](./DEPLOYMENT.md)
   - [MIGRATION.md](./MIGRATION.md)
   - [ROUTING.md](./ROUTING.md)

5. **Check External Resources**:
   - [Deno Documentation](https://deno.land/manual)
   - [Supabase Discord](https://discord.supabase.com)
   - [Coolify Discord](https://discord.gg/coolify)

## 📋 Diagnostic Checklist

Use this checklist to diagnose issues:

- [ ] Container is running
- [ ] Health endpoint returns 200
- [ ] Environment variables are set
- [ ] Supabase URL is accessible
- [ ] API keys are valid
- [ ] Functions directory is mounted
- [ ] Port 8000 is exposed
- [ ] Domain DNS is configured
- [ ] SSL certificate is valid
- [ ] CORS headers are configured
- [ ] No errors in logs
- [ ] Can connect to Supabase from container
- [ ] Functions are listed in health check
- [ ] Test function works locally

## 🔄 Rollback Procedure

If all else fails, rollback:

```bash
# Via Git
git log  # Find last working commit
git checkout <commit-hash>
git push -f

# Via Coolify
# Go to service → Deployments → Previous deployment → Redeploy

# Via Docker
docker pull danpearson/edge-functions:previous-tag
docker stop danpearson-functions
docker rm danpearson-functions
docker run ...
```

---

**Still need help?** Check the logs, review recent changes, and test locally first!
