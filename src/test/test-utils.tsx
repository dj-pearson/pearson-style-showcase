/* eslint-disable react-refresh/only-export-components -- test-only module that
   intentionally exports render helpers alongside provider components. */
/**
 * Shared test utilities.
 *
 * Provides a custom `render` that wraps the component under test in the
 * providers most components rely on: a fresh React Query client, a router
 * (BrowserRouter by default, or MemoryRouter when `initialEntries` is given),
 * and a mock value for the real AuthContext.
 *
 * Re-exports everything from @testing-library/react so tests import a single
 * module:
 *   import { render, screen, createMockAuthValue } from '@/test/test-utils';
 */

import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';

type AuthValue = NonNullable<React.ContextType<typeof AuthContext>>;

/**
 * Build a complete AuthContext value with unauthenticated defaults. Override
 * any field (e.g. `{ isAdmin: true, authStatus: 'admin_verified' }`) per-test.
 */
export function createMockAuthValue(overrides: Partial<AuthValue> = {}): AuthValue {
  const base: AuthValue = {
    // Core state
    session: null,
    user: null,
    adminUser: null,
    authStatus: 'unauthenticated',
    error: null,

    // Computed state
    isLoading: false,
    isAuthenticated: false,
    isAdminVerified: false,
    isAdmin: false,
    isEditor: false,
    isViewer: false,
    roles: [],
    permissions: [],

    // Actions
    signIn: async () => ({ success: true }),
    signInWithProvider: async () => ({ success: true }),
    signOut: async () => {},
    verifyAdminAccess: async () => false,

    // Permission checks
    hasRole: () => false,
    hasPermission: () => false,
    hasAnyPermission: () => false,
    hasAllPermissions: () => false,
  };

  return { ...base, ...overrides };
}

/**
 * Create a QueryClient tuned for tests: no retries and no refetching so tests
 * are deterministic and fast.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Override the mock auth context value. */
  authValue?: Partial<AuthValue>;
  /** Provide a specific QueryClient (defaults to a fresh test client). */
  queryClient?: QueryClient;
  /** When set, use MemoryRouter seeded with these entries instead of BrowserRouter. */
  initialEntries?: string[];
}

function AllProviders({
  children,
  authValue,
  queryClient,
  initialEntries,
}: {
  children: ReactNode;
  authValue: AuthValue;
  queryClient: QueryClient;
  initialEntries?: string[];
}) {
  const Router = ({ children: routerChildren }: { children: ReactNode }) =>
    initialEntries ? (
      <MemoryRouter initialEntries={initialEntries}>{routerChildren}</MemoryRouter>
    ) : (
      <BrowserRouter>{routerChildren}</BrowserRouter>
    );

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
      </Router>
    </QueryClientProvider>
  );
}

/**
 * Custom render that mounts `ui` inside the app's common providers.
 * Returns the standard RTL result plus the `queryClient` used, so tests can
 * assert on or invalidate the cache.
 */
export function renderWithProviders(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { authValue, queryClient, initialEntries, ...rtlOptions } = options;
  const client = queryClient ?? createTestQueryClient();
  const resolvedAuth = createMockAuthValue(authValue);

  const result = render(ui, {
    wrapper: ({ children }) => (
      <AllProviders authValue={resolvedAuth} queryClient={client} initialEntries={initialEntries}>
        {children}
      </AllProviders>
    ),
    ...rtlOptions,
  });

  return { ...result, queryClient: client };
}

// Re-export the RTL API so tests only need this module.
export * from '@testing-library/react';
// Export the custom render under the conventional `render` name as well.
export { renderWithProviders as render };
