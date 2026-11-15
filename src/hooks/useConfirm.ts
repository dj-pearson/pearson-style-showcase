import { createContext, useContext } from 'react';

export interface ConfirmOptions {
  /** Question naming the thing, e.g. "Delete invoice INV-0042?" */
  title: string;
  /** What happens if the user goes ahead. */
  description?: string;
  /** Text for the confirming button. Name the action ("Delete invoice"), never "OK". */
  confirmLabel?: string;
  /** Text for the dismissing button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Styles the confirming button as destructive. */
  destructive?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Returns a `confirm(options)` function that opens the shared AlertDialog and
 * resolves to true when the user confirms, false on Cancel, Escape or an
 * outside dismissal. Needs a <ConfirmProvider> above it in the tree; the
 * admin dashboard mounts one.
 */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>');
  }
  return confirm;
}
