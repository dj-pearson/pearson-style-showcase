/**
 * Logger utility.
 *
 * - debug / info / log: development-only console output (kept quiet in prod to
 *   avoid noisy or PII-leaking logs).
 * - warn / error: routed through the production-aware logger
 *   (src/lib/production-logger.ts) so security-critical signals are actually
 *   emitted in production. Output respects VITE_LOG_LEVEL and has PII masking.
 *
 * This ensures auth/security failures (failed server-side sign-out, background
 * admin revocation, session-rotation failures, OAuth state failures, and
 * logSecurityEvent insert fallbacks) are visible in prod instead of being
 * silently dropped, while debug/info chatter stays dev-only.
 */

import { productionLogger } from './production-logger';

const isDev = import.meta.env.DEV;

/**
 * Coerce an arbitrary first argument into a string message for the structured
 * production logger (which expects a string it can PII-mask). Non-string values
 * are stringified so callers passing an Error/object first don't blow up.
 */
function toMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (value === undefined) return '';
  try {
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  } catch {
    return String(value);
  }
}

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  // Warnings are emitted in production via the production-aware logger.
  warn: (...args: unknown[]) => {
    const [message, ...rest] = args;
    productionLogger.warn(toMessage(message), rest.length ? { args: rest } : undefined);
  },

  // Errors are emitted in production via the production-aware logger. Any Error
  // instance among the args is passed through so its name/message are captured.
  error: (...args: unknown[]) => {
    const [message, ...rest] = args;
    const error = rest.find((arg) => arg instanceof Error) as Error | undefined;
    const metadata = rest.filter((arg) => !(arg instanceof Error));
    productionLogger.error(
      toMessage(message),
      error,
      metadata.length ? { args: metadata } : undefined
    );
  },
};
