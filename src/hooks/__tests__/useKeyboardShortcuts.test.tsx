import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, getShortcutDisplay } from '../useKeyboardShortcuts';

function press(key: string, modifiers: Partial<KeyboardEvent> = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...modifiers });
  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useKeyboardShortcuts', () => {
  it('registers a keydown listener on mount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useKeyboardShortcuts([{ key: 's', description: 'Save', action: vi.fn() }]));
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('fires the action when a matching Ctrl shortcut is pressed', () => {
    const action = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ key: 's', ctrlKey: true, description: 'Save', action }])
    );
    press('s', { ctrlKey: true } as Partial<KeyboardEvent>);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('treats Ctrl and Cmd as interchangeable (cross-platform modifier)', () => {
    const action = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ key: 's', ctrlKey: true, description: 'Save', action }])
    );
    press('s', { metaKey: true } as Partial<KeyboardEvent>);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('matches a shift+alt modifier combination exactly', () => {
    const action = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        { key: 'p', shiftKey: true, altKey: true, description: 'Palette', action },
      ])
    );
    // Missing alt -> no fire.
    press('p', { shiftKey: true } as Partial<KeyboardEvent>);
    expect(action).not.toHaveBeenCalled();
    // Correct combo -> fires.
    press('p', { shiftKey: true, altKey: true } as Partial<KeyboardEvent>);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the hook is disabled', () => {
    const action = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ key: 's', ctrlKey: true, description: 'Save', action }], false)
    );
    press('s', { ctrlKey: true } as Partial<KeyboardEvent>);
    expect(action).not.toHaveBeenCalled();
  });

  it('removes its listener on unmount (cleanup)', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const action = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts([{ key: 's', ctrlKey: true, description: 'Save', action }])
    );
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    // After unmount the action must no longer fire.
    press('s', { ctrlKey: true } as Partial<KeyboardEvent>);
    expect(action).not.toHaveBeenCalled();
  });

  it('getShortcutDisplay renders a human-readable combo', () => {
    const display = getShortcutDisplay({
      key: 's',
      ctrlKey: true,
      shiftKey: true,
      description: 'Save',
      action: () => {},
    });
    expect(display).toMatch(/S/);
  });
});
