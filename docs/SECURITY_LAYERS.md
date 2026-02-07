# Defense-in-Depth Security Architecture

This document describes the 4-layer security architecture implemented in the Dan Pearson Portfolio application.

## Overview

The security architecture follows a defense-in-depth approach with multiple layers of protection:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Authentication (WHO are you?)                 │
│  - requireAuth, protectedRoute middleware               │
│  - Validates JWT/session is valid                       │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Authorization (WHAT can you do?)              │
│  - requirePermission('articles.create')                 │
│  - Role level checks (roleLevel >= 5)                   │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Resource Ownership (IS this yours?)           │
│  - Owner checks (created_by = userId)                   │
│  - Assigned access (assigned_to = userId)               │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Database RLS (FINAL enforcement)              │
│  - Row-level security policies in PostgreSQL            │
│  - Even if code has bugs, DB rejects unauthorized       │
└─────────────────────────────────────────────────────────┘
```

## Files and Locations

### Core Security Libraries

| File | Purpose |
|------|---------|
| `src/lib/security-layers.ts` | Core security layer utilities |
| `src/lib/authorization.ts` | Authorization enforcement middleware |
| `src/hooks/useResourceOwnership.ts` | Resource ownership verification hook |
| `src/hooks/useSecureQuery.ts` | Security-enhanced data fetching |
| `src/components/auth/SecureRoute.tsx` | Route protection with all 4 layers |
| `src/components/auth/withSecurityLayers.tsx` | HOC for admin components |
| `src/contexts/SecurityAuditContext.tsx` | Security event tracking |
| `supabase/functions/_shared/security-layers.ts` | Edge function security utilities |

## Layer 1: Authentication

### What It Does

Verifies that the user has a valid session and their identity is confirmed.

### Implementation

```typescript
import { checkAuthentication, getSecurityContext } from '@/lib/security-layers';

// Check if user is authenticated
const authResult = await checkAuthentication();
if (!authResult.passed) {
  // Redirect to login
}

// Get full security context
const context = await getSecurityContext();
// context.userId, context.email, context.roles, context.permissions
```

### In Routes

```tsx
import { SecureRoute } from '@/components/auth/SecureRoute';

// Basic authentication requirement
<SecureRoute>
  <ProtectedPage />
</SecureRoute>

// Admin verification required
<SecureRoute requireAdmin={true}>
  <AdminDashboard />
</SecureRoute>
```

## Layer 2: Authorization

### What It Does

Checks what the authenticated user is allowed to do based on their roles and permissions.

### Permission Pattern

```
resource.action[_scope]

Examples:
- articles.create       - Can create any article
- articles.read_own     - Can only read own articles
- tasks.update_assigned - Can update tasks assigned to them
```

### Implementation

```typescript
import { checkPermission, checkRoleLevel } from '@/lib/authorization';

// Check single permission
const result = checkPermission(userPermissions, userRoles, 'articles.create');
if (!result.authorized) {
  throw new Error(result.reason);
}

// Check role level
if (!meetsRoleLevel(userRoles, 5)) {
  // Role level 5+ required (editor or above)
}
```

### In Routes

```tsx
<SecureRoute
  requirePermission="articles.create"
  requireRoleLevel={5}
>
  <ArticleEditor />
</SecureRoute>

// Multiple permissions (any)
<SecureRoute requirePermission={['articles.read', 'articles.create']}>
  <ArticleManager />
</SecureRoute>

// Multiple permissions (all required)
<SecureRoute
  requirePermission={['articles.read', 'articles.publish']}
  requireAllPermissions={true}
>
  <PublishingDashboard />
</SecureRoute>
```

### Role Hierarchy

```typescript
const ROLE_HIERARCHY = {
  viewer: { level: 1, permissions: ['articles.read', 'projects.read'] },
  editor: { level: 5, permissions: ['articles.*', 'projects.update'], inherits: ['viewer'] },
  manager: { level: 8, permissions: ['users.read', 'tasks.*'], inherits: ['editor'] },
  admin: { level: 10, permissions: ['*'], inherits: ['manager'] },
};
```

## Layer 3: Resource Ownership

### What It Does

Verifies that the user has access to a specific resource (not just the resource type).

### Ownership Policies

Each resource type has an ownership policy:

```typescript
const OWNERSHIP_POLICIES = {
  article: {
    ownerField: 'created_by',
    adminBypass: true,
    bypassRoles: ['admin', 'editor'],
    listAllPermission: 'articles.read',
  },
  vault_item: {
    ownerField: 'user_id',
    adminBypass: false, // Never bypass for sensitive data
    bypassRoles: [],
  },
  task: {
    ownerField: 'created_by',
    additionalAccessFields: ['assigned_to'], // Also grants access
    adminBypass: true,
  },
};
```

### Implementation

```typescript
import { useResourceOwnership } from '@/hooks/useResourceOwnership';

const {
  canAccess,
  isOwner,
  getOwnershipFilter,
  withOwnership,
} = useResourceOwnership({ resourceType: 'article' });

// Check if user can access a specific article
if (!canAccess(article, 'update')) {
  throw new Error('You cannot edit this article');
}

// Get filter for queries (automatically applied)
const filter = getOwnershipFilter();
// filter = { field: 'created_by', value: 'user-uuid' }

// Add ownership to new resources
const newArticle = withOwnership({ title: 'My Article' });
// newArticle = { title: 'My Article', created_by: 'user-uuid' }
```

### In Queries

```typescript
import { useSecureQuery } from '@/hooks/useSecureQuery';

const { data, isLoading, securityStatus } = useSecureQuery({
  queryKey: ['articles'],
  resourceType: 'article',
  action: 'list',
  queryFn: async (ownershipFilter) => {
    let query = supabase.from('articles').select('*');

    // Ownership filter is automatically applied for non-admin users
    if (ownershipFilter) {
      query = query.eq(ownershipFilter.field, ownershipFilter.value);
    }

    return query;
  },
});
```

## Layer 4: Database RLS

### What It Does

PostgreSQL Row-Level Security provides the final enforcement layer. Even if application code has bugs, the database will reject unauthorized access.

### Example RLS Policies

```sql
-- Users can only see their own articles (unless admin)
CREATE POLICY "Users can view own articles" ON articles
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
  );

-- Users can only update their own articles
CREATE POLICY "Users can update own articles" ON articles
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Vault items are strictly personal
CREATE POLICY "Vault items are private" ON secure_vault_items
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

## Using the Security Layers

### 1. Protected Routes

```tsx
// Basic admin route
<Route
  path="/admin/dashboard"
  element={
    <SecureRoute requireAdmin={true}>
      <AdminDashboard />
    </SecureRoute>
  }
/>

// Permission-based route
<Route
  path="/admin/articles"
  element={
    <SecureRoute
      requireAdmin={true}
      requirePermission="articles.read"
      resourceType="article"
      resourceAction="list"
    >
      <ArticleManager />
    </SecureRoute>
  }
/>
```

### 2. HOC for Admin Components

```tsx
import { withSecurityLayers } from '@/components/auth/withSecurityLayers';

const ArticleManager = ({ securityContext, canPerform, hasPermission }) => {
  // securityContext contains userId, roles, permissions

  const canCreate = hasPermission('articles.create');
  const canDelete = hasPermission('articles.delete');

  return (
    <div>
      {canCreate && <CreateArticleButton />}
      {/* ... */}
    </div>
  );
};

export default withSecurityLayers(ArticleManager, {
  resourceType: 'article',
  requiredPermission: 'articles.read',
  requireAdmin: true,
});
```

### 3. Secure Data Fetching

```typescript
import { useSecureQuery, useSecureMutation } from '@/hooks/useSecureQuery';

// Fetch with automatic ownership filtering
const { data: articles } = useSecureQuery({
  queryKey: ['articles'],
  resourceType: 'article',
  action: 'list',
  queryFn: async (ownershipFilter) => {
    let query = supabase.from('articles').select('*');
    if (ownershipFilter) {
      query = query.eq(ownershipFilter.field, ownershipFilter.value);
    }
    return query;
  },
});

// Secure mutations with ownership
const { mutate: createArticle, withOwnership } = useSecureMutation({
  resourceType: 'article',
  action: 'create',
  mutationFn: async (data, { userId, ownerField }) => {
    return supabase
      .from('articles')
      .insert({ ...data, [ownerField]: userId })
      .select()
      .single();
  },
  invalidateQueryKeys: [['articles']],
});

// Create with automatic ownership
createArticle(withOwnership({ title: 'New Article' }));
```

### 4. Edge Function Security

```typescript
// supabase/functions/my-function/index.ts
import {
  requireAuth,
  requireResourceAccess,
  corsHeaders,
  handleCorsOptions,
} from '../_shared/security-layers.ts';

// Simple auth requirement
const handler = requireAuth(
  async (req, user) => {
    // user.userId, user.email, user.roles, user.permissions, user.isAdmin
    return new Response(JSON.stringify({ user }));
  },
  { requiredPermission: 'articles.create' }
);

// Resource-specific access
const resourceHandler = requireResourceAccess(
  async (req, user) => {
    // User verified to own this resource
    return new Response(JSON.stringify({ success: true }));
  },
  {
    table: 'articles',
    ownerField: 'created_by',
    getResourceId: (req) => new URL(req.url).searchParams.get('id'),
  }
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }
  return handler(req);
});
```

### 5. Security Audit Logging

```tsx
import { SecurityAuditProvider, useSecurityAudit } from '@/contexts/SecurityAuditContext';

// Wrap your app
<SecurityAuditProvider persistEvents={true} enableMonitoring={true}>
  <App />
</SecurityAuditProvider>

// Use in components
const { logEvent, recentEvents, stats, hasAlerts } = useSecurityAudit();

// Log custom events
logEvent({
  type: 'access_granted',
  resourceType: 'article',
  resourceId: 'abc-123',
  action: 'update',
  result: 'success',
});

// Use helper hook for resource logging
const { logAccess, logResourceMutation } = useAccessLogger('article');

logAccess('update', articleId, 'success');
logResourceMutation('updated', articleId);
```

## Security Checklist

### For New Admin Components

- [ ] Wrap with `SecureRoute` or use `withSecurityLayers` HOC
- [ ] Specify required permissions
- [ ] Use `useSecureQuery` for data fetching
- [ ] Use `useSecureMutation` for data mutations
- [ ] Add ownership fields to new resources with `withOwnership`
- [ ] Log security events for sensitive operations

### For New Database Tables

- [ ] Add `created_by` column (UUID, references auth.users)
- [ ] Add `updated_by` column (UUID, references auth.users)
- [ ] Create RLS policies for SELECT, INSERT, UPDATE, DELETE
- [ ] Add ownership policy in `OWNERSHIP_POLICIES`
- [ ] Add permission mappings in `RESOURCE_PERMISSIONS`

### For New Edge Functions

- [ ] Import security utilities from `_shared/security-layers.ts`
- [ ] Use `requireAuth` wrapper for authenticated endpoints
- [ ] Use `requireResourceAccess` for resource-specific operations
- [ ] Log security events with `logSecurityEvent`
- [ ] Handle CORS with `corsHeaders` and `handleCorsOptions`

## Testing Security

### Unit Tests

```typescript
import { checkPermission, checkResourceOwnership } from '@/lib/security-layers';

describe('Security Layers', () => {
  it('should deny access without permission', () => {
    const result = checkPermission(
      { userId: 'user-1', permissions: [], roles: [] },
      'article',
      'create'
    );
    expect(result.passed).toBe(false);
  });

  it('should allow admin bypass', () => {
    const result = checkResourceOwnership(
      { userId: 'user-1', roles: ['admin'], permissions: [] },
      'article',
      { id: '1', created_by: 'user-2' }
    );
    expect(result.passed).toBe(true);
  });
});
```

### Integration Tests

Test the full security flow:
1. Unauthenticated access → 401
2. Authenticated but unauthorized → 403
3. Authorized but not owner → 403 (for _own permissions)
4. Full access → 200

## Troubleshooting

### "Access Denied" Errors

1. Check authentication status in `useAuth()`
2. Verify user has required permissions
3. Check ownership if accessing specific resource
4. Review RLS policies in Supabase

### Permission Not Working

1. Verify permission is in `RESOURCE_PERMISSIONS` mapping
2. Check user's actual permissions via `useAuth().permissions`
3. Ensure RPC function `get_user_permissions` returns correct data

### Ownership Filter Not Applied

1. Check `OWNERSHIP_POLICIES` for resource type
2. Verify user is not admin (admins bypass filters)
3. Check `shouldFilter` from `useResourceOwnership`

## Security Events Table Schema

```sql
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users,
  email TEXT,
  resource_type TEXT,
  resource_id TEXT,
  action TEXT,
  layer TEXT,
  result TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_created ON security_events(created_at DESC);
```
