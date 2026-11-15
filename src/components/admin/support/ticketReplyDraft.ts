/**
 * Per-ticket reply drafts in sessionStorage, so closing a ticket or switching
 * to another one does not throw away a half-written reply. Storage can be
 * unavailable (private mode, blocked site data), so every call is wrapped and
 * failures degrade to "no draft".
 */

const PREFIX = 'support:reply-draft:';

export const draftKey = (ticketId: string) => `${PREFIX}${ticketId}`;

export function loadReplyDraft(ticketId: string): string {
  try {
    return sessionStorage.getItem(draftKey(ticketId)) ?? '';
  } catch {
    return '';
  }
}

export function saveReplyDraft(ticketId: string, message: string): void {
  try {
    if (message.trim()) sessionStorage.setItem(draftKey(ticketId), message);
    else sessionStorage.removeItem(draftKey(ticketId));
  } catch {
    /* storage unavailable: the draft just won't survive a close */
  }
}

export function clearReplyDraft(ticketId: string): void {
  try {
    sessionStorage.removeItem(draftKey(ticketId));
  } catch {
    /* ignore */
  }
}
