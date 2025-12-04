# Disaster Recovery Runbook

> **Purpose**: This document provides step-by-step procedures for recovering the Dan Pearson Portfolio system in case of disasters, outages, or data loss scenarios.

**Last Updated**: 2024-12-04
**Owner**: System Administrator
**Review Frequency**: Quarterly

---

## Table of Contents

1. [Emergency Contacts](#emergency-contacts)
2. [System Overview](#system-overview)
3. [Incident Classification](#incident-classification)
4. [Recovery Procedures](#recovery-procedures)
5. [Database Recovery](#database-recovery)
6. [Application Recovery](#application-recovery)
7. [DNS and CDN Recovery](#dns-and-cdn-recovery)
8. [Security Incident Response](#security-incident-response)
9. [Post-Incident Procedures](#post-incident-procedures)
10. [Testing and Drills](#testing-and-drills)

---

## Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Primary Admin | [Owner] | 24/7 |
| Supabase Support | support@supabase.io | Business Hours |
| Cloudflare Support | [Support Portal] | 24/7 for Enterprise |

---

## System Overview

### Architecture Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Cloudflare     │────▶│  Static Assets   │────▶│  Supabase       │
│  Pages (CDN)    │     │  (React App)     │     │  (PostgreSQL)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  DNS (CF)       │     │  Edge Functions  │     │  Storage        │
│                 │     │  (Deno)          │     │  (S3-compat)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Critical Dependencies

| Component | Provider | Recovery Priority |
|-----------|----------|------------------|
| Database | Supabase PostgreSQL | P0 - Critical |
| Authentication | Supabase Auth | P0 - Critical |
| Edge Functions | Supabase Edge | P1 - High |
| CDN/Hosting | Cloudflare Pages | P1 - High |
| DNS | Cloudflare | P0 - Critical |
| File Storage | Supabase Storage | P2 - Medium |

---

## Incident Classification

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **SEV-1** | Complete system outage | Immediate | Database down, DNS failure |
| **SEV-2** | Major feature unavailable | 1 hour | Auth broken, admin panel down |
| **SEV-3** | Minor feature degraded | 4 hours | Slow queries, partial outage |
| **SEV-4** | Cosmetic/low impact | 24 hours | UI bugs, minor errors |

---

## Recovery Procedures

### 1. Database Recovery (Supabase PostgreSQL)

#### 1.1 Point-in-Time Recovery (PITR)

Supabase Pro plan includes automatic PITR with 7-day retention.

**Steps:**

1. **Access Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/[PROJECT_ID]
   ```

2. **Navigate to Database Backups**
   - Go to: Settings → Database → Backups
   - Select the recovery point

3. **Initiate Recovery**
   ```bash
   # Via Supabase CLI (if available)
   supabase db restore --project-ref [PROJECT_ID] --time "2024-01-01T12:00:00Z"
   ```

4. **Verify Recovery**
   ```sql
   -- Check table counts
   SELECT
     schemaname,
     relname,
     n_live_tup
   FROM pg_stat_user_tables
   ORDER BY n_live_tup DESC;

   -- Check recent data
   SELECT * FROM articles ORDER BY created_at DESC LIMIT 5;
   ```

#### 1.2 Manual Backup Restoration

**Export Current State (Prevention):**
```bash
# Using pg_dump (requires direct connection)
pg_dump -h [SUPABASE_HOST] -U postgres -d postgres -F c -f backup_$(date +%Y%m%d).dump

# Using Supabase CLI
supabase db dump -f backup.sql --project-ref [PROJECT_ID]
```

**Restore from Backup:**
```bash
# Using pg_restore
pg_restore -h [SUPABASE_HOST] -U postgres -d postgres -F c backup.dump

# Using Supabase CLI
supabase db reset --project-ref [PROJECT_ID]
supabase db push --project-ref [PROJECT_ID]
```

#### 1.3 Schema-Only Recovery

If data is intact but schema is corrupted:

```bash
# Apply all migrations
cd supabase
supabase db push --project-ref [PROJECT_ID]

# Or apply specific migration
supabase migration up --project-ref [PROJECT_ID]
```

### 2. Application Recovery (Cloudflare Pages)

#### 2.1 Rollback to Previous Deployment

1. **Access Cloudflare Dashboard**
   ```
   https://dash.cloudflare.com/[ACCOUNT_ID]/pages
   ```

2. **View Deployments**
   - Navigate to: Pages → pearson-style-showcase → Deployments
   - Find the last working deployment

3. **Rollback**
   - Click on the deployment
   - Select "Rollback to this deployment"

#### 2.2 Redeploy from Git

```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Trigger rebuild
git commit --allow-empty -m "chore: trigger redeploy"
git push origin main
```

#### 2.3 Local Build and Manual Deploy

```bash
# Build locally
npm ci
npm run build

# Deploy via Wrangler CLI
npx wrangler pages deploy dist --project-name pearson-style-showcase
```

### 3. Edge Functions Recovery

#### 3.1 Redeploy All Functions

```bash
# Using Supabase CLI
supabase functions deploy --project-ref [PROJECT_ID]

# Deploy specific function
supabase functions deploy admin-auth --project-ref [PROJECT_ID]
```

#### 3.2 Check Function Logs

```bash
# View recent logs
supabase functions logs admin-auth --project-ref [PROJECT_ID]

# Tail logs in real-time
supabase functions logs admin-auth --project-ref [PROJECT_ID] --follow
```

### 4. DNS Recovery (Cloudflare)

#### 4.1 Verify DNS Configuration

Required DNS records:
```
Type    Name            Content                 Proxy
CNAME   @               pearson-style-showcase.pages.dev    Proxied
CNAME   www             pearson-style-showcase.pages.dev    Proxied
```

#### 4.2 Clear DNS Cache

```bash
# Clear Cloudflare cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/[ZONE_ID]/purge_cache" \
  -H "Authorization: Bearer [API_TOKEN]" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

---

## Database Recovery

### Critical Tables Recovery Priority

| Priority | Table | Description | RTO |
|----------|-------|-------------|-----|
| P0 | `admin_whitelist` | Admin access control | 15 min |
| P0 | `admin_sessions` | Active sessions | 15 min |
| P0 | `user_roles` | RBAC configuration | 15 min |
| P1 | `articles` | Main content | 1 hour |
| P1 | `projects` | Portfolio projects | 1 hour |
| P2 | `admin_activity_log` | Audit logs | 4 hours |
| P2 | `security_events` | Security logs | 4 hours |

### Data Integrity Checks

```sql
-- Check for orphaned records
SELECT ar.id, ar.title
FROM articles ar
LEFT JOIN admin_whitelist aw ON ar.author_id = aw.id
WHERE ar.author_id IS NOT NULL AND aw.id IS NULL;

-- Check for broken references
SELECT * FROM user_roles ur
LEFT JOIN auth.users au ON ur.user_id = au.id
WHERE au.id IS NULL;

-- Verify admin whitelist integrity
SELECT email, COUNT(*)
FROM admin_whitelist
GROUP BY email
HAVING COUNT(*) > 1;
```

### Emergency Admin Access Recovery

If locked out of admin:

```sql
-- Add emergency admin (run in Supabase SQL Editor)
INSERT INTO admin_whitelist (email, is_active, roles)
VALUES ('emergency-admin@example.com', true, ARRAY['admin']::text[])
ON CONFLICT (email) DO UPDATE SET is_active = true;

-- Grant admin role
INSERT INTO user_roles (user_id, role, is_active)
SELECT id, 'admin', true
FROM auth.users
WHERE email = 'emergency-admin@example.com'
ON CONFLICT (user_id, role) DO UPDATE SET is_active = true;
```

---

## Security Incident Response

### 1. Suspected Breach Procedures

1. **Immediate Actions (First 15 minutes)**
   ```sql
   -- Revoke all active sessions
   DELETE FROM admin_sessions;

   -- Disable all admin accounts temporarily
   UPDATE admin_whitelist SET is_active = false;
   ```

2. **Rotate Credentials**
   - Rotate Supabase API keys in dashboard
   - Rotate Cloudflare API tokens
   - Update environment variables

3. **Review Logs**
   ```sql
   -- Check recent login attempts
   SELECT * FROM security_events
   WHERE event_type IN ('login_success', 'login_failure', 'account_lockout')
   ORDER BY created_at DESC
   LIMIT 100;

   -- Check admin activity
   SELECT * FROM admin_activity_log
   ORDER BY timestamp DESC
   LIMIT 100;
   ```

### 2. Compromised Account Recovery

```sql
-- Identify compromised account activity
SELECT * FROM admin_activity_log
WHERE admin_email = 'compromised@example.com'
ORDER BY timestamp DESC;

-- Revoke account access
UPDATE admin_whitelist
SET is_active = false
WHERE email = 'compromised@example.com';

-- Remove all sessions
DELETE FROM admin_sessions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'compromised@example.com');
```

### 3. Data Exfiltration Response

1. Enable enhanced logging
2. Review all recent API calls
3. Check for unauthorized data exports
4. Notify affected users if personal data involved

---

## Post-Incident Procedures

### 1. Incident Documentation

Create incident report with:
- Timeline of events
- Root cause analysis
- Actions taken
- Lessons learned
- Preventive measures

### 2. System Verification Checklist

- [ ] All services responding
- [ ] Authentication working
- [ ] Database queries returning expected results
- [ ] Edge functions responding
- [ ] SSL certificates valid
- [ ] DNS resolving correctly
- [ ] Admin dashboard accessible
- [ ] Public site loading correctly
- [ ] Forms submitting successfully
- [ ] Email notifications sending

### 3. Communication Template

```
Subject: [RESOLVED] Service Incident - [DATE]

Dear Team,

An incident occurred on [DATE] affecting [SERVICES].

Impact: [Description of user impact]
Duration: [Start time] - [End time]
Root Cause: [Brief explanation]
Resolution: [What was done to fix it]

Preventive Measures:
1. [Measure 1]
2. [Measure 2]

We apologize for any inconvenience caused.
```

---

## Testing and Drills

### Quarterly DR Drill Schedule

| Quarter | Focus Area | Test Type |
|---------|------------|-----------|
| Q1 | Database Recovery | Full PITR restore to staging |
| Q2 | Application Rollback | Cloudflare deployment rollback |
| Q3 | Security Incident | Simulated breach response |
| Q4 | Full DR Exercise | Complete system recovery |

### DR Drill Procedure

1. **Pre-Drill**
   - Schedule downtime window (staging only)
   - Notify stakeholders
   - Document current state

2. **Execution**
   - Follow runbook procedures
   - Time each step
   - Note any issues

3. **Post-Drill**
   - Document results
   - Update runbook with improvements
   - Schedule follow-up for issues

### Recovery Time Objectives (RTO)

| Scenario | Target RTO | Actual (Last Test) |
|----------|------------|-------------------|
| Database failure | 30 minutes | TBD |
| Application outage | 15 minutes | TBD |
| DNS failure | 5 minutes | TBD |
| Complete system failure | 2 hours | TBD |

### Recovery Point Objectives (RPO)

| Data Type | Target RPO | Backup Frequency |
|-----------|------------|------------------|
| Database | 24 hours | PITR (continuous) |
| User uploads | 24 hours | Supabase Storage |
| Configuration | 1 hour | Git repository |

---

## Appendix: Quick Reference

### Essential Commands

```bash
# Check service status
supabase status --project-ref [PROJECT_ID]

# View Edge Function logs
supabase functions logs --project-ref [PROJECT_ID]

# Deploy application
npx wrangler pages deploy dist

# Clear CDN cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/[ZONE_ID]/purge_cache" \
  -H "Authorization: Bearer [API_TOKEN]" \
  -d '{"purge_everything":true}'
```

### Critical Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Cloudflare Pages | API endpoint |
| `SUPABASE_ANON_KEY` | Cloudflare Pages | Public API key |
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | Deployment |
| `SUPABASE_SERVICE_KEY` | Supabase Vault | Server-side access |

### Useful Links

- Supabase Dashboard: `https://supabase.com/dashboard`
- Cloudflare Dashboard: `https://dash.cloudflare.com`
- GitHub Repository: `https://github.com/dj-pearson/pearson-style-showcase`
- Status Page: `https://status.supabase.com`

---

**Document Version**: 1.0
**Next Review Date**: 2025-03-04
