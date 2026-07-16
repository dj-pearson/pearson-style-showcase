/**
 * Authorization Enforcement Middleware
 *
 * Layer 2 of the security architecture - Authorization checks
 *
 * This module provides:
 * - Permission-based access control
 * - Role hierarchy checks
 * - Granular permission patterns (resource.action, resource.action_own)
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export type PermissionScope = 'all' | 'own' | 'assigned';

export interface Permission {
  resource: string;
  action: string;
  scope?: PermissionScope;
}

export interface RoleDefinition {
  name: string;
  level: number;
  permissions: string[];
  inherits?: string[];
}

// ============================================================================
// Role Hierarchy
// ============================================================================

/**
 * Role hierarchy with levels (higher = more access)
 */
export const ROLE_HIERARCHY: Record<string, RoleDefinition> = {
  viewer: {
    name: 'viewer',
    level: 1,
    permissions: ['articles.read', 'projects.read', 'analytics.view'],
  },
  editor: {
    name: 'editor',
    level: 5,
    permissions: [
      'articles.create',
      'articles.read',
      'articles.update',
      'articles.delete',
      'articles.publish',
      'projects.read',
      'projects.update',
      'ai_tools.read',
      'ai_tools.create',
      'categories.manage',
      'newsletter.read',
    ],
    inherits: ['viewer'],
  },
  admin: {
    name: 'admin',
    level: 10,
    permissions: [
      '*', // Wildcard - all permissions
    ],
    inherits: ['editor'],
  },
};

// ============================================================================
// Permission Patterns
// ============================================================================

/**
 * Permission patterns for fine-grained access control
 *
 * Format: resource.action or resource.action_scope
 * Examples:
 *   - articles.read (can read all articles)
 *   - articles.read_own (can only read own articles)
 *   - tasks.update_assigned (can update assigned tasks)
 */

export function parsePermission(permission: string): Permission {
  const parts = permission.split('.');

  if (parts.length !== 2) {
    return { resource: permission, action: '*' };
  }

  const [resource, actionPart] = parts;

  // Check for scope suffix
  const scopePatterns: { suffix: string; scope: PermissionScope }[] = [
    { suffix: '_own', scope: 'own' },
    { suffix: '_assigned', scope: 'assigned' },
  ];

  for (const pattern of scopePatterns) {
    if (actionPart.endsWith(pattern.suffix)) {
      return {
        resource,
        action: actionPart.slice(0, -pattern.suffix.length),
        scope: pattern.scope,
      };
    }
  }

  return {
    resource,
    action: actionPart,
    scope: 'all',
  };
}

/**
 * Check if a permission matches a required permission
 * Supports wildcard matching
 */
export function permissionMatches(userPermission: string, requiredPermission: string): boolean {
  // Exact match
  if (userPermission === requiredPermission) return true;

  // Wildcard match
  if (userPermission === '*') return true;

  // Parse permissions
  const userParsed = parsePermission(userPermission);
  const requiredParsed = parsePermission(requiredPermission);

  // Resource wildcard (admin.*)
  if (userParsed.action === '*' && userParsed.resource === requiredParsed.resource) {
    return true;
  }

  // Resource match with scope upgrade (own -> all is upgrade, not allowed)
  if (
    userParsed.resource === requiredParsed.resource &&
    userParsed.action === requiredParsed.action
  ) {
    // If user has 'all' scope, they can do 'own' or 'assigned'
    if (userParsed.scope === 'all') return true;

    // If scopes match exactly
    if (userParsed.scope === requiredParsed.scope) return true;
  }

  return false;
}

// ============================================================================
// Authorization Checks
// ============================================================================

/**
 * Get all effective permissions for a role (including inherited)
 */
export function getEffectivePermissions(roleName: string): string[] {
  const role = ROLE_HIERARCHY[roleName];
  if (!role) return [];

  const permissions = new Set<string>(role.permissions);

  // Add inherited permissions
  if (role.inherits) {
    for (const inheritedRole of role.inherits) {
      const inheritedPerms = getEffectivePermissions(inheritedRole);
      inheritedPerms.forEach((p) => permissions.add(p));
    }
  }

  return Array.from(permissions);
}

/**
 * Check if roles grant a specific permission
 */
export function rolesGrantPermission(
  roles: string[],
  requiredPermission: string
): { granted: boolean; grantedBy?: string } {
  for (const roleName of roles) {
    const effectivePerms = getEffectivePermissions(roleName);

    for (const perm of effectivePerms) {
      if (permissionMatches(perm, requiredPermission)) {
        return { granted: true, grantedBy: `role:${roleName}` };
      }
    }
  }

  return { granted: false };
}

/**
 * Check if user meets role level requirement
 */
export function meetsRoleLevel(userRoles: string[], requiredLevel: number): boolean {
  for (const roleName of userRoles) {
    const role = ROLE_HIERARCHY[roleName];
    if (role && role.level >= requiredLevel) {
      return true;
    }
  }
  return false;
}

/**
 * Get the highest role level from a list of roles
 */
export function getHighestRoleLevel(roles: string[]): number {
  let highest = 0;

  for (const roleName of roles) {
    const role = ROLE_HIERARCHY[roleName];
    if (role && role.level > highest) {
      highest = role.level;
    }
  }

  return highest;
}

// ============================================================================
// Permission Enforcement
// ============================================================================

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  scope?: PermissionScope;
  grantedBy?: string;
}

/**
 * Check authorization for a permission
 */
export function checkPermission(
  userPermissions: string[],
  userRoles: string[],
  requiredPermission: string
): AuthorizationResult {
  // Check direct permissions first
  for (const perm of userPermissions) {
    if (permissionMatches(perm, requiredPermission)) {
      const parsed = parsePermission(perm);
      return {
        authorized: true,
        scope: parsed.scope,
        grantedBy: `permission:${perm}`,
      };
    }
  }

  // Check role-based permissions
  const roleCheck = rolesGrantPermission(userRoles, requiredPermission);
  if (roleCheck.granted) {
    return {
      authorized: true,
      scope: 'all',
      grantedBy: roleCheck.grantedBy,
    };
  }

  return {
    authorized: false,
    reason: `Missing permission: ${requiredPermission}`,
  };
}

/**
 * Check authorization with scope enforcement
 */
export function checkPermissionWithScope(
  userPermissions: string[],
  userRoles: string[],
  requiredPermission: string,
  resourceOwner: string | null,
  currentUserId: string
): AuthorizationResult {
  const result = checkPermission(userPermissions, userRoles, requiredPermission);

  if (!result.authorized) {
    return result;
  }

  // If scope is 'all', no additional checks needed
  if (result.scope === 'all') {
    return result;
  }

  // Check 'own' scope
  if (result.scope === 'own') {
    if (resourceOwner === currentUserId) {
      return result;
    }
    return {
      authorized: false,
      reason: 'You can only access your own resources',
    };
  }

  // 'assigned' scope would require additional data (assigned_to field)
  // This would need to be checked at the resource level

  return result;
}

// ============================================================================
// Authorization Guard Functions
// ============================================================================

/**
 * Create an authorization guard that throws on failure
 */
export function createAuthorizationGuard(
  userPermissions: string[],
  userRoles: string[]
): (permission: string) => void {
  return (permission: string) => {
    const result = checkPermission(userPermissions, userRoles, permission);
    if (!result.authorized) {
      throw new AuthorizationError(result.reason || 'Unauthorized', permission);
    }
  };
}

/**
 * Authorization error class
 */
export class AuthorizationError extends Error {
  public readonly permission: string;

  constructor(message: string, permission: string) {
    super(message);
    this.name = 'AuthorizationError';
    this.permission = permission;
  }
}

/**
 * Check if an error is an authorization error
 */
export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

// ============================================================================
// Database Permission Sync
// ============================================================================

/**
 * Sync user permissions from the database
 */
export async function syncUserPermissions(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_permissions', {
      p_user_id: userId,
    });

    if (error) {
      logger.error('Failed to sync permissions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Error syncing permissions:', error);
    return [];
  }
}

/**
 * Sync user roles from the database
 */
export async function syncUserRoles(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to sync roles:', error);
      return [];
    }

    return data?.map((r) => r.role) || [];
  } catch (error) {
    logger.error('Error syncing roles:', error);
    return [];
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type for permission strings with autocomplete
 */
export type StandardPermission =
  | 'articles.create'
  | 'articles.read'
  | 'articles.update'
  | 'articles.delete'
  | 'articles.publish'
  | 'articles.read_own'
  | 'articles.update_own'
  | 'articles.delete_own'
  | 'projects.create'
  | 'projects.read'
  | 'projects.update'
  | 'projects.delete'
  | 'tasks.create'
  | 'tasks.read'
  | 'tasks.update'
  | 'tasks.delete'
  | 'tasks.read_assigned'
  | 'tasks.update_assigned'
  | 'invoices.create'
  | 'invoices.read'
  | 'invoices.update'
  | 'invoices.delete'
  | 'payments.create'
  | 'payments.read'
  | 'payments.update'
  | 'payments.delete'
  | 'accounting.read'
  | 'accounting.create'
  | 'accounting.update'
  | 'accounting.delete'
  | 'vault.read'
  | 'vault.create'
  | 'vault.update'
  | 'vault.delete'
  | 'tickets.read'
  | 'tickets.create'
  | 'tickets.update'
  | 'tickets.delete'
  | 'tickets.assign'
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'roles.read'
  | 'roles.assign'
  | 'roles.revoke'
  | 'settings.read'
  | 'settings.update'
  | 'analytics.view'
  | 'analytics.export'
  | 'activity_log.view'
  | 'whitelist.read'
  | 'whitelist.manage'
  | '*';
