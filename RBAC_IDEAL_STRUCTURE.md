# RBAC Ideal Structure

> **Last Updated**: 2025-11-25
> **Repository**: pearson-style-showcase
> **Status**: Target Architecture

---

## Overview

This document outlines the ideal Role-Based Access Control (RBAC) structure for the Dan Pearson portfolio system, providing a roadmap from current state to full implementation.

---

## 1. Ideal Role Hierarchy

### Role Definitions

```
┌─────────────────────────────────────────────────────────┐
│                      SUPER_ADMIN                        │
│  Full system access, can manage other admins            │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                        ADMIN                            │
│  Full content access, user management, system settings  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                       EDITOR                            │
│  Create/edit content, limited publishing rights         │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                       VIEWER                            │
│  Read-only access to admin dashboard and reports        │
└─────────────────────────────────────────────────────────┘
```

### Role Capabilities Matrix

| Capability | Super Admin | Admin | Editor | Viewer |
|------------|:-----------:|:-----:|:------:|:------:|
| View dashboard | ✅ | ✅ | ✅ | ✅ |
| View content | ✅ | ✅ | ✅ | ✅ |
| Create content | ✅ | ✅ | ✅ | ❌ |
| Edit own content | ✅ | ✅ | ✅ | ❌ |
| Edit all content | ✅ | ✅ | ❌ | ❌ |
| Publish content | ✅ | ✅ | ⚠️* | ❌ |
| Delete content | ✅ | ✅ | ❌ | ❌ |
| Manage users | ✅ | ✅ | ❌ | ❌ |
| Manage roles | ✅ | ❌ | ❌ | ❌ |
| System settings | ✅ | ✅ | ❌ | ❌ |
| View analytics | ✅ | ✅ | ✅ | ✅ |
| Export data | ✅ | ✅ | ❌ | ❌ |
| Manage admins | ✅ | ❌ | ❌ | ❌ |

*⚠️ Editor can publish with approval workflow (optional)

---

## 2. Ideal Database Schema

### Core Tables

#### user_roles (Enhanced)

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,  -- NEW: Role expiration
  is_active BOOLEAN DEFAULT true,  -- NEW: Soft disable
  UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
```

#### admin_whitelist (NEW - Replace hardcoded list)

```sql
CREATE TABLE public.admin_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Migrate existing hardcoded admins
INSERT INTO admin_whitelist (email, is_active, notes) VALUES
  ('dan@danpearson.net', true, 'Primary admin'),
  ('pearsonperformance@gmail.com', true, 'Secondary admin');
```

#### permissions (NEW)

```sql
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL,  -- 'content', 'users', 'system', 'analytics'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed permissions
INSERT INTO permissions (name, description, category) VALUES
  ('articles.create', 'Create new articles', 'content'),
  ('articles.read', 'View articles', 'content'),
  ('articles.update', 'Edit articles', 'content'),
  ('articles.delete', 'Delete articles', 'content'),
  ('articles.publish', 'Publish/unpublish articles', 'content'),
  ('projects.create', 'Create new projects', 'content'),
  ('projects.read', 'View projects', 'content'),
  ('projects.update', 'Edit projects', 'content'),
  ('projects.delete', 'Delete projects', 'content'),
  ('users.read', 'View user list', 'users'),
  ('users.create', 'Create new users', 'users'),
  ('users.update', 'Edit user details', 'users'),
  ('users.delete', 'Delete users', 'users'),
  ('roles.manage', 'Assign and revoke roles', 'users'),
  ('settings.read', 'View system settings', 'system'),
  ('settings.update', 'Modify system settings', 'system'),
  ('analytics.view', 'View analytics dashboard', 'analytics'),
  ('analytics.export', 'Export analytics data', 'analytics');
```

#### role_permissions (NEW)

```sql
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, permission_id)
);

-- Define role-permission mappings
-- Admin gets everything
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

-- Editor gets content creation but not deletion
INSERT INTO role_permissions (role, permission_id)
SELECT 'editor', id FROM permissions
WHERE name IN (
  'articles.create', 'articles.read', 'articles.update',
  'projects.create', 'projects.read', 'projects.update',
  'analytics.view'
);

-- Viewer gets read-only
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions
WHERE name LIKE '%.read' OR name = 'analytics.view';
```

#### admin_activity_log (Enhanced)

```sql
CREATE TABLE public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  action_category TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  resource_title TEXT,
  old_values JSONB,  -- NEW: Track what changed
  new_values JSONB,  -- NEW: Track what changed
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  session_id UUID,  -- NEW: Link to session
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_admin ON admin_activity_log(admin_id);
CREATE INDEX idx_activity_timestamp ON admin_activity_log(timestamp DESC);
CREATE INDEX idx_activity_resource ON admin_activity_log(resource_type, resource_id);
```

---

## 3. Ideal Authentication Flow

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER LOGIN                               │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SUPABASE AUTH                                 │
│                 (Email/Password or SSO)                          │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   admin-auth EDGE FUNCTION                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1. Verify email in admin_whitelist (DATABASE)              │  │
│  │ 2. Verify password via Supabase Auth                       │  │
│  │ 3. Load roles from user_roles table                        │  │
│  │ 4. Load permissions from role_permissions                  │  │
│  │ 5. Create admin_session with JWT                           │  │
│  │ 6. Return user + roles + permissions                       │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       FRONTEND STATE                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ AuthContext stores:                                        │  │
│  │   - session: Supabase session                              │  │
│  │   - user: Auth user                                        │  │
│  │   - adminUser: Admin metadata                              │  │
│  │   - roles: ['admin'] or ['editor'] etc.                    │  │
│  │   - permissions: ['articles.create', 'articles.read', ...] │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PERMISSION CHECKS                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Frontend: usePermission('articles.create')                 │  │
│  │ Backend: RLS policies check user_roles + permissions       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Ideal Frontend Implementation

### Enhanced AuthContext

```typescript
interface AuthContextType {
  // Session Management
  session: Session | null;
  user: User | null;
  adminUser: AdminUser | null;
  isLoading: boolean;

  // Role & Permission State
  roles: AppRole[];
  permissions: string[];

  // Auth Methods
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;

  // Permission Methods
  hasRole: (role: AppRole) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;

  // Computed Properties
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  canManageUsers: boolean;
  canManageContent: boolean;
}
```

### Permission Hook

```typescript
// src/hooks/usePermission.ts
export function usePermission(permission: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

// Usage in components
const ArticleManager = () => {
  const canCreate = usePermission('articles.create');
  const canDelete = usePermission('articles.delete');

  return (
    <div>
      {canCreate && <Button>Create Article</Button>}
      {canDelete && <Button variant="destructive">Delete</Button>}
    </div>
  );
};
```

### Enhanced ProtectedRoute

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireRole?: AppRole | AppRole[];
  requirePermission?: string | string[];
  requireAllPermissions?: boolean;  // AND vs OR for multiple
  redirectTo?: string;
  fallback?: React.ReactNode;
}

// Usage examples
<ProtectedRoute requirePermission="articles.create">
  <ArticleEditor />
</ProtectedRoute>

<ProtectedRoute requireRole={['admin', 'editor']}>
  <ContentDashboard />
</ProtectedRoute>

<ProtectedRoute
  requirePermission={['users.read', 'roles.manage']}
  requireAllPermissions={true}
>
  <UserManagement />
</ProtectedRoute>
```

---

## 5. Ideal Admin Dashboard Structure

### Role-Based Navigation

```typescript
const adminNavigation = [
  // Visible to all roles
  {
    label: 'Dashboard',
    path: '/admin/dashboard',
    permission: null,  // All authenticated users
  },

  // Content management
  {
    label: 'Articles',
    path: '/admin/articles',
    permission: 'articles.read',
    children: [
      { label: 'All Articles', permission: 'articles.read' },
      { label: 'Create New', permission: 'articles.create' },
      { label: 'Categories', permission: 'articles.update' },
    ]
  },
  {
    label: 'Projects',
    path: '/admin/projects',
    permission: 'projects.read',
  },

  // Admin-only sections
  {
    label: 'Users',
    path: '/admin/users',
    permission: 'users.read',
  },
  {
    label: 'Settings',
    path: '/admin/settings',
    permission: 'settings.read',
  },

  // Analytics
  {
    label: 'Analytics',
    path: '/admin/analytics',
    permission: 'analytics.view',
  },
];

// Navigation component filters by permissions
const Navigation = () => {
  const { hasPermission } = useAuth();

  const visibleItems = adminNavigation.filter(
    item => !item.permission || hasPermission(item.permission)
  );

  return <Nav items={visibleItems} />;
};
```

---

## 6. Ideal RLS Policies

### Pattern: Permission-Based RLS

```sql
-- Helper function for permission checks
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role = rp.role
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id
      AND ur.is_active = true
      AND p.name = _permission
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  )
$$;

-- Articles policies
CREATE POLICY "Anyone can view published articles"
  ON articles FOR SELECT
  USING (published = true);

CREATE POLICY "Users with articles.read can view all articles"
  ON articles FOR SELECT
  USING (has_permission(auth.uid(), 'articles.read'));

CREATE POLICY "Users with articles.create can insert"
  ON articles FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'articles.create'));

CREATE POLICY "Users with articles.update can modify"
  ON articles FOR UPDATE
  USING (has_permission(auth.uid(), 'articles.update'));

CREATE POLICY "Users with articles.delete can remove"
  ON articles FOR DELETE
  USING (has_permission(auth.uid(), 'articles.delete'));
```

---

## 7. Ideal Activity Logging

### Automatic Logging Function

```sql
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_activity_log (
    admin_id,
    admin_email,
    action,
    action_category,
    resource_type,
    resource_id,
    old_values,
    new_values
  )
  SELECT
    auth.uid(),
    auth.email(),
    TG_OP,
    'content',
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'UPDATE' OR TG_OP = 'DELETE'
         THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE'
         THEN to_jsonb(NEW) END;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to content tables
CREATE TRIGGER articles_audit
  AFTER INSERT OR UPDATE OR DELETE ON articles
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER projects_audit
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION log_activity();
```

---

## 8. Role Management UI

### Admin Whitelist Management

```typescript
// Component: AdminWhitelistManager
interface AdminWhitelistManagerProps {}

const AdminWhitelistManager: React.FC = () => {
  // Features:
  // - View all whitelisted emails
  // - Add new email to whitelist
  // - Deactivate/reactivate emails
  // - View when added and by whom
  // - Search/filter whitelist
};
```

### User Role Assignment

```typescript
// Component: UserRoleManager
interface UserRoleManagerProps {}

const UserRoleManager: React.FC = () => {
  // Features:
  // - List all users with their current roles
  // - Assign roles to users
  // - Revoke roles from users
  // - Set role expiration dates
  // - View role assignment history
  // - Bulk role operations
};
```

---

## 9. Migration Path

### Phase 1: Database Foundation (Week 1)

1. Create `admin_whitelist` table
2. Migrate hardcoded emails to table
3. Create `permissions` table with seed data
4. Create `role_permissions` table with mappings
5. Enhance `admin_activity_log` table

### Phase 2: Backend Updates (Week 2)

1. Update `admin-auth` Edge Function to use `admin_whitelist`
2. Add permission loading to auth response
3. Implement `has_permission()` function
4. Update RLS policies to use permissions
5. Add activity logging triggers

### Phase 3: Frontend Updates (Week 3)

1. Enhance `AuthContext` with roles/permissions
2. Create `usePermission` hook
3. Update `ProtectedRoute` component
4. Add permission checks to all admin components
5. Implement role-based navigation

### Phase 4: Management UI (Week 4)

1. Build `AdminWhitelistManager` component
2. Build `UserRoleManager` component
3. Add activity log viewer
4. Implement audit reporting
5. Testing and documentation

---

## 10. Success Criteria

### Functional Requirements

- [ ] Admin whitelist managed via database, not code
- [ ] All three roles (admin, editor, viewer) functional
- [ ] Fine-grained permissions for all resources
- [ ] Permission checks at both frontend and database level
- [ ] Automatic activity logging for all mutations
- [ ] Role management UI accessible to super admins

### Security Requirements

- [ ] No hardcoded credentials in code
- [ ] Session tokens validated on each request
- [ ] Role changes require reauthentication
- [ ] Activity logs cannot be modified or deleted
- [ ] Rate limiting on all auth endpoints

### Performance Requirements

- [ ] Permission checks < 10ms
- [ ] Role loading < 100ms
- [ ] Activity logs paginated and indexed
- [ ] No N+1 queries in permission checks

---

## Summary

The ideal RBAC structure transforms the current binary admin/non-admin system into a comprehensive, scalable permission system with:

1. **Database-driven whitelist** - No more hardcoded admin emails
2. **Three-tier role hierarchy** - Admin, Editor, Viewer
3. **Fine-grained permissions** - Per-resource CRUD operations
4. **Frontend integration** - Hooks and components for permission checks
5. **Comprehensive logging** - Automatic audit trail for all changes
6. **Management UI** - Self-service role and whitelist management

---

*Document created 2025-11-25 as target architecture reference*
