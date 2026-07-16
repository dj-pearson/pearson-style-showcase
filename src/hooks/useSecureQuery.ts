/**
 * useSecureQuery - Security-Enhanced Data Fetching Hook
 *
 * This hook wraps TanStack Query with security layers:
 *
 * Layer 1: Authentication - Verifies valid session before fetching
 * Layer 2: Authorization - Checks permissions before query execution
 * Layer 3: Ownership - Applies ownership filters to queries
 * Layer 4: RLS - Database enforces final access control
 *
 * Usage:
 * ```tsx
 * const { data, isLoading, error, securityStatus } = useSecureQuery({
 *   queryKey: ['articles'],
 *   resourceType: 'article',
 *   action: 'list',
 *   queryFn: async (ownershipFilter) => {
 *     let query = supabase.from('articles').select('*');
 *     if (ownershipFilter) {
 *       query = query.eq(ownershipFilter.field, ownershipFilter.value);
 *     }
 *     return query;
 *   },
 * });
 * ```
 */

import { useCallback, useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryKey,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
  runSecurityCheck,
  logSecurityEvent,
  type ResourceType,
  type AccessAction,
  type SecurityCheckResult,
} from '@/lib/security-layers';
import { useResourceOwnership } from './useResourceOwnership';

// ============================================================================
// Types
// ============================================================================

export interface OwnershipFilter {
  field: string;
  value: string;
}

export interface SecureQueryOptions<TData, TError = Error> {
  /** Query key for caching */
  queryKey: QueryKey;
  /** Resource type for security checks */
  resourceType: ResourceType;
  /** Action being performed */
  action?: AccessAction;
  /** Query function that receives ownership filter */
  queryFn: (ownershipFilter: OwnershipFilter | null) => Promise<TData>;
  /** Additional query options */
  queryOptions?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>;
  /** Whether to apply ownership filtering */
  applyOwnershipFilter?: boolean;
  /** Log security events */
  logEvents?: boolean;
  /** Enabled flag */
  enabled?: boolean;
}

export interface SecureQueryResult<TData, TError = Error> {
  data: TData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: TError | null;
  refetch: () => void;
  securityStatus: {
    isChecking: boolean;
    isAuthorized: boolean;
    checkResult: SecurityCheckResult | null;
    ownershipFilter: OwnershipFilter | null;
  };
}

export interface SecureMutationOptions<TData, TVariables, TError = Error> {
  /** Resource type for security checks */
  resourceType: ResourceType;
  /** Action being performed */
  action: AccessAction;
  /** Mutation function */
  mutationFn: (
    variables: TVariables,
    securityContext: { userId: string; ownerField: string }
  ) => Promise<TData>;
  /** Additional mutation options */
  mutationOptions?: Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn'>;
  /** Log security events */
  logEvents?: boolean;
  /** Query keys to invalidate on success */
  invalidateQueryKeys?: QueryKey[];
}

// ============================================================================
// useSecureQuery Hook
// ============================================================================

export function useSecureQuery<TData, TError = Error>(
  options: SecureQueryOptions<TData, TError>
): SecureQueryResult<TData, TError> {
  const {
    queryKey,
    resourceType,
    action = 'list',
    queryFn,
    queryOptions,
    applyOwnershipFilter = true,
    logEvents = true,
    enabled = true,
  } = options;

  const { isAuthenticated, isAdminVerified, adminUser } = useAuth();
  const {
    getOwnershipFilter,
    hasAdminBypass,
    hasRoleBypass,
  } = useResourceOwnership({ resourceType, autoFilter: applyOwnershipFilter });

  // Get ownership filter
  const ownershipFilter = useMemo(() => {
    if (!applyOwnershipFilter || hasAdminBypass || hasRoleBypass) {
      return null;
    }
    return getOwnershipFilter();
  }, [applyOwnershipFilter, hasAdminBypass, hasRoleBypass, getOwnershipFilter]);

  // Check if query should be enabled
  const isSecurityReady = isAuthenticated && isAdminVerified;

  // Build the secure query function
  const secureQueryFn = useCallback(async (): Promise<TData> => {
    // Run security check
    const securityResult = await runSecurityCheck(resourceType, action);

    if (!securityResult.authorized) {
      // Log denied access
      if (logEvents && adminUser?.id) {
        await logSecurityEvent({
          type: 'access_denied',
          resourceType,
          action,
          userId: adminUser.id,
          result: securityResult,
          timestamp: new Date(),
        });
      }

      throw new Error(securityResult.error || 'Access denied');
    }

    // Log access
    if (logEvents && adminUser?.id) {
      await logSecurityEvent({
        type: 'access_granted',
        resourceType,
        action,
        userId: adminUser.id,
        result: securityResult,
        timestamp: new Date(),
      });
    }

    // Execute the query with ownership filter
    return queryFn(ownershipFilter);
  }, [resourceType, action, queryFn, ownershipFilter, logEvents, adminUser?.id]);

  // Use TanStack Query
  const query = useQuery<TData, TError>({
    queryKey: [...queryKey, ownershipFilter],
    queryFn: secureQueryFn,
    enabled: enabled && isSecurityReady,
    ...queryOptions,
  });

  return {
    data: query.data,
    isLoading: query.isLoading || !isSecurityReady,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    securityStatus: {
      isChecking: !isSecurityReady,
      isAuthorized: isSecurityReady,
      checkResult: null, // Would need async state to populate
      ownershipFilter,
    },
  };
}

// ============================================================================
// useSecureMutation Hook
// ============================================================================

export function useSecureMutation<TData, TVariables, TError = Error>(
  options: SecureMutationOptions<TData, TVariables, TError>
) {
  const {
    resourceType,
    action,
    mutationFn,
    mutationOptions,
    logEvents = true,
    invalidateQueryKeys = [],
  } = options;

  const { adminUser } = useAuth();
  const queryClient = useQueryClient();
  const { userId, ownerField, withOwnership } = useResourceOwnership({ resourceType });

  // Build the secure mutation function
  const secureMutationFn = useCallback(
    async (variables: TVariables): Promise<TData> => {
      // Run security check
      const securityResult = await runSecurityCheck(resourceType, action);

      if (!securityResult.authorized) {
        // Log denied access
        if (logEvents && adminUser?.id) {
          await logSecurityEvent({
            type: 'access_denied',
            resourceType,
            action,
            userId: adminUser.id,
            result: securityResult,
            timestamp: new Date(),
          });
        }

        throw new Error(securityResult.error || 'Access denied');
      }

      // Execute the mutation with security context
      const result = await mutationFn(variables, {
        userId: userId || '',
        ownerField,
      });

      // Log success
      if (logEvents && adminUser?.id) {
        await logSecurityEvent({
          type: 'access_granted',
          resourceType,
          action,
          userId: adminUser.id,
          result: securityResult,
          timestamp: new Date(),
        });
      }

      return result;
    },
    [resourceType, action, mutationFn, userId, ownerField, logEvents, adminUser?.id]
  );

  const mutation = useMutation<TData, TError, TVariables>({
    mutationFn: secureMutationFn,
    onSuccess: () => {
      // Invalidate related queries
      for (const key of invalidateQueryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    ...mutationOptions,
  });

  return {
    ...mutation,
    withOwnership,
  };
}

// ============================================================================
// useSecureSupabaseQuery Hook
// ============================================================================

/**
 * Convenience hook for Supabase queries with security
 */
export function useSecureSupabaseQuery<TData>(options: {
  queryKey: QueryKey;
  resourceType: ResourceType;
  table: string;
  select?: string;
  filters?: Record<string, unknown>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  enabled?: boolean;
}) {
  const {
    queryKey,
    resourceType,
    table,
    select = '*',
    filters = {},
    orderBy,
    limit,
    enabled = true,
  } = options;

  return useSecureQuery<TData[]>({
    queryKey,
    resourceType,
    action: 'list',
    enabled,
    queryFn: async (ownershipFilter) => {
      let query = supabase.from(table).select(select);

      // Apply ownership filter
      if (ownershipFilter) {
        query = query.eq(ownershipFilter.field, ownershipFilter.value);
      }

      // Apply additional filters
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }

      // Apply ordering
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        logger.error(`Failed to fetch ${table}:`, error);
        throw error;
      }

      return (data || []) as TData[];
    },
  });
}

// ============================================================================
// useSecureResourceMutation Hook
// ============================================================================

/**
 * Convenience hook for Supabase mutations with security
 */
export function useSecureResourceMutation<TData extends Record<string, unknown>>(options: {
  resourceType: ResourceType;
  table: string;
  action: 'create' | 'update' | 'delete';
  invalidateQueryKeys?: QueryKey[];
}) {
  const { resourceType, table, action, invalidateQueryKeys = [] } = options;

  return useSecureMutation<TData, Partial<TData> & { id?: string }>({
    resourceType,
    action,
    invalidateQueryKeys: [[table], ...invalidateQueryKeys],
    mutationFn: async (variables, { userId, ownerField }) => {
      let result: { data: TData | null; error: Error | null };

      if (action === 'create') {
        // Add ownership field for new resources
        const dataWithOwner = {
          ...variables,
          [ownerField]: userId,
        };

        result = await supabase
          .from(table)
          .insert(dataWithOwner)
          .select()
          .single();
      } else if (action === 'update') {
        const { id, ...updateData } = variables;
        if (!id) throw new Error('ID required for update');

        result = await supabase
          .from(table)
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
      } else if (action === 'delete') {
        const { id } = variables;
        if (!id) throw new Error('ID required for delete');

        // First get the record to return it
        const { data: existing } = await supabase
          .from(table)
          .select()
          .eq('id', id)
          .single();

        await supabase.from(table).delete().eq('id', id);

        return existing as TData;
      } else {
        throw new Error(`Unknown action: ${action}`);
      }

      if (result.error) {
        throw result.error;
      }

      return result.data as TData;
    },
  });
}

// ============================================================================
// Exports
// ============================================================================

export default useSecureQuery;
