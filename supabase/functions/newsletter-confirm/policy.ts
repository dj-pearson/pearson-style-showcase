/**
 * What a confirmation click does with the row its token found (US-107).
 * Pure, for unit tests; index.ts does the lookup, the update and the mail.
 *
 *   no row                      -> invalid
 *   active and confirmed        -> already_confirmed, no mail (a second click)
 *   never mailed, or mailed
 *   more than 7 days ago        -> expired
 *   anything else               -> confirm: activate the row, then mail
 *
 * The activating update is conditional on confirmed_at IS NULL. When it
 * matches no row a racing click got there first, so this request reports
 * confirmed and leaves the welcome email to that one.
 */
import { isConfirmationExpired } from '../_shared/newsletter-tokens.ts';

export interface PendingSubscriber {
  active: boolean | null;
  confirmed_at: string | null;
  confirmation_sent_at: string | null;
}

export type ConfirmAction = 'invalid' | 'already_confirmed' | 'expired' | 'confirm';

export function decideConfirmAction(
  row: PendingSubscriber | null,
  now: number = Date.now()
): ConfirmAction {
  if (!row) return 'invalid';
  if (row.active && row.confirmed_at) return 'already_confirmed';
  if (isConfirmationExpired(row.confirmation_sent_at, now)) return 'expired';
  return 'confirm';
}

/** True when this request's conditional update activated the row, so it owns the welcome mail. */
export function wonConfirmRace(updated: readonly unknown[] | null | undefined): boolean {
  return Array.isArray(updated) && updated.length > 0;
}
