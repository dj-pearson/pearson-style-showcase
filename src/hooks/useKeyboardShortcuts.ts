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
  /**
   * Fire even while focus is in an input, textarea or contenteditable.
   * Defaults to false so shortcuts never hijack text editing keys such as
   * Ctrl+A (select all) inside a form field.
   */
  allowInInputs?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * Printable symbols like '?' or '!' already need Shift on most layouts, so
 * the Shift state carries no information for them. Letters, digits and named
 * keys (Escape, ArrowUp...) still require an exact Shift match.
 */
function shiftIsImplicit(key: string): boolean {
  return key.length === 1 && !/[a-z0-9]/i.test(key);
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
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const inEditable = isEditableTarget(event.target);

      for (const shortcut of shortcuts) {
        const {
          key,
          ctrlKey = false,
          metaKey = false,
          shiftKey = false,
          altKey = false,
          action,
          preventDefault = true,
          allowInInputs = false,
        } = shortcut;

        if (inEditable && !allowInInputs) continue;

        // Check if key matches (case-insensitive)
        const keyMatches = event.key.toLowerCase() === key.toLowerCase();

        // Check modifiers
        // On Mac, Cmd (metaKey) is more common; on Windows/Linux, Ctrl is used
        const modifierMatches =
          (shiftIsImplicit(key) || event.shiftKey === shiftKey) &&
          event.altKey === altKey &&
          ((ctrlKey && (event.ctrlKey || event.metaKey)) ||
            (metaKey && (event.metaKey || event.ctrlKey)) ||
            (!ctrlKey && !metaKey && !event.ctrlKey && !event.metaKey));

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
