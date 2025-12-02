# Secrets Management Runbook

> **Last Updated**: 2025-12-02
> **Owner**: Security Team
> **Classification**: Internal Use Only

This runbook documents the secrets management strategy for the Dan Pearson Portfolio project, including procedures for API key rotation, secure storage, and incident response.

---

## Table of Contents

1. [Overview](#overview)
2. [Secret Inventory](#secret-inventory)
3. [Storage Locations](#storage-locations)
4. [Access Control](#access-control)
5. [Rotation Procedures](#rotation-procedures)
6. [Emergency Procedures](#emergency-procedures)
7. [Monitoring & Auditing](#monitoring--auditing)
8. [Best Practices](#best-practices)

---

## Overview

### Principles

1. **Least Privilege**: Only grant access to secrets that are absolutely necessary
2. **Defense in Depth**: Multiple layers of protection for sensitive data
3. **Rotation**: Regular rotation of all secrets on a defined schedule
4. **Audit Trail**: All secret access should be logged and auditable
5. **Secure by Default**: Secrets are never stored in code or version control

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Secret Sources                               │
├─────────────────────────────────────────────────────────────────┤
│  Local Dev    │  Cloudflare Pages  │  Supabase Edge Functions   │
│  .env file    │  Environment Vars   │  Environment Vars          │
│  (gitignored) │  (Dashboard)        │  (Dashboard)               │
└───────────────┴────────────────────┴────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Applications                                 │
├─────────────────────────────────────────────────────────────────┤
│  React Frontend     │  Edge Functions      │  External Services  │
│  (Client-safe only) │  (All secrets)       │  (API integrations) │
└─────────────────────┴─────────────────────┴────────────────────┘
```

---

## Secret Inventory

### Client-Side Secrets (VITE_ prefixed)

| Secret Name | Purpose | Rotation Frequency | Exposure Level |
|-------------|---------|-------------------|----------------|
| `VITE_SUPABASE_URL` | Supabase project URL | Rarely (project change) | Public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | Yearly | Public |
| `VITE_LOG_LEVEL` | Logging configuration | N/A | Public |

**Note**: These are safe to expose in client-side code as they are designed to be public.

### Server-Side Secrets (Edge Functions)

| Secret Name | Purpose | Rotation Frequency | Criticality |
|-------------|---------|-------------------|-------------|
| `SUPABASE_URL` | Supabase project URL | Rarely | Medium |
| `SUPABASE_SERVICE_ROLE_KEY` | Full DB access | Quarterly | **Critical** |
| `RESEND_API` | Email sending API | Quarterly | High |
| `OPENAI_API_KEY` | AI article generation | Monthly | High |
| `WEBHOOK_SECRET` | Webhook signature verification | Monthly | High |
| `AMAZON_API_KEY` | Amazon affiliate API | Quarterly | Medium |
| `AMAZON_API_SECRET` | Amazon affiliate secret | Quarterly | Medium |

### Third-Party Service Credentials

| Service | Location | Rotation Frequency |
|---------|----------|-------------------|
| Supabase | Supabase Dashboard | Quarterly |
| Resend | Resend Dashboard | Quarterly |
| OpenAI | OpenAI Dashboard | Monthly |
| Amazon Associates | Amazon Dashboard | Quarterly |
| Cloudflare | Cloudflare Dashboard | Quarterly |

---

## Storage Locations

### Local Development

**File**: `.env` (root directory)

```bash
# NEVER commit this file to version control
# Copy from .env.example and fill in values

VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

**Security Controls**:
- File is listed in `.gitignore`
- Pre-commit hooks check for accidental commits
- Template provided in `.env.example`

### Cloudflare Pages (Production Frontend)

**Location**: Cloudflare Dashboard → Pages → Settings → Environment Variables

**Access**: Only team members with Cloudflare admin access

**Configuration**:
1. Go to Cloudflare Dashboard
2. Select Pages project: `pearson-style-showcase`
3. Settings → Environment Variables
4. Add/modify variables for Production and Preview environments

### Supabase Edge Functions

**Location**: Supabase Dashboard → Settings → Edge Functions → Environment Variables

**Access**: Only team members with Supabase admin access

**Configuration**:
1. Go to Supabase Dashboard
2. Project Settings → Edge Functions
3. Manage secrets in the Secrets section

---

## Access Control

### Role Definitions

| Role | Access Level | Secrets Access |
|------|-------------|----------------|
| Developer | Read | Dev environment only |
| Senior Developer | Read/Write | Dev + Preview environments |
| Admin | Full | All environments including production |
| CI/CD | Read | Production secrets (automated) |

### Access Request Process

1. **Request**: Submit request via GitHub issue with:
   - Justification for access
   - Specific secrets needed
   - Duration of access needed

2. **Approval**: Requires approval from:
   - Project owner for dev/preview access
   - Security team for production access

3. **Provisioning**: Admin grants access via respective dashboards

4. **Audit**: Access grants are logged and reviewed quarterly

### Revocation

Access is revoked when:
- Team member leaves the project
- Role change no longer requires access
- Security incident occurs
- Quarterly access review identifies unnecessary access

---

## Rotation Procedures

### Scheduled Rotation

#### Monthly Rotations
- OpenAI API Key
- Webhook Secrets

#### Quarterly Rotations
- Supabase Service Role Key
- Resend API Key
- Amazon API Credentials

#### Yearly Rotations
- Supabase Anon Key (client-side)

### Rotation Procedure: Supabase Service Role Key

**Criticality**: Critical - affects all database operations

**Steps**:

1. **Preparation**
   ```bash
   # Document current key (first 8 chars for reference)
   echo "Current key starts with: $(echo $SUPABASE_SERVICE_ROLE_KEY | cut -c1-8)"
   ```

2. **Generate New Key**
   - Go to Supabase Dashboard → Settings → API
   - Click "Regenerate" next to Service Role Key
   - Copy the new key immediately

3. **Update Edge Functions**
   - Go to Supabase Dashboard → Settings → Edge Functions
   - Update `SUPABASE_SERVICE_ROLE_KEY`
   - Wait for functions to redeploy (automatic)

4. **Verify**
   ```bash
   # Test an Edge Function that uses the service key
   curl -X POST https://xxx.supabase.co/functions/v1/admin-auth \
     -H "Content-Type: application/json" \
     -d '{"action": "me"}'
   ```

5. **Monitor**
   - Check Edge Function logs for errors
   - Monitor for 30 minutes for any issues

6. **Document**
   - Record rotation in security log
   - Update last rotation date in this document

### Rotation Procedure: Resend API Key

**Steps**:

1. **Generate New Key**
   - Go to Resend Dashboard → API Keys
   - Create new API key with same permissions
   - Copy the new key

2. **Update**
   - Supabase Dashboard → Edge Functions → Secrets
   - Update `RESEND_API` with new key

3. **Verify**
   - Send a test email via contact form
   - Check Resend dashboard for delivery

4. **Revoke Old Key**
   - After successful verification (24 hours)
   - Delete old key from Resend Dashboard

### Emergency Rotation

If a secret is compromised:

1. **Immediate Actions** (within 15 minutes)
   - Rotate the compromised secret immediately
   - Revoke the old secret if possible
   - Check logs for unauthorized access

2. **Assessment** (within 1 hour)
   - Identify scope of compromise
   - Check for data access or exfiltration
   - Document timeline of events

3. **Remediation** (within 24 hours)
   - Complete security audit
   - Rotate related secrets
   - Update security controls if needed

4. **Post-Incident** (within 1 week)
   - Complete incident report
   - Implement preventive measures
   - Update this runbook if needed

---

## Emergency Procedures

### Secret Compromise Response

**Severity Levels**:

| Level | Description | Response Time |
|-------|-------------|---------------|
| Critical | Production secrets exposed | 15 minutes |
| High | Service API keys exposed | 1 hour |
| Medium | Dev/test secrets exposed | 4 hours |
| Low | Potential exposure (no confirmation) | 24 hours |

### Response Checklist

- [ ] Identify compromised secret(s)
- [ ] Rotate secret immediately
- [ ] Check access logs for unauthorized use
- [ ] Notify security team
- [ ] Document incident
- [ ] Review and rotate related secrets
- [ ] Implement additional controls if needed

### Contact Information

| Role | Contact Method |
|------|---------------|
| Project Owner | GitHub Issues |
| Security Contact | security@danpearson.net |

---

## Monitoring & Auditing

### Logging

All secret access is logged:

1. **Supabase Edge Functions**: Logs in Supabase Dashboard → Edge Functions → Logs
2. **Cloudflare Pages**: Logs in Cloudflare Dashboard → Pages → Functions Logs

### Audit Schedule

| Audit Type | Frequency | Owner |
|------------|-----------|-------|
| Access Review | Quarterly | Admin |
| Secret Inventory | Monthly | Developer |
| Rotation Compliance | Monthly | Admin |
| Security Scan | Weekly | Automated |

### Alerts

Configure alerts for:
- Failed authentication attempts (rate limit triggers)
- Unusual API usage patterns
- Secret access from new locations

---

## Best Practices

### DO

✅ Use environment variables for all secrets
✅ Rotate secrets on schedule
✅ Use different secrets for dev/staging/production
✅ Log secret access (not the secret values)
✅ Use secrets managers when available
✅ Encrypt secrets at rest and in transit
✅ Limit secret scope to minimum required

### DON'T

❌ Never commit secrets to version control
❌ Never log secret values
❌ Never share secrets via email or chat
❌ Never use production secrets in development
❌ Never hardcode secrets in source code
❌ Never use the same secret across multiple services

### Code Examples

**Wrong - Hardcoded secret**:
```typescript
// ❌ NEVER DO THIS
const apiKey = "sk-1234567890abcdef";
```

**Correct - Environment variable**:
```typescript
// ✅ Use environment variables
const apiKey = Deno.env.get("API_KEY");
if (!apiKey) {
  throw new Error("API_KEY environment variable is required");
}
```

**Wrong - Logging secrets**:
```typescript
// ❌ NEVER DO THIS
console.log("Using API key:", apiKey);
```

**Correct - Log without secrets**:
```typescript
// ✅ Log safely
console.log("API key configured:", !!apiKey);
```

---

## Appendix

### Secret Template

When adding a new secret:

```
Name: [SECRET_NAME]
Purpose: [What it's used for]
Service: [External service name]
Location: [Where it's stored]
Rotation: [Frequency]
Owner: [Team/person responsible]
Created: [Date]
Last Rotated: [Date]
```

### Rotation Log Template

```
Date: YYYY-MM-DD
Secret: [SECRET_NAME]
Rotated By: [Name]
Reason: [Scheduled/Emergency/Other]
Verification: [How verified]
Notes: [Any issues or observations]
```

---

**Document Version**: 1.0
**Next Review Date**: 2026-03-02
