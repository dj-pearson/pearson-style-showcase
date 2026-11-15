import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hasUnsavedChanges } from '@/lib/unsaved-changes';

type PendingSource = 'user' | 'history';

interface PendingView {
  view: string;
  source: PendingSource;
}

interface Options {
  /** Every view id the container can render. */
  validViews: readonly string[];
  /** View shown when the param is missing or unknown. */
  fallback: string;
  /** Search param that holds the view id. Defaults to "view". */
  param?: string;
}

/**
 * Keep a container's active view in a URL search param (?view=...) while
 * respecting the unsaved-changes registry (see lib/unsaved-changes).
 *
 * - Refresh restores the view; unknown or missing values fall back.
 * - requestView() (sidebar clicks, shortcuts) pushes a history entry, so
 *   Back/Forward move between views. Other search params are preserved.
 * - If a mounted form is dirty, both a user-initiated change and a
 *   Back/Forward change are held as `pendingView` for the existing
 *   UnsavedChangesDialog. Discard commits it; Keep Editing restores the
 *   param to the current view (replace, so no extra history entry).
 *
 * The rendered view is committed state rather than read straight from the
 * URL, so a dirty form stays mounted while the dialog is open.
 */
export function useUnsavedChangesViewParam({ validViews, fallback, param = 'view' }: Options) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(param);
  const urlView = raw && validViews.includes(raw) ? raw : fallback;

  const [activeView, setActiveView] = useState(urlView);
  const [pending, setPending] = useState<PendingView | null>(null);
  // View we just wrote to the URL; until the location catches up, a
  // mismatch between urlView and activeView is ours, not Back/Forward.
  const writingRef = useRef<string | null>(null);

  const writeParam = useCallback(
    (view: string, replace: boolean) => {
      writingRef.current = view;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (view === fallback) next.delete(param);
          else next.set(param, view);
          return next;
        },
        { replace }
      );
    },
    [setSearchParams, fallback, param]
  );

  // The URL moved without requestView: Back/Forward, or a link elsewhere.
  useEffect(() => {
    if (writingRef.current !== null) {
      if (urlView === writingRef.current) writingRef.current = null;
      return;
    }
    if (urlView === activeView) return;
    if (hasUnsavedChanges()) {
      setPending({ view: urlView, source: 'history' });
    } else {
      setActiveView(urlView);
    }
  }, [urlView, activeView]);

  const requestView = useCallback(
    (id: string) => {
      if (id === activeView) return;
      if (hasUnsavedChanges()) {
        setPending({ view: id, source: 'user' });
        return;
      }
      setActiveView(id);
      writeParam(id, false);
    },
    [activeView, writeParam]
  );

  const confirmViewChange = useCallback(() => {
    if (!pending) return;
    setActiveView(pending.view);
    if (pending.source === 'user') writeParam(pending.view, false);
    setPending(null);
  }, [pending, writeParam]);

  const cancelViewChange = useCallback(() => {
    if (pending?.source === 'history') writeParam(activeView, true);
    setPending(null);
  }, [pending, activeView, writeParam]);

  return {
    activeView,
    requestView,
    pendingView: pending?.view ?? null,
    confirmViewChange,
    cancelViewChange,
  };
}
