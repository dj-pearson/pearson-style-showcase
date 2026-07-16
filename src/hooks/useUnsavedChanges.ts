import { useCallback, useEffect, useRef, useState } from 'react';
import { registerUnsavedGuard } from '@/lib/unsaved-changes';

/**
 * Track a form's unsaved-changes ("dirty") state and guard against losing it.
 *
 * While `isDirty` is true this hook:
 *  - registers a `beforeunload` listener so the browser warns on tab close and
 *    page refresh (and hard navigations away from the app), and
 *  - registers the dirty state in a global registry (see lib/unsaved-changes)
 *    so container components — e.g. the admin dashboard's sidebar tab switch —
 *    can prompt before navigating.
 *
 * For in-app navigation the component wraps the navigation action with
 * `requestNavigation(action)`: if the form is dirty an AlertDialog is shown
 * ("Discard Changes" / "Keep Editing"); otherwise the action runs immediately.
 *
 * NOTE: the app uses <BrowserRouter> (not a data router), so react-router's
 * useBlocker is unavailable; SPA route/tab transitions are guarded via
 * requestNavigation + the registry instead. beforeunload covers close/refresh.
 *
 * All listeners/registrations are cleaned up on unmount (or when the form is
 * saved and `isDirty` becomes false).
 */
export function useUnsavedChanges(isDirty: boolean) {
  // Keep a ref so the long-lived event listener always sees the latest value.
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Warn on tab close / refresh / hard navigation.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      // Required for the native prompt to show in most browsers.
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Register in the global registry for container-level (sidebar tab) guards.
  useEffect(() => registerUnsavedGuard(() => isDirtyRef.current), []);

  // In-app navigation confirmation dialog state.
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requestNavigation = useCallback((action: () => void) => {
    if (isDirtyRef.current) {
      // Store the thunk (wrapped so React doesn't call it as an updater).
      setPendingAction(() => action);
    } else {
      action();
    }
  }, []);

  const confirmDiscard = useCallback(() => {
    setPendingAction((action) => {
      action?.();
      return null;
    });
  }, []);

  const cancelDiscard = useCallback(() => setPendingAction(null), []);

  return {
    /** Whether the confirm dialog should be shown. */
    isBlocking: pendingAction !== null,
    /** Run `action`, prompting first if the form is dirty. */
    requestNavigation,
    /** Proceed with the pending action (discard changes). */
    confirmDiscard,
    /** Dismiss the dialog and keep editing. */
    cancelDiscard,
  };
}
