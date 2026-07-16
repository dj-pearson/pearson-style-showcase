import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnsavedChanges } from '../useUnsavedChanges';
import { hasUnsavedChanges, __clearUnsavedGuards } from '@/lib/unsaved-changes';

beforeEach(() => {
  __clearUnsavedGuards();
});

describe('useUnsavedChanges', () => {
  it('registers the dirty state in the global registry', () => {
    const { rerender, unmount } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
      initialProps: { dirty: false },
    });
    expect(hasUnsavedChanges()).toBe(false);

    rerender({ dirty: true });
    expect(hasUnsavedChanges()).toBe(true);

    // Unmount unregisters the guard.
    unmount();
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('runs the action immediately when not dirty', () => {
    const { result } = renderHook(() => useUnsavedChanges(false));
    const action = vi.fn();

    act(() => result.current.requestNavigation(action));

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isBlocking).toBe(false);
  });

  it('blocks and prompts when dirty, then proceeds on confirm', () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    const action = vi.fn();

    act(() => result.current.requestNavigation(action));
    // Action deferred, dialog blocking.
    expect(action).not.toHaveBeenCalled();
    expect(result.current.isBlocking).toBe(true);

    act(() => result.current.confirmDiscard());
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isBlocking).toBe(false);
  });

  it('cancels the pending action on keep-editing', () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    const action = vi.fn();

    act(() => result.current.requestNavigation(action));
    expect(result.current.isBlocking).toBe(true);

    act(() => result.current.cancelDiscard());
    expect(action).not.toHaveBeenCalled();
    expect(result.current.isBlocking).toBe(false);
  });

  it('registers and removes a beforeunload listener', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useUnsavedChanges(true));
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
