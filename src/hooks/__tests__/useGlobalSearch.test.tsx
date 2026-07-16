import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalSearch } from '../useGlobalSearch';

/**
 * NOTE: useGlobalSearch is intentionally a small open/close state hook driven by
 * the Cmd/Ctrl+K and Escape shortcuts - it does NOT itself perform query
 * debouncing, fetch results, or handle result errors (that lives in the Search
 * page/components). These tests therefore cover the hook's real behavior: the
 * open/close toggle and its keyboard wiring, including listener cleanup.
 */

function press(key: string, modifiers: Partial<KeyboardEvent> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, ...modifiers }));
}

describe('useGlobalSearch', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useGlobalSearch());
    expect(result.current.isOpen).toBe(false);
  });

  it('opens on Ctrl+K', () => {
    const { result } = renderHook(() => useGlobalSearch());
    act(() => press('k', { ctrlKey: true } as Partial<KeyboardEvent>));
    expect(result.current.isOpen).toBe(true);
  });

  it('opens on Cmd+K (metaKey)', () => {
    const { result } = renderHook(() => useGlobalSearch());
    act(() => press('k', { metaKey: true } as Partial<KeyboardEvent>));
    expect(result.current.isOpen).toBe(true);
  });

  it('closes on Escape when open (search clearing)', () => {
    const { result } = renderHook(() => useGlobalSearch());
    act(() => press('k', { ctrlKey: true } as Partial<KeyboardEvent>));
    expect(result.current.isOpen).toBe(true);
    act(() => press('Escape'));
    expect(result.current.isOpen).toBe(false);
  });

  it('exposes setIsOpen to control state directly', () => {
    const { result } = renderHook(() => useGlobalSearch());
    act(() => result.current.setIsOpen(true));
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.setIsOpen(false));
    expect(result.current.isOpen).toBe(false);
  });

  it('removes its keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useGlobalSearch());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });
});
