/**
 * Global registry of "unsaved changes" guards.
 *
 * Each form that tracks unsaved changes registers a predicate here (via
 * useUnsavedChanges). Container components that perform in-app navigation which
 * is NOT a router transition — e.g. the admin dashboard switching sidebar tabs —
 * can call hasUnsavedChanges() to decide whether to prompt before proceeding.
 */

type DirtyPredicate = () => boolean;

const guards = new Set<DirtyPredicate>();

/** Register a dirty-state predicate; returns an unregister function. */
export function registerUnsavedGuard(predicate: DirtyPredicate): () => void {
  guards.add(predicate);
  return () => {
    guards.delete(predicate);
  };
}

/** True if any registered form currently has unsaved changes. */
export function hasUnsavedChanges(): boolean {
  for (const predicate of guards) {
    try {
      if (predicate()) return true;
    } catch {
      /* ignore a misbehaving guard */
    }
  }
  return false;
}

/** Test helper: clear all registered guards. */
export function __clearUnsavedGuards(): void {
  guards.clear();
}
