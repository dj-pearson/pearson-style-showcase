import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Global, visible banner for security warnings raised by the auth layer (e.g.
 * background admin re-verification failing). Rendered once near the app root so
 * these conditions are never handled silently.
 */
const SecurityWarningBanner = () => {
  const { securityWarning, dismissSecurityWarning } = useAuth();

  if (!securityWarning) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-x-0 top-0 z-[100] flex items-start gap-3 border-b border-destructive/40 bg-destructive px-4 py-3 text-destructive-foreground shadow-lg"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium leading-snug">{securityWarning}</p>
      <button
        type="button"
        onClick={dismissSecurityWarning}
        aria-label="Dismiss security warning"
        className="shrink-0 rounded-md p-1 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export default SecurityWarningBanner;
