# ⚡ Quick Start - 5 Minutes to Running

Get danpearson.net Edge Functions running in 5 minutes!

## Prerequisites

- Docker and Docker Compose installed
- Self-hosted Supabase running (or local Supabase)
- Supabase API keys

## Step 1: Clone and Navigate (30 seconds)

```bash
cd danpearson-edge-functions
```

The compose file builds from the repository root (`context: ..`) because the
functions themselves live in `supabase/functions/`, one level up. Running
`docker-compose` from this directory is still correct; a plain
`docker build .` from here is not.

## Step 2: Configure Environment (1 minute)

```bash
# Copy environment template
cp env.example .env

# Edit .env file
notepad .env  # Windows
nano .env     # Linux/Mac
```

Required values:

```env
SUPABASE_URL=https://api.danpearson.net  # Your Supabase URL
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Step 3: Start the Server (30 seconds)

```bash
docker-compose up
```

Wait for:

```
✅ Server running at http://localhost:8000/
✅ Found 31 function(s)
```

## Step 4: Test It! (1 minute)

**Test health endpoint**:

```bash
curl http://localhost:8000/_health
```

**List all functions**:

```bash
curl http://localhost:8000/
```

**Test a function**:

```bash
curl -X POST http://localhost:8000/health-check \
  -H "Content-Type: application/json" \
  -d '{}'
```

## ✅ Success!

Your edge functions are running locally!

## What's Next?

### Option 1: Keep Developing Locally

- `../supabase/functions` is mounted read-only at `/app/functions`, so a new
  function directory is picked up without a rebuild
- Editing a function that has already been served needs a restart:
  `docker-compose restart` (Deno caches the imported module)
- Test all your functions

### Option 2: Deploy to Production

See [START_HERE.md](./START_HERE.md) - Path 1 for deployment to Coolify

### Option 3: Full Migration

See [docs/MIGRATION.md](./docs/MIGRATION.md) for complete migration guide

## Common Commands

```bash
# View logs
docker-compose logs -f

# Stop server
docker-compose down

# Rebuild (after changes)
docker-compose up --build

# Run in background
docker-compose up -d
```

## Troubleshooting

**Container won't start?**

- Check `.env` file has all required values
- Verify Docker is running
- Check port 8000 is not in use

**Function not found?**

- Check the function exists at `supabase/functions/{name}/index.ts` (repo root)
- Restart: `docker-compose restart`

**Can't connect to Supabase?**

- Verify `SUPABASE_URL` is correct
- Check Supabase is running
- Test: `curl https://api.danpearson.net/rest/v1/`

## 🎯 That's It!

You now have a fully functional edge functions server running locally!

**More info**: See [README.md](./README.md) for complete documentation.
