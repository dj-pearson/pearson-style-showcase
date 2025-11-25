import { useAuth, AppRole } from '@/contexts/AuthContext';

/**
 * Hook to check if the current user has a specific permission
 * @param permission - The permission to check (e.g., 'articles.create')
 * @returns boolean indicating if user has the permission
 */
export function usePermission(permission: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

/**
 * Hook to check if the current user has any of the specified permissions
 * @param permissions - Array of permissions to check
 * @returns boolean indicating if user has any of the permissions
 */
export function useAnyPermission(permissions: string[]): boolean {
  const { hasAnyPermission } = useAuth();
  return hasAnyPermission(permissions);
}

/**
 * Hook to check if the current user has all of the specified permissions
 * @param permissions - Array of permissions to check
 * @returns boolean indicating if user has all of the permissions
 */
export function useAllPermissions(permissions: string[]): boolean {
  const { hasAllPermissions } = useAuth();
  return hasAllPermissions(permissions);
}

/**
 * Hook to check if the current user has a specific role
 * @param role - The role to check ('admin', 'editor', 'viewer')
 * @returns boolean indicating if user has the role
 */
export function useRole(role: AppRole): boolean {
  const { hasRole } = useAuth();
  return hasRole(role);
}

/**
 * Hook to get all permissions for the current user
 * @returns Array of permission strings
 */
export function usePermissions(): string[] {
  const { permissions } = useAuth();
  return permissions;
}

/**
 * Hook to get all roles for the current user
 * @returns Array of role strings
 */
export function useRoles(): AppRole[] {
  const { roles } = useAuth();
  return roles;
}

/**
 * Permission constants for type-safe permission checks
 */
export const PERMISSIONS = {
  // Content permissions
  ARTICLES_CREATE: 'articles.create',
  ARTICLES_READ: 'articles.read',
  ARTICLES_UPDATE: 'articles.update',
  ARTICLES_DELETE: 'articles.delete',
  ARTICLES_PUBLISH: 'articles.publish',
  PROJECTS_CREATE: 'projects.create',
  PROJECTS_READ: 'projects.read',
  PROJECTS_UPDATE: 'projects.update',
  PROJECTS_DELETE: 'projects.delete',
  AI_TOOLS_CREATE: 'ai_tools.create',
  AI_TOOLS_READ: 'ai_tools.read',
  AI_TOOLS_UPDATE: 'ai_tools.update',
  AI_TOOLS_DELETE: 'ai_tools.delete',
  CATEGORIES_MANAGE: 'categories.manage',
  // User management permissions
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  ROLES_READ: 'roles.read',
  ROLES_ASSIGN: 'roles.assign',
  ROLES_REVOKE: 'roles.revoke',
  WHITELIST_READ: 'whitelist.read',
  WHITELIST_MANAGE: 'whitelist.manage',
  // System permissions
  SETTINGS_READ: 'settings.read',
  SETTINGS_UPDATE: 'settings.update',
  SMTP_MANAGE: 'smtp.manage',
  NEWSLETTER_READ: 'newsletter.read',
  NEWSLETTER_MANAGE: 'newsletter.manage',
  ALERTS_MANAGE: 'alerts.manage',
  // Analytics permissions
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_EXPORT: 'analytics.export',
  ACTIVITY_LOG_VIEW: 'activity_log.view',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
