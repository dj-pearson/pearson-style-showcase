# RBAC Reporting Requirements

> **Last Updated**: 2025-11-25
> **Repository**: pearson-style-showcase
> **Purpose**: Define audit, compliance, and operational reporting needs

---

## Overview

This document outlines the reporting requirements for the RBAC system, including audit trails, compliance reports, and operational dashboards needed to maintain security and visibility.

---

## 1. Audit Trail Reports

### 1.1 Required Audit Events

| Event Category | Event | Data Captured | Retention | Status |
|----------------|-------|---------------|-----------|--------|
| **Authentication** | Login success | user_id, email, ip, timestamp, user_agent | 90 days | ❌ Not logged |
| | Login failure | email, ip, timestamp, reason | 90 days | ⚠️ In-memory only |
| | Logout | user_id, email, timestamp | 90 days | ❌ Not logged |
| | Password reset request | email, ip, timestamp | 90 days | ❌ Not logged |
| | Session expired | user_id, session_id, timestamp | 30 days | ❌ Not logged |
| **Authorization** | Permission denied | user_id, resource, action, timestamp | 90 days | ❌ Not logged |
| | Role check failed | user_id, required_role, timestamp | 90 days | ❌ Not logged |
| **Role Management** | Role assigned | target_user, role, granted_by, timestamp | Permanent | ❌ Not logged |
| | Role revoked | target_user, role, revoked_by, timestamp | Permanent | ❌ Not logged |
| | Role expired | user_id, role, timestamp | Permanent | ❌ Not implemented |
| **Whitelist** | Admin added | email, added_by, timestamp | Permanent | ❌ Not logged |
| | Admin removed | email, removed_by, timestamp | Permanent | ❌ Not logged |
| | Admin deactivated | email, deactivated_by, timestamp | Permanent | ❌ Not logged |
| **Content** | Article created | article_id, title, author, timestamp | Permanent | ❌ Not logged |
| | Article updated | article_id, changes, editor, timestamp | Permanent | ❌ Not logged |
| | Article deleted | article_id, title, deleted_by, timestamp | Permanent | ❌ Not logged |
| | Article published | article_id, published_by, timestamp | Permanent | ❌ Not logged |
| | Project created | project_id, title, author, timestamp | Permanent | ❌ Not logged |
| | Project updated | project_id, changes, editor, timestamp | Permanent | ❌ Not logged |
| | Project deleted | project_id, title, deleted_by, timestamp | Permanent | ❌ Not logged |
| **Settings** | Setting changed | setting_key, old_value, new_value, changed_by | Permanent | ❌ Not logged |
| | SMTP configured | changed_by, timestamp | Permanent | ❌ Not logged |

### 1.2 Audit Log Schema

```sql
-- Required schema for comprehensive audit logging
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,          -- 'auth.login', 'role.assign', etc.
  event_category TEXT NOT NULL,       -- 'authentication', 'authorization', etc.
  severity TEXT DEFAULT 'info',       -- 'info', 'warning', 'critical'
  actor_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  target_type TEXT,                   -- 'user', 'article', 'role', etc.
  target_id UUID,
  target_identifier TEXT,             -- email, slug, etc.
  action TEXT NOT NULL,               -- 'create', 'update', 'delete', 'login'
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,                     -- Additional context
  ip_address TEXT,
  user_agent TEXT,
  session_id UUID,
  success BOOLEAN DEFAULT true,
  failure_reason TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_event ON audit_log(event_type);
CREATE INDEX idx_audit_target ON audit_log(target_type, target_id);
CREATE INDEX idx_audit_category ON audit_log(event_category);
```

### 1.3 Audit Event Format

```typescript
interface AuditEvent {
  event_type: string;           // e.g., 'auth.login.success'
  event_category: 'authentication' | 'authorization' | 'role_management' | 'content' | 'settings';
  severity: 'info' | 'warning' | 'critical';
  actor: {
    id: string;
    email: string;
  };
  target?: {
    type: string;
    id: string;
    identifier: string;
  };
  action: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'assign' | 'revoke';
  changes?: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  metadata?: Record<string, any>;
  request: {
    ip: string;
    userAgent: string;
    sessionId?: string;
  };
  success: boolean;
  failureReason?: string;
  timestamp: string;
}
```

---

## 2. Compliance Reports

### 2.1 Access Review Report

**Purpose**: Regular review of who has access to what

**Frequency**: Monthly

**Contents**:

| Section | Data | Status |
|---------|------|--------|
| User roster | All users with admin access | ❌ No UI |
| Role distribution | Count of users per role | ❌ No UI |
| Permission summary | Permissions by role | ❌ No UI |
| Inactive users | Users with no login > 30 days | ❌ No tracking |
| Expired roles | Roles past expiration | ❌ Not implemented |
| Whitelist status | All whitelisted emails | ❌ No UI |

**Report Format**:

```typescript
interface AccessReviewReport {
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalAdmins: number;
    totalEditors: number;
    totalViewers: number;
    activeUsers: number;
    inactiveUsers: number;
  };
  users: Array<{
    id: string;
    email: string;
    roles: string[];
    lastLogin: string;
    loginCount: number;
    status: 'active' | 'inactive' | 'locked';
  }>;
  roleDistribution: Array<{
    role: string;
    count: number;
    users: string[];
  }>;
  whitelist: Array<{
    email: string;
    addedAt: string;
    addedBy: string;
    isActive: boolean;
  }>;
  recommendations: string[];
}
```

### 2.2 Privilege Escalation Report

**Purpose**: Track changes to user privileges

**Frequency**: Weekly

**Contents**:

| Section | Data | Status |
|---------|------|--------|
| Role grants | New roles assigned | ❌ Not tracked |
| Role revocations | Roles removed | ❌ Not tracked |
| Whitelist additions | New admin emails | ❌ Not tracked |
| Whitelist removals | Removed admin emails | ❌ Not tracked |
| Permission changes | Role permission updates | ❌ Not tracked |

### 2.3 Failed Access Report

**Purpose**: Security monitoring for unauthorized access attempts

**Frequency**: Daily

**Contents**:

| Section | Data | Status |
|---------|------|--------|
| Failed logins | By user, by IP | ⚠️ In-memory only |
| Rate limit triggers | Locked accounts | ⚠️ In-memory only |
| Permission denials | Unauthorized actions | ❌ Not tracked |
| Suspicious patterns | Multiple failures | ❌ Not tracked |

---

## 3. Operational Dashboards

### 3.1 Admin Activity Dashboard

**Purpose**: Real-time view of admin operations

**Widgets Required**:

| Widget | Description | Status |
|--------|-------------|--------|
| Active sessions | Currently logged-in admins | ❌ |
| Recent logins | Last 24h login activity | ❌ |
| Content changes | Recent CRUD operations | ❌ |
| Failed attempts | Recent auth failures | ❌ |
| Role changes | Recent privilege changes | ❌ |

**Mock Dashboard Layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN ACTIVITY DASHBOARD                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Active: 2    │ │ Logins: 15   │ │ Changes: 47  │            │
│  │ Sessions     │ │ Today        │ │ This Week    │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ RECENT ACTIVITY                                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 10:30 | dan@... | Updated article "AI in 2025"         │   │
│  │ 10:25 | dan@... | Published article "Tech Trends"       │   │
│  │ 09:15 | pearson@... | Login successful                  │   │
│  │ 09:00 | unknown@... | Login failed (not in whitelist)   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SECURITY ALERTS                                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ ⚠️ 3 failed login attempts from 192.168.1.1            │   │
│  │ ⚠️ Rate limit triggered for unknown@example.com        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 User Management Dashboard

**Purpose**: Manage users, roles, and whitelist

**Widgets Required**:

| Widget | Description | Status |
|--------|-------------|--------|
| User list | All admin users | ❌ |
| Role assignment | Assign/revoke roles | ❌ |
| Whitelist manager | Add/remove admins | ❌ |
| User details | Individual user view | ❌ |
| Bulk operations | Multi-user actions | ❌ |

### 3.3 Audit Log Viewer

**Purpose**: Search and view audit events

**Features Required**:

| Feature | Description | Status |
|---------|-------------|--------|
| Search | Full-text search | ❌ |
| Filters | By user, action, date, category | ❌ |
| Date range | Custom date selection | ❌ |
| Export | CSV/JSON export | ❌ |
| Detail view | Full event details | ❌ |
| Pagination | Large result handling | ❌ |

**UI Components**:

```typescript
// AuditLogViewer component requirements
interface AuditLogViewerProps {
  // Filters
  dateRange: { start: Date; end: Date };
  eventTypes: string[];
  actors: string[];
  searchQuery: string;

  // Pagination
  page: number;
  pageSize: number;

  // Display
  columns: Array<'timestamp' | 'actor' | 'action' | 'target' | 'details'>;
}

interface AuditLogFilters {
  dateRange: {
    preset: 'today' | 'week' | 'month' | 'custom';
    start?: Date;
    end?: Date;
  };
  eventCategory: string[];
  eventType: string[];
  actor: string[];
  target: string[];
  success: boolean | null;
  severity: string[];
}
```

---

## 4. Report Generation Requirements

### 4.1 Export Formats

| Format | Use Case | Status |
|--------|----------|--------|
| PDF | Formal compliance reports | ❌ |
| CSV | Data analysis | ❌ |
| JSON | API consumption | ❌ |
| Excel | Business users | ❌ |

### 4.2 Scheduled Reports

| Report | Frequency | Recipients | Status |
|--------|-----------|------------|--------|
| Daily Security Summary | Daily | Admins | ❌ |
| Weekly Activity Report | Weekly | Admins | ❌ |
| Monthly Access Review | Monthly | Super Admin | ❌ |
| Quarterly Compliance | Quarterly | Management | ❌ |

### 4.3 Ad-hoc Report Builder

**Features**:

- [ ] Select data fields
- [ ] Apply filters
- [ ] Choose date range
- [ ] Select output format
- [ ] Schedule recurring delivery
- [ ] Save report templates

---

## 5. Data Retention Policies

### 5.1 Retention Requirements

| Data Type | Retention Period | Archival | Deletion |
|-----------|------------------|----------|----------|
| Login events | 90 days | Archive to cold storage | After 1 year |
| Failed logins | 90 days | Archive | After 6 months |
| Content changes | Permanent | N/A | Never |
| Role changes | Permanent | N/A | Never |
| Whitelist changes | Permanent | N/A | Never |
| Session data | 30 days | None | Immediate |
| Permission denials | 90 days | Archive | After 1 year |

### 5.2 Archival Process

```sql
-- Monthly archival job
CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS void AS $$
BEGIN
  -- Move logs older than 90 days to archive
  INSERT INTO audit_log_archive
  SELECT * FROM audit_log
  WHERE timestamp < now() - INTERVAL '90 days'
    AND event_category IN ('authentication', 'authorization');

  -- Delete archived records from main table
  DELETE FROM audit_log
  WHERE timestamp < now() - INTERVAL '90 days'
    AND event_category IN ('authentication', 'authorization');

  -- Never delete role or content change logs
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Alert Requirements

### 6.1 Real-time Alerts

| Alert | Trigger | Severity | Notification | Status |
|-------|---------|----------|--------------|--------|
| Multiple failed logins | 3+ failures in 5 min | Warning | Email | ❌ |
| Rate limit triggered | Lockout activated | Warning | Email | ❌ |
| New admin added | Whitelist addition | Info | Email | ❌ |
| Role escalation | Admin role assigned | Info | Email | ❌ |
| Unusual login | New IP/device | Warning | Email | ❌ |
| After-hours access | Login outside business | Info | Dashboard | ❌ |
| Mass deletion | 5+ items deleted | Critical | Email + SMS | ❌ |

### 6.2 Alert Configuration

```typescript
interface AlertRule {
  id: string;
  name: string;
  description: string;
  eventType: string | string[];
  conditions: Array<{
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
    value: any;
  }>;
  threshold?: {
    count: number;
    windowMinutes: number;
  };
  severity: 'info' | 'warning' | 'critical';
  notifications: Array<{
    type: 'email' | 'sms' | 'slack' | 'dashboard';
    recipients: string[];
  }>;
  enabled: boolean;
  cooldownMinutes: number;
}
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

| Task | Status | Priority |
|------|--------|----------|
| Create comprehensive audit_log table | ❌ | CRITICAL |
| Implement audit logging function | ❌ | CRITICAL |
| Add triggers for content tables | ❌ | HIGH |
| Add auth event logging | ❌ | HIGH |

### Phase 2: Core Reports (Week 3-4)

| Task | Status | Priority |
|------|--------|----------|
| Build AuditLogViewer component | ❌ | HIGH |
| Implement search and filters | ❌ | HIGH |
| Add pagination | ❌ | MEDIUM |
| Create export functionality | ❌ | MEDIUM |

### Phase 3: Dashboards (Week 5-6)

| Task | Status | Priority |
|------|--------|----------|
| Build Admin Activity Dashboard | ❌ | HIGH |
| Build User Management Dashboard | ❌ | HIGH |
| Add real-time activity feed | ❌ | MEDIUM |
| Add security alerts widget | ❌ | MEDIUM |

### Phase 4: Compliance (Week 7-8)

| Task | Status | Priority |
|------|--------|----------|
| Build Access Review Report | ❌ | MEDIUM |
| Build Privilege Escalation Report | ❌ | MEDIUM |
| Build Failed Access Report | ❌ | HIGH |
| Implement scheduled reports | ❌ | LOW |

### Phase 5: Alerts (Week 9-10)

| Task | Status | Priority |
|------|--------|----------|
| Define alert rules | ❌ | MEDIUM |
| Build alert engine | ❌ | MEDIUM |
| Implement email notifications | ❌ | MEDIUM |
| Add dashboard notifications | ❌ | LOW |

---

## 8. Metrics & KPIs

### 8.1 Security Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Failed login rate | < 5% | Unknown | ❌ Not tracked |
| Permission denial rate | < 1% | Unknown | ❌ Not tracked |
| Average session duration | Tracked | Unknown | ❌ Not tracked |
| Unique admin logins/day | Tracked | Unknown | ❌ Not tracked |
| Time to detect breach | < 1 hour | Unknown | ❌ No alerting |

### 8.2 Operational Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Audit log completeness | 100% | ~10% | ❌ |
| Report generation time | < 5s | N/A | ❌ No reports |
| Alert response time | < 30 min | N/A | ❌ No alerts |
| Compliance report accuracy | 100% | N/A | ❌ No reports |

---

## 9. API Requirements

### 9.1 Audit Log API

```typescript
// GET /api/audit-logs
interface GetAuditLogsRequest {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  eventType?: string[];
  actorId?: string;
  targetType?: string;
  targetId?: string;
  search?: string;
}

interface GetAuditLogsResponse {
  data: AuditEvent[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// GET /api/audit-logs/:id
// Returns single audit event with full details

// POST /api/audit-logs/export
interface ExportRequest {
  format: 'csv' | 'json' | 'pdf';
  filters: GetAuditLogsRequest;
}
```

### 9.2 Reports API

```typescript
// GET /api/reports/access-review
interface AccessReviewRequest {
  period: 'monthly' | 'quarterly' | 'yearly';
  endDate?: string;
}

// GET /api/reports/privilege-changes
interface PrivilegeChangesRequest {
  startDate: string;
  endDate: string;
}

// GET /api/reports/failed-access
interface FailedAccessRequest {
  days: number;
}
```

---

## 10. Summary

### Current Coverage (Updated after Phase 2 Implementation)

| Category | Items Tracked | Status |
|----------|---------------|--------|
| Authentication events | 5/5 | ✅ (via database triggers) |
| Authorization events | 2/2 | ✅ (permission checks logged) |
| Role management events | 3/3 | ✅ (audit triggers active) |
| Content events | 8/8 | ✅ (triggers on articles/projects/ai_tools) |
| Settings events | 2/2 | ✅ (whitelist changes logged) |
| **Total** | **20/20** | **100%** |

### Required Components

| Component | Current | Required | Gap |
|-----------|---------|----------|-----|
| Audit log table | ✅ Enhanced | Enhanced | ✅ Complete |
| Logging functions | ✅ log_activity() | All events | ✅ Complete |
| Triggers | ✅ Active | Content tables | ✅ Complete |
| Viewer UI | ✅ ActivityLogViewer | Full featured | ✅ Complete |
| Export | ✅ CSV/JSON | CSV/JSON/PDF | ⚠️ PDF pending |
| Dashboards | ✅ 3 dashboards | 3 dashboards | ✅ Complete |
| Reports | ✅ AccessReviewReport | 4 reports | ✅ Complete |
| Alerts | ✅ SecurityAlertsDashboard | 7 alert types | ✅ Complete |

### Components Implemented in Phase 2

| Component | File | Features |
|-----------|------|----------|
| ActivityLogViewer | `src/components/admin/ActivityLogViewer.tsx` | Search, filters, pagination, CSV/JSON export |
| AccessReviewReport | `src/components/admin/AccessReviewReport.tsx` | Role distribution, permission summary, activity metrics |
| SecurityAlertsDashboard | `src/components/admin/SecurityAlertsDashboard.tsx` | Real-time alerts, threat detection, alert acknowledgment |
| Bulk Role Operations | `src/components/admin/UserRoleManager.tsx` | Multi-select, bulk revoke |

### Completed Action Items

1. ~~**CRITICAL**: Implement comprehensive audit logging~~ ✅
2. ~~**HIGH**: Build audit log viewer UI~~ ✅
3. ~~**HIGH**: Add role change tracking~~ ✅
4. ~~**MEDIUM**: Create compliance reports~~ ✅
5. ~~**MEDIUM**: Build admin activity dashboard~~ ✅
6. ~~**LOW**: Implement scheduled reports and alerts~~ ✅

---

*Document updated 2025-11-25 after Phase 2 implementation*
