/**
 * Pure email validation for newsletter signup (extracted from index.ts for unit
 * testing; index.ts imports Supabase/Resend over URLs the test sandbox blocks).
 */

export const DISPOSABLE_DOMAINS = [
  // Original list
  'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
  // Major disposable email providers
  'mailinator.com', 'yopmail.com', 'sharklasers.com', 'guerrillamail.info',
  'grr.la', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.de',
  'trashmail.com', 'trashmail.me', 'trashmail.net', 'trashmail.org',
  'dispostable.com', 'mailnesia.com', 'maildrop.cc', 'discard.email',
  'fakeinbox.com', 'mailcatch.com', 'tempail.com', 'temp-mail.org',
  'temp-mail.io', 'mohmal.com', 'getnada.com', 'emailondeck.com',
  'mintemail.com', 'harakirimail.com', 'jetable.org', 'throwam.com',
  'mytemp.email', 'tempinbox.com', 'tempr.email', 'tmail.ws',
  'tmpmail.org', 'tmpmail.net', 'mailtemp.info', 'burnermail.io',
  'inboxkitten.com', 'crazymailing.com', 'mailnator.com',
  'spamgourmet.com', 'spamcowboy.com', 'mytrashmail.com',
  'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf',
  'nospam.ze.tc', 'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr',
  'courriel.fr.nf', 'moncourrier.fr.nf', 'monemail.fr.nf',
  'guerrillamailblock.com', 'pokemail.net', 'spam4.me',
  'grr.la', 'mailexpire.com', 'safetymail.info', 'filzmail.com',
  'mailforspam.com', 'tempomail.fr', 'getairmail.com',
];

export function validateEmail(email: string): { valid: boolean; error?: string } {
  // Trim and lowercase
  const normalized = email.trim().toLowerCase();

  // Length check
  if (normalized.length > 255) {
    return { valid: false, error: 'Email address is too long' };
  }

  // Comprehensive email regex
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

  if (!emailRegex.test(normalized)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Check for disposable domains
  const domain = normalized.split('@')[1];
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    return { valid: false, error: 'Disposable email addresses are not allowed' };
  }

  return { valid: true };
}
