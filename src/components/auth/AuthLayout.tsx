import { Outlet } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import SecurityWarningBanner from '@/components/SecurityWarningBanner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

/**
 * Layout route for the admin and OAuth pages, loaded as its own lazy chunk.
 *
 * AuthProvider (with session rotation, the encrypted admin cache and a
 * getSession call on mount) and the sonner toaster are only needed here, so
 * keeping them out of App.tsx keeps them out of the public entry bundle and
 * stops every public page view from touching the auth session.
 */
const AuthLayout = () => (
  <AuthProvider>
    <SecurityWarningBanner />
    <Sonner />
    <Outlet />
  </AuthProvider>
);

/** Nested layout route that requires a verified admin for its children. */
export const AdminOnlyOutlet = () => (
  <ProtectedRoute requireAdmin={true}>
    <Outlet />
  </ProtectedRoute>
);

export default AuthLayout;
