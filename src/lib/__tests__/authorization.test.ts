import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted Supabase mock: rpc() for permissions, a thenable builder for from().
const h = vi.hoisted(() => {
  const state: { fromResult: { data: unknown; error: unknown } } = {
    fromResult: { data: [], error: null },
  };
  const rpc = vi.fn();
  const makeBuilder = () => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq']) {
      b[m] = () => b;
    }
    (b as { then: unknown }).then = (onF: (v: unknown) => unknown, onR: (e: unknown) => unknown) =>
      Promise.resolve(state.fromResult).then(onF, onR);
    return b;
  };
  return { state, rpc, from: vi.fn(() => makeBuilder()) };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: h.rpc, from: h.from },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  parsePermission,
  permissionMatches,
  getEffectivePermissions,
  rolesGrantPermission,
  meetsRoleLevel,
  getHighestRoleLevel,
  checkPermission,
  checkPermissionWithScope,
  createAuthorizationGuard,
  AuthorizationError,
  isAuthorizationError,
  syncUserPermissions,
  syncUserRoles,
} from '../authorization';

describe('authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.state.fromResult = { data: [], error: null };
  });

  describe('parsePermission', () => {
    it('parses resource.action with scope all', () => {
      expect(parsePermission('articles.read')).toEqual({
        resource: 'articles',
        action: 'read',
        scope: 'all',
      });
    });

    it('parses _own and _assigned scope suffixes', () => {
      expect(parsePermission('articles.update_own')).toEqual({
        resource: 'articles',
        action: 'update',
        scope: 'own',
      });
      expect(parsePermission('tasks.read_assigned')).toEqual({
        resource: 'tasks',
        action: 'read',
        scope: 'assigned',
      });
    });

    it('treats strings without exactly one dot as a resource wildcard', () => {
      expect(parsePermission('*')).toEqual({ resource: '*', action: '*' });
      expect(parsePermission('a.b.c')).toEqual({ resource: 'a.b.c', action: '*' });
    });
  });

  describe('permissionMatches', () => {
    it('matches exact permissions', () => {
      expect(permissionMatches('articles.read', 'articles.read')).toBe(true);
    });

    it('global wildcard matches anything', () => {
      expect(permissionMatches('*', 'vault.delete')).toBe(true);
      expect(permissionMatches('*', 'articles.update_own')).toBe(true);
    });

    it('resource wildcard matches any action on that resource only', () => {
      expect(permissionMatches('articles.*', 'articles.delete')).toBe(true);
      expect(permissionMatches('articles.*', 'articles.update_own')).toBe(true);
      expect(permissionMatches('articles.*', 'projects.read')).toBe(false);
    });

    it('all-scope permission covers own and assigned', () => {
      expect(permissionMatches('articles.update', 'articles.update_own')).toBe(true);
      expect(permissionMatches('tasks.update', 'tasks.update_assigned')).toBe(true);
    });

    it('own-scope permission does not upgrade to all', () => {
      expect(permissionMatches('articles.update_own', 'articles.update')).toBe(false);
    });

    it('own and assigned scopes do not cross', () => {
      expect(permissionMatches('tasks.update_own', 'tasks.update_assigned')).toBe(false);
      expect(permissionMatches('tasks.update_assigned', 'tasks.update_own')).toBe(false);
    });

    it('rejects different action or resource', () => {
      expect(permissionMatches('articles.read', 'articles.delete')).toBe(false);
      expect(permissionMatches('articles.read', 'projects.read')).toBe(false);
    });
  });

  describe('getEffectivePermissions', () => {
    it('returns direct permissions for a leaf role', () => {
      expect(getEffectivePermissions('viewer').sort()).toEqual(
        ['analytics.view', 'articles.read', 'projects.read'].sort()
      );
    });

    it('includes inherited permissions without duplicates', () => {
      const perms = getEffectivePermissions('editor');
      expect(perms).toContain('articles.publish');
      expect(perms).toContain('analytics.view'); // from viewer
      expect(perms.filter((p) => p === 'articles.read')).toHaveLength(1);
    });

    it('admin inherits the whole chain plus wildcard', () => {
      const perms = getEffectivePermissions('admin');
      expect(perms).toContain('*');
      expect(perms).toContain('articles.create');
      expect(perms).toContain('analytics.view');
    });

    it('returns empty for unknown role', () => {
      expect(getEffectivePermissions('superuser')).toEqual([]);
    });
  });

  describe('rolesGrantPermission', () => {
    it('reports the granting role', () => {
      expect(rolesGrantPermission(['viewer', 'editor'], 'articles.publish')).toEqual({
        granted: true,
        grantedBy: 'role:editor',
      });
    });

    it('denies when no role grants it', () => {
      expect(rolesGrantPermission(['viewer'], 'articles.delete')).toEqual({ granted: false });
      expect(rolesGrantPermission([], 'articles.read')).toEqual({ granted: false });
    });
  });

  describe('meetsRoleLevel / getHighestRoleLevel', () => {
    it('meets level when any role is high enough', () => {
      expect(meetsRoleLevel(['viewer'], 1)).toBe(true);
      expect(meetsRoleLevel(['viewer', 'editor'], 5)).toBe(true);
      expect(meetsRoleLevel(['admin'], 10)).toBe(true);
    });

    it('fails when all roles are below the level', () => {
      expect(meetsRoleLevel(['viewer'], 5)).toBe(false);
      expect(meetsRoleLevel(['editor'], 10)).toBe(false);
    });

    it('ignores unknown roles and empty lists', () => {
      expect(meetsRoleLevel(['root'], 1)).toBe(false);
      expect(meetsRoleLevel([], 0)).toBe(false);
    });

    it('returns the highest level, 0 for none', () => {
      expect(getHighestRoleLevel(['viewer', 'admin', 'editor'])).toBe(10);
      expect(getHighestRoleLevel(['unknown'])).toBe(0);
      expect(getHighestRoleLevel([])).toBe(0);
    });
  });

  describe('checkPermission', () => {
    it('prefers direct permissions and reports their scope', () => {
      expect(checkPermission(['articles.update_own'], ['editor'], 'articles.update_own')).toEqual({
        authorized: true,
        scope: 'own',
        grantedBy: 'permission:articles.update_own',
      });
    });

    it('falls back to roles with scope all', () => {
      expect(checkPermission([], ['editor'], 'articles.update')).toEqual({
        authorized: true,
        scope: 'all',
        grantedBy: 'role:editor',
      });
    });

    it('denies with a reason', () => {
      expect(checkPermission([], ['viewer'], 'vault.read')).toEqual({
        authorized: false,
        reason: 'Missing permission: vault.read',
      });
    });
  });

  describe('checkPermissionWithScope', () => {
    it('allows all-scope access regardless of owner', () => {
      const r = checkPermissionWithScope(['articles.update'], [], 'articles.update', 'other', 'me');
      expect(r.authorized).toBe(true);
      expect(r.scope).toBe('all');
    });

    it('allows own-scope access to own resource', () => {
      const r = checkPermissionWithScope(
        ['articles.update_own'],
        [],
        'articles.update_own',
        'me',
        'me'
      );
      expect(r.authorized).toBe(true);
      expect(r.scope).toBe('own');
    });

    it('denies own-scope access to another user resource', () => {
      expect(
        checkPermissionWithScope(['articles.update_own'], [], 'articles.update_own', 'other', 'me')
      ).toEqual({ authorized: false, reason: 'You can only access your own resources' });
    });

    it('denies own-scope access when owner is null', () => {
      const r = checkPermissionWithScope(
        ['articles.update_own'],
        [],
        'articles.update_own',
        null,
        'me'
      );
      expect(r.authorized).toBe(false);
    });

    it('role-granted access is all-scope even for an _own requirement', () => {
      const r = checkPermissionWithScope([], ['editor'], 'articles.update_own', 'other', 'me');
      expect(r.authorized).toBe(true);
      expect(r.grantedBy).toBe('role:editor');
    });

    it('passes assigned scope through without an owner check', () => {
      const r = checkPermissionWithScope(
        ['tasks.update_assigned'],
        [],
        'tasks.update_assigned',
        'other',
        'me'
      );
      expect(r.authorized).toBe(true);
      expect(r.scope).toBe('assigned');
    });

    it('returns the unauthorized result unchanged', () => {
      const r = checkPermissionWithScope([], [], 'vault.read', 'me', 'me');
      expect(r).toEqual({ authorized: false, reason: 'Missing permission: vault.read' });
    });
  });

  describe('createAuthorizationGuard', () => {
    it('passes silently when authorized and throws AuthorizationError otherwise', () => {
      const guard = createAuthorizationGuard([], ['viewer']);
      expect(() => guard('articles.read')).not.toThrow();

      let caught: unknown;
      try {
        guard('articles.delete');
      } catch (e) {
        caught = e;
      }
      expect(isAuthorizationError(caught)).toBe(true);
      expect((caught as AuthorizationError).permission).toBe('articles.delete');
      expect((caught as AuthorizationError).name).toBe('AuthorizationError');
      expect(isAuthorizationError(new Error('x'))).toBe(false);
    });
  });

  describe('syncUserPermissions', () => {
    it('returns rpc data', async () => {
      h.rpc.mockResolvedValue({ data: ['articles.read'], error: null });
      await expect(syncUserPermissions('u1')).resolves.toEqual(['articles.read']);
      expect(h.rpc).toHaveBeenCalledWith('get_user_permissions', { p_user_id: 'u1' });
    });

    it('returns [] on error or throw', async () => {
      h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
      await expect(syncUserPermissions('u1')).resolves.toEqual([]);
      h.rpc.mockRejectedValueOnce(new Error('network'));
      await expect(syncUserPermissions('u1')).resolves.toEqual([]);
    });
  });

  describe('syncUserRoles', () => {
    it('maps rows to role names', async () => {
      h.state.fromResult = { data: [{ role: 'editor' }, { role: 'viewer' }], error: null };
      await expect(syncUserRoles('u1')).resolves.toEqual(['editor', 'viewer']);
      expect(h.from).toHaveBeenCalledWith('user_roles');
    });

    it('returns [] on error', async () => {
      h.state.fromResult = { data: null, error: { message: 'denied' } };
      await expect(syncUserRoles('u1')).resolves.toEqual([]);
    });
  });
});
