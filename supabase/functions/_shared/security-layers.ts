/**
 * Security Layers for Edge Functions
 *
 * Defense-in-depth security for Supabase Edge Functions:
 *
 * Layer 1: Authentication - Verify JWT token
 * Layer 2: Authorization - Check permissions and roles
 * Layer 3: Resource Ownership - Verify access to specific resources
 * Layer 4: Database RLS - Final enforcement at database level
 *
 * Usage:
 * ```typescript
 * import { verifyAuth, checkPermission, requireAuth } from '../_shared/security-layers.ts';
 *
 * // Simple auth check
 * const authResult = await verifyAuth(req);
 * if (!authResult.authenticated) {
 *   return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
 * }
 *
 * // Permission check
 * const permResult = await checkPermission(authResult.userId, 'articles.create');
 * if (!permResult.authorized) {
 *   return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
 * }
 *
 * // Or use the middleware wrapper
 * const handler = requireAuth(async (req, user) => {
 *   // user is guaranteed to be authenticated here
 *   return new Response(JSON.stringify({ user }));
 * }, { requiredPermission: 'articles.create' });
 * ```
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

// ============================================================================
// Types
// ============================================================================

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  error?: string;
  token?: string;
}

export interface PermissionResult {
  authorized: boolean;
  reason?: string;
  grantedBy?: string;
}

export interface OwnershipResult {
  isOwner: boolean;
  reason?: string;
}

export interface SecurityContext {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
  token: string;
}

export interface RequireAuthOptions {
  /** Required permission to access */
  requiredPermission?: string;
  /** Required role(s) */
  requiredRoles?: string[];
  /** Whether admin role bypasses all checks */
  adminBypass?: boolean;
  /** Log security events */
  logEvents?: boolean;
}

// ============================================================================
// Environment Setup
// ============================================================================

// These should be set in your edge function environment
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

/**
 * Get a Supabase admin client (bypasses RLS)
 */
export function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get a Supabase client with user context (respects RLS)
 */
export function getUserClient(accessToken: string) {
  return createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================================================
// Layer 1: Authentication
// ============================================================================

/**
 * Extract and verify JWT token from request
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  try {
    // Get Authorization header
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return {
        authenticated: false,
        error: 'No authorization header',
      };
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return {
        authenticated: false,
        error: 'No token provided',
      };
    }

    // Verify token with Supabase
    const adminClient = getAdminClient();
    const { data: { user }, error } = await adminClient.auth.getUser(token);

    if (error || !user) {
      return {
        authenticated: false,
        error: error?.message || 'Invalid token',
      };
    }

    // Get user roles
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const roles = roleData?.map(r => r.role) || [];

    // Get user permissions via RPC
    const { data: permissionData } = await adminClient.rpc('get_user_permissions', {
      p_user_id: user.id,
    });

    const permissions = permissionData || [];

    return {
      authenticated: true,
      userId: user.id,
      email: user.email,
      roles,
      permissions,
      token,
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return {
      authenticated: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Check if user is in admin whitelist
 */
export async function checkAdminWhitelist(email: string): Promise<boolean> {
  try {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('admin_whitelist')
      .select('email')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

// ============================================================================
// Layer 2: Authorization
// ============================================================================

/**
 * Check if user has a specific permission
 */
export async function checkPermission(
  userId: string,
  requiredPermission: string
): Promise<PermissionResult> {
  try {
    const adminClient = getAdminClient();

    // Get user permissions
    const { data: permissions } = await adminClient.rpc('get_user_permissions', {
      p_user_id: userId,
    });

    // Check for wildcard (admin)
    if (permissions?.includes('*')) {
      return {
        authorized: true,
        grantedBy: 'admin_wildcard',
      };
    }

    // Check for exact match
    if (permissions?.includes(requiredPermission)) {
      return {
        authorized: true,
        grantedBy: `permission:${requiredPermission}`,
      };
    }

    // Check for resource wildcard (e.g., articles.*)
    const [resource] = requiredPermission.split('.');
    if (permissions?.includes(`${resource}.*`)) {
      return {
        authorized: true,
        grantedBy: `permission:${resource}.*`,
      };
    }

    return {
      authorized: false,
      reason: `Missing permission: ${requiredPermission}`,
    };
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      authorized: false,
      reason: 'Permission check failed',
    };
  }
}

/**
 * Check if user has any of the specified roles
 */
export async function checkRoles(
  userId: string,
  requiredRoles: string[]
): Promise<PermissionResult> {
  try {
    const adminClient = getAdminClient();

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true);

    const userRoles = roleData?.map(r => r.role) || [];

    const hasRole = requiredRoles.some(role => userRoles.includes(role));

    if (hasRole) {
      return {
        authorized: true,
        grantedBy: `role:${userRoles.filter(r => requiredRoles.includes(r)).join(',')}`,
      };
    }

    return {
      authorized: false,
      reason: `Missing required role(s): ${requiredRoles.join(', ')}`,
    };
  } catch (error) {
    console.error('Role check error:', error);
    return {
      authorized: false,
      reason: 'Role check failed',
    };
  }
}

// ============================================================================
// Layer 3: Resource Ownership
// ============================================================================

/**
 * Check if user owns a specific resource
 */
export async function checkOwnership(
  userId: string,
  table: string,
  resourceId: string,
  ownerField: string = 'created_by'
): Promise<OwnershipResult> {
  try {
    const adminClient = getAdminClient();

    const { data, error } = await adminClient
      .from(table)
      .select(ownerField)
      .eq('id', resourceId)
      .single();

    if (error || !data) {
      return {
        isOwner: false,
        reason: 'Resource not found',
      };
    }

    const ownerId = data[ownerField];

    if (ownerId === userId) {
      return {
        isOwner: true,
      };
    }

    return {
      isOwner: false,
      reason: 'Not the owner of this resource',
    };
  } catch (error) {
    console.error('Ownership check error:', error);
    return {
      isOwner: false,
      reason: 'Ownership check failed',
    };
  }
}

// ============================================================================
// Security Event Logging
// ============================================================================

/**
 * Log a security event
 */
export async function logSecurityEvent(
  event: {
    type: 'auth_success' | 'auth_failure' | 'access_granted' | 'access_denied' | 'suspicious_activity';
    userId?: string;
    email?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  try {
    const adminClient = getAdminClient();

    await adminClient.from('security_events').insert({
      event_type: event.type,
      user_id: event.userId,
      email: event.email,
      action: event.action,
      resource_type: event.resource,
      resource_id: event.resourceId,
      details: event.details,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Don't throw - logging should not break the request
    console.error('Failed to log security event:', error);
  }
}

// ============================================================================
// Middleware Wrappers
// ============================================================================

type AuthenticatedHandler = (
  req: Request,
  user: SecurityContext
) => Promise<Response>;

/**
 * Middleware wrapper that requires authentication
 */
export function requireAuth(
  handler: AuthenticatedHandler,
  options: RequireAuthOptions = {}
): (req: Request) => Promise<Response> {
  const {
    requiredPermission,
    requiredRoles,
    adminBypass = true,
    logEvents = true,
  } = options;

  return async (req: Request): Promise<Response> => {
    // Get client IP and user agent for logging
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      req.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Layer 1: Authentication
    const authResult = await verifyAuth(req);

    if (!authResult.authenticated) {
      if (logEvents) {
        await logSecurityEvent({
          type: 'auth_failure',
          email: authResult.email,
          action: req.method,
          resource: new URL(req.url).pathname,
          details: { error: authResult.error },
          ipAddress,
          userAgent,
        });
      }

      return new Response(
        JSON.stringify({ error: authResult.error || 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = authResult.roles?.includes('admin') || false;

    // Layer 2: Authorization - Permission check
    if (requiredPermission && !(adminBypass && isAdmin)) {
      const permResult = await checkPermission(authResult.userId!, requiredPermission);

      if (!permResult.authorized) {
        if (logEvents) {
          await logSecurityEvent({
            type: 'access_denied',
            userId: authResult.userId,
            email: authResult.email,
            action: req.method,
            resource: new URL(req.url).pathname,
            details: { reason: permResult.reason, requiredPermission },
            ipAddress,
            userAgent,
          });
        }

        return new Response(
          JSON.stringify({ error: permResult.reason || 'Forbidden' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Layer 2: Authorization - Role check
    if (requiredRoles && requiredRoles.length > 0 && !(adminBypass && isAdmin)) {
      const roleResult = await checkRoles(authResult.userId!, requiredRoles);

      if (!roleResult.authorized) {
        if (logEvents) {
          await logSecurityEvent({
            type: 'access_denied',
            userId: authResult.userId,
            email: authResult.email,
            action: req.method,
            resource: new URL(req.url).pathname,
            details: { reason: roleResult.reason, requiredRoles },
            ipAddress,
            userAgent,
          });
        }

        return new Response(
          JSON.stringify({ error: roleResult.reason || 'Forbidden' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build security context
    const securityContext: SecurityContext = {
      userId: authResult.userId!,
      email: authResult.email!,
      roles: authResult.roles || [],
      permissions: authResult.permissions || [],
      isAdmin,
      token: authResult.token!,
    };

    // Log successful access
    if (logEvents) {
      await logSecurityEvent({
        type: 'access_granted',
        userId: authResult.userId,
        email: authResult.email,
        action: req.method,
        resource: new URL(req.url).pathname,
        ipAddress,
        userAgent,
      });
    }

    // Call the handler with authenticated user
    return handler(req, securityContext);
  };
}

/**
 * Middleware wrapper for resource-specific operations
 */
export function requireResourceAccess(
  handler: AuthenticatedHandler,
  options: RequireAuthOptions & {
    table: string;
    ownerField?: string;
    getResourceId: (req: Request) => string | null;
  }
): (req: Request) => Promise<Response> {
  return requireAuth(async (req, user) => {
    const resourceId = options.getResourceId(req);

    if (!resourceId) {
      return new Response(
        JSON.stringify({ error: 'Resource ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Layer 3: Ownership check (unless admin)
    if (!user.isAdmin) {
      const ownershipResult = await checkOwnership(
        user.userId,
        options.table,
        resourceId,
        options.ownerField
      );

      if (!ownershipResult.isOwner) {
        await logSecurityEvent({
          type: 'access_denied',
          userId: user.userId,
          action: req.method,
          resource: options.table,
          resourceId,
          details: { reason: ownershipResult.reason },
        });

        return new Response(
          JSON.stringify({ error: ownershipResult.reason || 'Forbidden' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return handler(req, user);
  }, options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create CORS headers for responses
 */
export function corsHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = [
    'https://danpearson.net',
    'https://www.danpearson.net',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://127.0.0.1:8080',
  ];

  const requestOrigin = origin || '';
  const allowOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight request
 */
export function handleCorsOptions(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin') || undefined),
  });
}
