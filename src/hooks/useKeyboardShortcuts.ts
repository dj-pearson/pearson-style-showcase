import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  action: () => void;
  preventDefault?: boolean;
}

/**
 * useKeyboardShortcuts - Hook for managing keyboard shortcuts
 * Supports Ctrl/Cmd modifiers for cross-platform compatibility
 *
 * @param shortcuts - Array of keyboard shortcut configurations
 * @param enabled - Whether shortcuts are currently enabled
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   {
 *     key: 's',
 *     ctrlKey: true,
 *     description: 'Save',
 *     action: handleSave,
 *     preventDefault: true
 *   }
 * ]);
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow certain shortcuts even in input fields (like Cmd+S for save)
        const allowInInputs = shortcuts.some(
          s => s.ctrlKey || s.metaKey
        );
        if (!allowInInputs) return;
      }

      for (const shortcut of shortcuts) {
        const {
          key,
          ctrlKey = false,
          metaKey = false,
          shiftKey = false,
          altKey = false,
          action,
          preventDefault = true,
        } = shortcut;

        // Check if key matches (case-insensitive)
        const keyMatches = event.key.toLowerCase() === key.toLowerCase();

        // Check modifiers
        // On Mac, Cmd (metaKey) is more common; on Windows/Linux, Ctrl is used
        const modifierMatches =
          event.shiftKey === shiftKey &&
          event.altKey === altKey &&
          ((ctrlKey && (event.ctrlKey || event.metaKey)) ||
            (metaKey && (event.metaKey || event.ctrlKey)) ||
            (!ctrlKey && !metaKey));

        if (keyMatches && modifierMatches) {
          if (preventDefault) {
            event.preventDefault();
            event.stopPropagation();
          }
          action();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Get platform-specific keyboard shortcut display
 * Shows Cmd on Mac, Ctrl on other platforms
 */
export function getShortcutDisplay(shortcut: KeyboardShortcut): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];

  if (shortcut.ctrlKey || shortcut.metaKey) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shiftKey) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.altKey) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? '' : '+');
}
