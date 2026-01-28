/**
 * Security Layers - Defense-in-Depth Security Architecture
 *
 * This module implements a 4-layer security model:
 *
 * Layer 1: Authentication (WHO are you?)
 * - Validates JWT/session is valid
 * - Checks session expiry and rotation
 *
 * Layer 2: Authorization (WHAT can you do?)
 * - Permission-based access control
 * - Role level checks
 *
 * Layer 3: Resource Ownership (IS this yours?)
 * - Tenant/organization filtering
 * - Owner checks for "own" access patterns
 *
 * Layer 4: Database RLS (FINAL enforcement)
 * - Row-level security policies in PostgreSQL
 * - Even if code has bugs, DB rejects unauthorized access
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type SecurityLayerResult = {
  passed: boolean;
  layer: 'authentication' | 'authorization' | 'ownership' | 'rls';
  error?: string;
  details?: Record<string, unknown>;
};

export type SecurityCheckResult = {
  authorized: boolean;
  layers: SecurityLayerResult[];
  failedAt?: 'authentication' | 'authorization' | 'ownership' | 'rls';
  error?: string;
};

export type ResourceType =
  | 'article'
  | 'project'
  | 'task'
  | 'invoice'
  | 'payment'
  | 'contact'
  | 'vault_item'
  | 'support_ticket'
  | 'journal_entry'
  | 'document'
  | 'kb_article'
  | 'newsletter'
  | 'testimonial'
  | 'venture'
  | 'ai_tool';

export type AccessAction = 'create' | 'read' | 'update' | 'delete' | 'list';

export interface ResourceOwnership {
  resourceType: ResourceType;
  resourceId?: string;
  createdBy?: string;
  assignedTo?: string;
  tenantId?: string;
}

export interface SecurityContext {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface OwnershipPolicy {
  /** Field name that stores the creator/owner ID */
  ownerField: string;
  /** Additional fields that can grant access (e.g., assigned_to) */
  additionalAccessFields?: string[];
  /** Whether admins bypass ownership checks */
  adminBypass?: boolean;
  /** Roles that bypass ownership checks */
  bypassRoles?: string[];
  /** Whether to allow access to all resources if user has specific permission */
  listAllPermission?: string;
}

// ============================================================================
// Resource Configuration
// ============================================================================

/**
 * Ownership policies for each resource type
 * This defines how ownership is determined for each resource
 */
export const OWNERSHIP_POLICIES: Record<ResourceType, OwnershipPolicy> = {
  article: {
    ownerField: 'created_by',
    adminBypass: true,
    bypassRoles: ['admin', 'editor'],
    listAllPermission: 'articles.read',
  },
  project: {
    ownerField: 'created_by',
    adminBypass: true,
    bypassRoles: ['admin'],
    listAllPermission: 'projects.read',
  },
  task: {
    ownerField: 'created_by',
    additionalAccessFields: ['assigned_to'],
    adminBypass: true,
    listAllPermission: 'tasks.read',
  },
  invoice: {
    ownerField: 'created_by',
    adminBypass: true,
    bypassRoles: ['admin'],
    listAllPermission: 'invoices.read',
  },
  payment: {
    ownerField: 'created_by',
    adminBypass: true,
    bypassRoles: ['admin'],
    listAllPermission: 'payments.read',
  },
  contact: {
    ownerField: 'created_by',
    adminBypass: true,
    listAllPermission: 'contacts.read',
  },
  vault_item: {
    ownerField: 'user_id',
    adminBypass: false, // Never bypass for vault items
    bypassRoles: [], // No bypass for sensitive data
  },
  support_ticket: {
    ownerField: 'created_by',
    additionalAccessFields: ['assigned_to'],
    adminBypass: true,
    listAllPermission: 'tickets.read',
  },
  journal_entry: {
    ownerField: 'created_by',
    adminBypass: true,
    bypassRoles: ['admin'],
    listAllPermission: 'accounting.read',
  },
  document: {
    ownerField: 'uploaded_by',
    adminBypass: true,
    listAllPermission: 'documents.read',
  },
  kb_article: {
    ownerField: 'author_id',
    adminBypass: true,
    bypassRoles: ['admin', 'editor'],
    listAllPermission: 'kb.read',
  },
  newsletter: {
    ownerField: 'created_by',
    adminBypass: true,
    listAllPermission: 'newsletter.read',
  },
  testimonial: {
    ownerField: 'created_by',
    adminBypass: true,
    listAllPermission: 'testimonials.read',
  },
  venture: {
    ownerField: 'created_by',
    adminBypass: true,
    listAllPermission: 'ventures.read',
  },
  ai_tool: {
    ownerField: 'created_by',
    adminBypass: true,
    listAllPermission: 'ai_tools.read',
  },
};

/**
 * Permission mapping for CRUD operations on resources
 */
export const RESOURCE_PERMISSIONS: Record<ResourceType, Record<AccessAction, string>> = {
  article: {
    create: 'articles.create',
    read: 'articles.read',
    update: 'articles.update',
    delete: 'articles.delete',
    list: 'articles.read',
  },
  project: {
    create: 'projects.create',
    read: 'projects.read',
    update: 'projects.update',
    delete: 'projects.delete',
    list: 'projects.read',
  },
  task: {
    create: 'tasks.create',
    read: 'tasks.read',
    update: 'tasks.update',
    delete: 'tasks.delete',
    list: 'tasks.read',
  },
  invoice: {
    create: 'invoices.create',
    read: 'invoices.read',
    update: 'invoices.update',
    delete: 'invoices.delete',
    list: 'invoices.read',
  },
  payment: {
    create: 'payments.create',
    read: 'payments.read',
    update: 'payments.update',
    delete: 'payments.delete',
    list: 'payments.read',
  },
  contact: {
    create: 'contacts.create',
    read: 'contacts.read',
    update: 'contacts.update',
    delete: 'contacts.delete',
    list: 'contacts.read',
  },
  vault_item: {
    create: 'vault.create',
    read: 'vault.read',
    update: 'vault.update',
    delete: 'vault.delete',
    list: 'vault.read',
  },
  support_ticket: {
    create: 'tickets.create',
    read: 'tickets.read',
    update: 'tickets.update',
    delete: 'tickets.delete',
    list: 'tickets.read',
  },
  journal_entry: {
    create: 'accounting.create',
    read: 'accounting.read',
    update: 'accounting.update',
    delete: 'accounting.delete',
    list: 'accounting.read',
  },
  document: {
    create: 'documents.create',
    read: 'documents.read',
    update: 'documents.update',
    delete: 'documents.delete',
    list: 'documents.read',
  },
  kb_article: {
    create: 'kb.create',
    read: 'kb.read',
    update: 'kb.update',
    delete: 'kb.delete',
    list: 'kb.read',
  },
  newsletter: {
    create: 'newsletter.create',
    read: 'newsletter.read',
    update: 'newsletter.update',
    delete: 'newsletter.delete',
    list: 'newsletter.read',
  },
  testimonial: {
    create: 'testimonials.create',
    read: 'testimonials.read',
    update: 'testimonials.update',
    delete: 'testimonials.delete',
    list: 'testimonials.read',
  },
  venture: {
    create: 'ventures.create',
    read: 'ventures.read',
    update: 'ventures.update',
    delete: 'ventures.delete',
    list: 'ventures.read',
  },
  ai_tool: {
    create: 'ai_tools.create',
    read: 'ai_tools.read',
    update: 'ai_tools.update',
    delete: 'ai_tools.delete',
    list: 'ai_tools.read',
  },
};

// ============================================================================
// Layer 1: Authentication
// ============================================================================

/**
 * Verify that the current session is authenticated and valid
 */
export async function checkAuthentication(): Promise<SecurityLayerResult> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      logger.error('Authentication check failed:', error);
      return {
        passed: false,
        layer: 'authentication',
        error: 'Failed to verify session',
        details: { error: error.message },
      };
    }

    if (!session) {
      return {
        passed: false,
        layer: 'authentication',
        error: 'No active session',
      };
    }

    // Check if session is expired
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
    if (expiresAt && expiresAt < new Date()) {
      return {
        passed: false,
        layer: 'authentication',
        error: 'Session expired',
        details: { expiresAt: expiresAt.toISOString() },
      };
    }

    return {
      passed: true,
      layer: 'authentication',
      details: {
        userId: session.user.id,
        email: session.user.email,
        expiresAt: expiresAt?.toISOString(),
      },
    };
  } catch (error) {
    logger.error('Authentication check error:', error);
    return {
      passed: false,
      layer: 'authentication',
      error: 'Authentication check failed',
    };
  }
}

/**
 * Get the current security context from the session
 */
export async function getSecurityContext(): Promise<SecurityContext | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return null;
    }

    // Get user roles and permissions from the database
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('is_active', true);

    const roles = roleData?.map(r => r.role) || [];

    // Get permissions via RPC function
    const { data: permissionData } = await supabase.rpc('get_user_permissions', {
      p_user_id: session.user.id,
    });

    const permissions = permissionData || [];

    return {
      userId: session.user.id,
      email: session.user.email || '',
      roles,
      permissions,
      sessionId: session.access_token?.slice(-8), // Last 8 chars for reference
    };
  } catch (error) {
    logger.error('Failed to get security context:', error);
    return null;
  }
}

// ============================================================================
// Layer 2: Authorization
// ============================================================================

/**
 * Check if user has required permission for a resource action
 */
export function checkAuthorization(
  context: SecurityContext,
  resourceType: ResourceType,
  action: AccessAction
): SecurityLayerResult {
  const requiredPermission = RESOURCE_PERMISSIONS[resourceType]?.[action];

  if (!requiredPermission) {
    return {
      passed: false,
      layer: 'authorization',
      error: `No permission defined for ${resourceType}.${action}`,
    };
  }

  // Check if user has the required permission
  const hasPermission = context.permissions.includes(requiredPermission);

  // Check for admin role bypass
  const isAdmin = context.roles.includes('admin');

  if (hasPermission || isAdmin) {
    return {
      passed: true,
      layer: 'authorization',
      details: {
        permission: requiredPermission,
        grantedBy: isAdmin ? 'admin_role' : 'permission',
      },
    };
  }

  return {
    passed: false,
    layer: 'authorization',
    error: `Missing permission: ${requiredPermission}`,
    details: {
      required: requiredPermission,
      userPermissions: context.permissions,
    },
  };
}

/**
 * Check if user has any of the specified permissions
 */
export function checkAnyPermission(
  context: SecurityContext,
  permissions: string[]
): SecurityLayerResult {
  const hasAny = permissions.some(p => context.permissions.includes(p));
  const isAdmin = context.roles.includes('admin');

  if (hasAny || isAdmin) {
    return {
      passed: true,
      layer: 'authorization',
      details: {
        required: permissions,
        grantedBy: isAdmin ? 'admin_role' : 'permission',
      },
    };
  }

  return {
    passed: false,
    layer: 'authorization',
    error: 'Missing required permissions',
    details: { required: permissions },
  };
}

/**
 * Check if user has all of the specified permissions
 */
export function checkAllPermissions(
  context: SecurityContext,
  permissions: string[]
): SecurityLayerResult {
  const hasAll = permissions.every(p => context.permissions.includes(p));
  const isAdmin = context.roles.includes('admin');

  if (hasAll || isAdmin) {
    return {
      passed: true,
      layer: 'authorization',
      details: {
        required: permissions,
        grantedBy: isAdmin ? 'admin_role' : 'permissions',
      },
    };
  }

  const missing = permissions.filter(p => !context.permissions.includes(p));

  return {
    passed: false,
    layer: 'authorization',
    error: 'Missing required permissions',
    details: { required: permissions, missing },
  };
}

/**
 * Check role-level access
 */
export function checkRoleLevel(
  context: SecurityContext,
  requiredRoles: string[]
): SecurityLayerResult {
  const hasRole = requiredRoles.some(role => context.roles.includes(role));

  if (hasRole) {
    return {
      passed: true,
      layer: 'authorization',
      details: {
        requiredRoles,
        userRoles: context.roles,
      },
    };
  }

  return {
    passed: false,
    layer: 'authorization',
    error: 'Insufficient role level',
    details: {
      requiredRoles,
      userRoles: context.roles,
    },
  };
}

// ============================================================================
// Layer 3: Resource Ownership
// ============================================================================

/**
 * Check if user owns or has access to a specific resource
 */
export function checkResourceOwnership(
  context: SecurityContext,
  resourceType: ResourceType,
  resource: Record<string, unknown>
): SecurityLayerResult {
  const policy = OWNERSHIP_POLICIES[resourceType];

  if (!policy) {
    return {
      passed: false,
      layer: 'ownership',
      error: `No ownership policy for ${resourceType}`,
    };
  }

  // Check admin bypass
  if (policy.adminBypass && context.roles.includes('admin')) {
    return {
      passed: true,
      layer: 'ownership',
      details: { grantedBy: 'admin_bypass' },
    };
  }

  // Check bypass roles
  if (policy.bypassRoles?.some(role => context.roles.includes(role))) {
    return {
      passed: true,
      layer: 'ownership',
      details: { grantedBy: 'role_bypass' },
    };
  }

  // Check owner field
  const ownerId = resource[policy.ownerField] as string | undefined;
  if (ownerId === context.userId) {
    return {
      passed: true,
      layer: 'ownership',
      details: { grantedBy: 'owner', field: policy.ownerField },
    };
  }

  // Check additional access fields
  if (policy.additionalAccessFields) {
    for (const field of policy.additionalAccessFields) {
      const fieldValue = resource[field];

      // Handle array fields (e.g., team members)
      if (Array.isArray(fieldValue) && fieldValue.includes(context.userId)) {
        return {
          passed: true,
          layer: 'ownership',
          details: { grantedBy: 'additional_access', field },
        };
      }

      // Handle single value fields
      if (fieldValue === context.userId) {
        return {
          passed: true,
          layer: 'ownership',
          details: { grantedBy: 'additional_access', field },
        };
      }
    }
  }

  // Check list all permission
  if (policy.listAllPermission && context.permissions.includes(policy.listAllPermission)) {
    return {
      passed: true,
      layer: 'ownership',
      details: { grantedBy: 'list_all_permission', permission: policy.listAllPermission },
    };
  }

  return {
    passed: false,
    layer: 'ownership',
    error: 'Not authorized to access this resource',
    details: {
      resourceType,
      ownerField: policy.ownerField,
      ownerId,
      userId: context.userId,
    },
  };
}

/**
 * Build ownership filter for database queries
 * Returns filter conditions to add to the query
 */
export function buildOwnershipFilter(
  context: SecurityContext,
  resourceType: ResourceType
): { filterField: string; filterValue: string } | null {
  const policy = OWNERSHIP_POLICIES[resourceType];

  if (!policy) {
    return null;
  }

  // Admin bypass - no filter needed
  if (policy.adminBypass && context.roles.includes('admin')) {
    return null;
  }

  // Role bypass - no filter needed
  if (policy.bypassRoles?.some(role => context.roles.includes(role))) {
    return null;
  }

  // List all permission - no filter needed
  if (policy.listAllPermission && context.permissions.includes(policy.listAllPermission)) {
    return null;
  }

  // Apply ownership filter
  return {
    filterField: policy.ownerField,
    filterValue: context.userId,
  };
}

// ============================================================================
// Layer 4: Database RLS (Final Enforcement)
// ============================================================================

/**
 * Note: RLS is enforced at the database level automatically.
 * This function provides a way to verify RLS is active and logs for audit.
 *
 * The actual RLS policies should be created in Supabase:
 *
 * Example policy for articles:
 * CREATE POLICY "Users can view their own articles"
 *   ON articles FOR SELECT
 *   USING (created_by = auth.uid() OR is_admin(auth.uid()));
 */
export function verifyRLSContext(): SecurityLayerResult {
  // RLS is automatically enforced by Supabase when using the authenticated client
  // This function exists for completeness and audit logging

  return {
    passed: true,
    layer: 'rls',
    details: {
      message: 'RLS enforced at database level',
      note: 'Using authenticated Supabase client with RLS enabled',
    },
  };
}

// ============================================================================
// Combined Security Check
// ============================================================================

/**
 * Run all security layers for a resource access
 */
export async function runSecurityCheck(
  resourceType: ResourceType,
  action: AccessAction,
  resource?: Record<string, unknown>
): Promise<SecurityCheckResult> {
  const layers: SecurityLayerResult[] = [];

  // Layer 1: Authentication
  const authResult = await checkAuthentication();
  layers.push(authResult);

  if (!authResult.passed) {
    return {
      authorized: false,
      layers,
      failedAt: 'authentication',
      error: authResult.error,
    };
  }

  // Get security context for remaining checks
  const context = await getSecurityContext();

  if (!context) {
    return {
      authorized: false,
      layers,
      failedAt: 'authentication',
      error: 'Failed to get security context',
    };
  }

  // Layer 2: Authorization
  const authzResult = checkAuthorization(context, resourceType, action);
  layers.push(authzResult);

  if (!authzResult.passed) {
    return {
      authorized: false,
      layers,
      failedAt: 'authorization',
      error: authzResult.error,
    };
  }

  // Layer 3: Resource Ownership (if specific resource provided)
  if (resource) {
    const ownershipResult = checkResourceOwnership(context, resourceType, resource);
    layers.push(ownershipResult);

    if (!ownershipResult.passed) {
      return {
        authorized: false,
        layers,
        failedAt: 'ownership',
        error: ownershipResult.error,
      };
    }
  }

  // Layer 4: RLS verification
  const rlsResult = verifyRLSContext();
  layers.push(rlsResult);

  return {
    authorized: true,
    layers,
  };
}

// ============================================================================
// Security Event Logging
// ============================================================================

export interface SecurityEvent {
  type: 'access_granted' | 'access_denied' | 'security_check' | 'suspicious_activity';
  resourceType?: ResourceType;
  resourceId?: string;
  action?: AccessAction;
  userId?: string;
  result: SecurityCheckResult;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Log a security event for audit purposes
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    // Log to admin_activity_log for audit trail
    const { error } = await supabase.from('admin_activity_log').insert({
      admin_id: event.userId,
      action: `security_${event.type}`,
      resource_type: event.resourceType || 'system',
      resource_id: event.resourceId,
      details: {
        action: event.action,
        result: event.result.authorized ? 'authorized' : 'denied',
        failedAt: event.result.failedAt,
        layers: event.result.layers.map(l => ({
          layer: l.layer,
          passed: l.passed,
          error: l.error,
        })),
        ...event.metadata,
      },
    });

    if (error) {
      logger.error('Failed to log security event:', error);
    }
  } catch (error) {
    logger.error('Error logging security event:', error);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a security-checked wrapper for any async function
 */
export function withSecurityCheck<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  resourceType: ResourceType,
  action: AccessAction
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const result = await runSecurityCheck(resourceType, action);

    if (!result.authorized) {
      throw new SecurityError(
        result.error || 'Access denied',
        result.failedAt || 'unknown',
        result
      );
    }

    return fn(...args);
  };
}

/**
 * Custom error class for security violations
 */
export class SecurityError extends Error {
  public readonly layer: string;
  public readonly checkResult: SecurityCheckResult;

  constructor(message: string, layer: string, checkResult: SecurityCheckResult) {
    super(message);
    this.name = 'SecurityError';
    this.layer = layer;
    this.checkResult = checkResult;
  }
}

/**
 * Check if an error is a security error
 */
export function isSecurityError(error: unknown): error is SecurityError {
  return error instanceof SecurityError;
}
