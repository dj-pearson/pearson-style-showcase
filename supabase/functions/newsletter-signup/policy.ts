/**
 * What a signup does with the row it finds (US-107). Pure, for unit tests.
 *
 *   no row                      -> insert a pending row, mail a confirmation
 *   active and confirmed        -> already_subscribed, no mail
 *   pending, mailed < 10 min    -> cooldown: report sent, mail nothing
 *   anything else (pending,
 *   unsubscribed, legacy)       -> reset to pending, mail a new confirmation
 *
 * An unsubscribed address is never reactivated here; it has to confirm again.
 */
import { CONFIRMATION_RESEND_COOLDOWN_MS } from '../_shared/newsletter-tokens.ts';

export interface ExistingSubscriber {
  id: string;
  active: boolean;
  confirmed_at: string | null;
  confirmation_sent_at: string | null;
}

export type SignupAction = 'insert' | 'already_subscribed' | 'cooldown' | 'resend';

export function decideSignupAction(
  existing: ExistingSubscriber | null,
  now: number = Date.now()
): SignupAction {
  if (!existing) return 'insert';
  if (existing.active && existing.confirmed_at) return 'already_subscribed';
  if (existing.confirmation_sent_at) {
    const sent = Date.parse(existing.confirmation_sent_at);
    if (!Number.isNaN(sent) && now - sent < CONFIRMATION_RESEND_COOLDOWN_MS) return 'cooldown';
  }
  return 'resend';
}
