# Security Audit Report
**Date:** 2025-11-09
**Auditor:** Claude AI Security Assistant
**Scope:** Full application security review

## Executive Summary

This security audit identified **10 security vulnerabilities** ranging from **CRITICAL** to **LOW** severity. The most critical issues involve exposed credentials, vulnerable dependencies, and authentication weaknesses. Immediate remediation is required for CRITICAL and HIGH severity findings.

**Critical Findings:** 1
**High Findings:** 4
**Medium Findings:** 3
**Low Findings:** 2
**Informational:** 3 (Good practices identified)

---

## CRITICAL SEVERITY VULNERABILITIES

### 1. Hardcoded Supabase Credentials in Client Code
**Location:** `src/integrations/supabase/client.ts:6-7`
**CVSS Score:** 9.8 (Critical)
**CWE:** CWE-798 (Use of Hard-coded Credentials)

#### Description
Supabase URL and publishable API key are hardcoded as fallback values in the client-side code. These credentials are exposed to all users and can be extracted from the browser.

#### Evidence
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qazhdcqvjppbbjxzvisp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

#### Impact
- Attackers can directly access your Supabase instance
- Potential unauthorized data access or manipulation
- Database queries can be executed from anywhere
- Complete compromise of Row-Level Security (RLS) if not properly configured

#### Remediation
**Required:** Remove hardcoded credentials immediately and enforce environment variables:

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}
```

**Additional Steps:**
1. Rotate Supabase anon key immediately
2. Ensure all Supabase tables have proper RLS policies
3. Add `.env` to `.gitignore`
4. Create `.env.example` template without sensitive values

---

## HIGH SEVERITY VULNERABILITIES

### 2. Vulnerable Dependencies with Known CVEs
**Location:** `package.json`
**CVSS Score:** 7.5 (High)
**CWE:** CWE-1104 (Use of Unmaintained Third Party Components)

#### Description
Multiple npm packages have known security vulnerabilities:

1. **vite** (4.5.14) - Multiple vulnerabilities:
   - Path traversal allowing file system bypass
   - Server.fs settings not applied to HTML files
   - Backslash bypass on Windows (GHSA-93m4-6634-74q7)

2. **react-syntax-highlighter** (15.6.1) - Vulnerable to XSS via prismjs dependency
   - PrismJS DOM Clobbering vulnerability (GHSA-x7hr-w5r2-h6wg)
   - CVE affecting versions < 1.30.0

3. **esbuild** - Development server information disclosure (GHSA-67mh-4wv8-2f99)

#### Impact
- Path traversal attacks exposing sensitive files
- Cross-site scripting (XSS) vulnerabilities
- Information disclosure
- Potential arbitrary code execution

#### Remediation
Update vulnerable packages:

```bash
npm install vite@latest --save-dev
npm install react-syntax-highlighter@^16.1.0
```

Update `package.json`:
```json
{
  "dependencies": {
    "react-syntax-highlighter": "^16.1.0"
  },
  "devDependencies": {
    "vite": "^6.1.7"
  }
}
```

### 3. Missing .env in .gitignore
**Location:** `.gitignore`
**CVSS Score:** 7.5 (High)
**CWE:** CWE-526 (Exposure of Sensitive Information Through Environmental Variables)

#### Description
The `.gitignore` file does not include `.env`, risking accidental commit of sensitive credentials to version control.

#### Impact
- Credentials may be committed to Git history
- Exposed API keys, database passwords, etc.
- Difficult to revoke once committed

#### Remediation
Add to `.gitignore`:
```
# Environment variables
.env
.env.local
.env.*.local
```

Check git history:
```bash
git log --all --full-history -- .env
```

If `.env` was committed, rotate all credentials immediately.

### 4. Two-Factor Authentication Not Enforced
**Location:** `src/pages/AdminLogin.tsx:264-279`, `supabase/functions/admin-auth/index.ts:182`
**CVSS Score:** 7.3 (High)
**CWE:** CWE-287 (Improper Authentication)

#### Description
UI elements exist for TOTP 2FA, but it's never enforced. The `requiresTOTP` state is never set to `true`, and the backend always returns `two_factor_enabled: false`.

#### Evidence
```typescript
// Frontend - requiresTOTP never set to true
const [requiresTOTP, setRequiresTOTP] = useState(false);

// Backend - always returns false
two_factor_enabled: false
```

#### Impact
- Admin accounts protected only by password
- No second factor protection against credential theft
- Increased risk of unauthorized admin access

#### Remediation
Implement proper TOTP verification:
1. Store 2FA secrets in database
2. Verify TOTP codes during login
3. Enforce 2FA for all admin accounts
4. Add 2FA setup flow

### 5. LocalStorage Used for Authentication Tokens
**Location:** `src/integrations/supabase/client.ts:14`
**CVSS Score:** 6.5 (High)
**CWE:** CWE-922 (Insecure Storage of Sensitive Information)

#### Description
Authentication tokens are stored in `localStorage`, which is vulnerable to XSS attacks.

#### Evidence
```typescript
auth: {
  storage: localStorage,
  persistSession: true,
}
```

#### Impact
- XSS attacks can steal authentication tokens
- Session hijacking possible
- No httpOnly protection

#### Remediation
Consider using httpOnly cookies for production:
```typescript
auth: {
  storage: {
    getItem: (key) => {
      // Custom implementation with more secure storage
      return sessionStorage.getItem(key);
    },
    setItem: (key, value) => {
      sessionStorage.setItem(key, value);
    },
    removeItem: (key) => {
      sessionStorage.removeItem(key);
    }
  },
  persistSession: false, // More secure for admin
  autoRefreshToken: true,
  detectSessionInUrl: false, // Prevent token in URL
}
```

Or configure Supabase to use httpOnly cookies server-side.

---

## MEDIUM SEVERITY VULNERABILITIES

### 6. Rate Limiting Uses In-Memory Storage
**Location:** `supabase/functions/admin-auth/index.ts:23`
**CVSS Score:** 5.3 (Medium)
**CWE:** CWE-770 (Allocation of Resources Without Limits)

#### Description
Rate limiting uses an in-memory Map that resets when the edge function cold-starts, allowing attackers to bypass rate limits.

#### Evidence
```typescript
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
```

#### Impact
- Brute force attacks possible by waiting for cold start
- Rate limits can be bypassed
- No persistent tracking across function instances

#### Remediation
Use Supabase database for rate limiting:

```typescript
async function checkRateLimit(ip: string, supabase: any): Promise<boolean> {
  const now = Date.now();
  const lockoutTime = 15 * 60 * 1000; // 15 minutes

  const { data } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('ip_address', ip)
    .eq('action', 'login')
    .single();

  if (data && data.attempts >= 5 && (now - new Date(data.last_attempt).getTime()) < lockoutTime) {
    return false;
  }

  return true;
}
```

### 7. Verbose Error Messages Expose Implementation Details
**Location:** `supabase/functions/admin-auth/index.ts:311`
**CVSS Score:** 5.3 (Medium)
**CWE:** CWE-209 (Generation of Error Message Containing Sensitive Information)

#### Description
Error messages return detailed information including error.message which may expose internal implementation details.

#### Evidence
```typescript
return new Response(
  JSON.stringify({ error: "Internal server error", details: error.message }),
  { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

#### Impact
- Information disclosure
- Helps attackers understand system internals
- May expose stack traces or file paths

#### Remediation
```typescript
console.error("Request error:", error); // Log full error server-side only
return new Response(
  JSON.stringify({ error: "Internal server error" }), // Generic message to client
  { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

### 8. CORS Origin Hardcoded in Edge Functions
**Location:** Multiple edge functions (e.g., `admin-auth/index.ts:10`, `newsletter-signup/index.ts:6`)
**CVSS Score:** 4.3 (Medium)
**CWE:** CWE-942 (Permissive Cross-domain Policy)

#### Description
CORS origin is hardcoded rather than using environment variables, making it difficult to test in different environments.

#### Evidence
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://danpearson.net", // TODO: Update to your domain
```

#### Impact
- Cannot test from localhost without modifying code
- Deployment to staging requires code changes
- Less flexible configuration

#### Remediation
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://danpearson.net",
```

---

## LOW SEVERITY VULNERABILITIES

### 9. No Content Security Policy (CSP)
**Location:** Application-wide
**CVSS Score:** 3.7 (Low)
**CWE:** CWE-1021 (Improper Restriction of Rendered UI Layers)

#### Description
No Content Security Policy headers detected to mitigate XSS attacks.

#### Impact
- Reduced protection against XSS
- No mitigation for clickjacking
- Missing defense-in-depth layer

#### Remediation
Add CSP headers in `index.html` or via server:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https: blob:;
  connect-src 'self' https://qazhdcqvjppbbjxzvisp.supabase.co;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
">
```

### 10. Database Queries Without Parameterization Validation
**Location:** Multiple admin components
**CVSS Score:** 3.1 (Low)
**CWE:** CWE-89 (SQL Injection)

#### Description
While Supabase client library provides protection against SQL injection, there's no explicit input sanitization before database queries in admin components.

#### Impact
- Low risk due to Supabase's built-in protections
- Defense-in-depth missing
- Potential issues if custom SQL used later

#### Remediation
Add input validation for all user inputs:

```typescript
// Example for AIToolsManager
const saveTool = async () => {
  // Validate inputs
  if (!formData.title || formData.title.length > 255) {
    toast({ variant: "destructive", title: "Invalid title length" });
    return;
  }

  // Sanitize HTML content if rendered
  if (formData.description) {
    const sanitizedDescription = DOMPurify.sanitize(formData.description);
    formData.description = sanitizedDescription;
  }

  // ... rest of the code
}
```

---

## POSITIVE SECURITY PRACTICES IDENTIFIED

### 1. Rate Limiting Implementation ✓
Both `admin-auth` and `newsletter-signup` functions implement rate limiting, though using in-memory storage (see #6).

### 2. Email Validation ✓
`newsletter-signup` function has comprehensive email validation including:
- Format validation with regex
- Length checks
- Disposable email domain blocking

### 3. Admin Email Whitelist ✓
`admin-auth` function uses a whitelist approach for admin access, limiting access to specific email addresses.

---

## PRIORITY REMEDIATION ROADMAP

### Immediate (Within 24 hours)
1. ✅ Remove hardcoded Supabase credentials (#1)
2. ✅ Add `.env` to `.gitignore` (#3)
3. ✅ Rotate Supabase anon key
4. ✅ Create `.env.example` file

### Short-term (Within 1 week)
5. ✅ Update vulnerable dependencies (#2)
6. ⚠️ Implement proper 2FA enforcement (#4)
7. ✅ Fix verbose error messages (#7)
8. ✅ Move CORS origin to environment variable (#8)

### Medium-term (Within 1 month)
9. ⚠️ Migrate rate limiting to database (#6)
10. ⚠️ Consider httpOnly cookies for auth tokens (#5)
11. ✅ Add Content Security Policy (#9)
12. ✅ Add input validation middleware (#10)

---

## COMPLIANCE NOTES

- **GDPR:** PII handling appears adequate with email validation
- **OWASP Top 10 2021:**
  - A01:2021 – Broken Access Control: Addressed by admin whitelist
  - A02:2021 – Cryptographic Failures: SSL/TLS in use
  - A03:2021 – Injection: Supabase provides protection
  - A07:2021 – Identification and Authentication Failures: #4, #5 need attention
  - A09:2021 – Security Logging and Monitoring Failures: Logging present

---

## TESTING RECOMMENDATIONS

1. **Penetration Testing:** Conduct after fixing CRITICAL and HIGH issues
2. **Dependency Scanning:** Integrate `npm audit` into CI/CD
3. **SAST Tools:** Consider integrating Snyk or SonarQube
4. **Regular Audits:** Quarterly security reviews recommended

---

## CONCLUSION

The application has a solid foundation with good security practices in rate limiting and input validation. However, the hardcoded credentials and vulnerable dependencies pose significant risks that require immediate attention. Following the remediation roadmap will significantly improve the security posture.

**Overall Security Grade: C+ (Before remediation)**
**Target Grade: A- (After remediation)**
