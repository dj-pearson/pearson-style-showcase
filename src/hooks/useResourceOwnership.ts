/**
 * useResourceOwnership Hook
 *
 * Layer 3 of the security architecture - Resource Ownership verification
 *
 * This hook provides:
 * - Ownership checking for specific resources
 * - Filter generation for queries
 * - Ownership enforcement for mutations
 */

import { useCallback, useMemo } from 'react';
import { useAuth, type AppRole } from '@/contexts/AuthContext';
import {
  ResourceType,
  AccessAction,
  OWNERSHIP_POLICIES,
  RESOURCE_PERMISSIONS,
  checkResourceOwnership,
  buildOwnershipFilter,
  type SecurityContext,
} from '@/lib/security-layers';

export interface UseResourceOwnershipOptions {
  /** The type of resource being accessed */
  resourceType: ResourceType;
  /** Whether to apply ownership filters automatically */
  autoFilter?: boolean;
}

export interface UseResourceOwnershipResult {
  /** Check if user can access a specific resource */
  canAccess: (resource: Record<string, unknown>, action?: AccessAction) => boolean;
  /** Check if user owns a specific resource */
  isOwner: (resource: Record<string, unknown>) => boolean;
  /** Get filter conditions for ownership-scoped queries */
  getOwnershipFilter: () => { field: string; value: string } | null;
  /** Check if ownership filter should be applied */
  shouldFilter: boolean;
  /** The current user's ID */
  userId: string | null;
  /** Whether the user has admin bypass */
  hasAdminBypass: boolean;
  /** Whether the user has role bypass */
  hasRoleBypass: boolean;
  /** Get the owner field name for this resource type */
  ownerField: string;
  /** Add ownership metadata to a new resource */
  withOwnership: <T extends Record<string, unknown>>(data: T) => T & { [key: string]: string };
}

/**
 * Hook for resource ownership verification
 */
export function useResourceOwnership(
  options: UseResourceOwnershipOptions
): UseResourceOwnershipResult {
  const { resourceType, autoFilter = true } = options;
  const {
    adminUser,
    roles,
    permissions,
    isAdminVerified,
  } = useAuth();

  const userId = adminUser?.id || null;
  const policy = OWNERSHIP_POLICIES[resourceType];

  // Build security context from auth state
  const securityContext: SecurityContext | null = useMemo(() => {
    if (!userId || !adminUser?.email) return null;

    return {
      userId,
      email: adminUser.email,
      roles,
      permissions,
    };
  }, [userId, adminUser?.email, roles, permissions]);

  // Check if user has admin bypass
  const hasAdminBypass = useMemo(() => {
    if (!policy || !isAdminVerified) return false;
    return policy.adminBypass === true && roles.includes('admin');
  }, [policy, isAdminVerified, roles]);

  // Check if user has role bypass
  const hasRoleBypass = useMemo(() => {
    if (!policy || !isAdminVerified) return false;
    // bypassRoles are declared as string[] but only ever contain valid AppRole values
    return policy.bypassRoles?.some(role => roles.includes(role as AppRole)) || false;
  }, [policy, isAdminVerified, roles]);

  // Whether ownership filter should be applied
  const shouldFilter = useMemo(() => {
    if (!autoFilter || !policy) return false;
    if (hasAdminBypass || hasRoleBypass) return false;
    if (policy.listAllPermission && permissions.includes(policy.listAllPermission)) return false;
    return true;
  }, [autoFilter, policy, hasAdminBypass, hasRoleBypass, permissions]);

  // Check if user can access a specific resource
  const canAccess = useCallback(
    (resource: Record<string, unknown>, action: AccessAction = 'read'): boolean => {
      if (!securityContext || !policy) return false;

      // Check permission first
      const requiredPermission = RESOURCE_PERMISSIONS[resourceType]?.[action];
      if (requiredPermission && !permissions.includes(requiredPermission)) {
        // Check admin role as fallback
        if (!roles.includes('admin')) {
          return false;
        }
      }

      // Check ownership
      const result = checkResourceOwnership(securityContext, resourceType, resource);
      return result.passed;
    },
    [securityContext, policy, resourceType, permissions, roles]
  );

  // Check if user is the owner of a resource
  const isOwner = useCallback(
    (resource: Record<string, unknown>): boolean => {
      if (!userId || !policy) return false;
      const ownerId = resource[policy.ownerField];
      return ownerId === userId;
    },
    [userId, policy]
  );

  // Get ownership filter for queries
  const getOwnershipFilter = useCallback((): { field: string; value: string } | null => {
    if (!securityContext || !shouldFilter) return null;

    const filter = buildOwnershipFilter(securityContext, resourceType);
    if (!filter) return null;

    return {
      field: filter.filterField,
      value: filter.filterValue,
    };
  }, [securityContext, resourceType, shouldFilter]);

  // Add ownership metadata to new resources
  const withOwnership = useCallback(
    <T extends Record<string, unknown>>(data: T): T & { [key: string]: string } => {
      if (!userId || !policy) return data as T & { [key: string]: string };

      return {
        ...data,
        [policy.ownerField]: userId,
      };
    },
    [userId, policy]
  );

  return {
    canAccess,
    isOwner,
    getOwnershipFilter,
    shouldFilter,
    userId,
    hasAdminBypass,
    hasRoleBypass,
    ownerField: policy?.ownerField || 'created_by',
    withOwnership,
  };
}

/**
 * Hook to check if user can perform an action on a resource type
 */
export function useCanPerformAction(
  resourceType: ResourceType,
  action: AccessAction
): boolean {
  const { permissions, roles } = useAuth();

  return useMemo(() => {
    const requiredPermission = RESOURCE_PERMISSIONS[resourceType]?.[action];

    if (!requiredPermission) return false;

    // Check direct permission
    if (permissions.includes(requiredPermission)) return true;

    // Check admin role
    if (roles.includes('admin')) return true;

    return false;
  }, [resourceType, action, permissions, roles]);
}

/**
 * Hook to get all accessible resources with ownership filtering
 */
export function useOwnedResources<T extends Record<string, unknown>>(
  resources: T[],
  resourceType: ResourceType
): T[] {
  const { canAccess } = useResourceOwnership({ resourceType });

  return useMemo(() => {
    return resources.filter(resource => canAccess(resource, 'read'));
  }, [resources, canAccess]);
}

export default useResourceOwnership;
