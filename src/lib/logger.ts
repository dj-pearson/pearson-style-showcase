/**
 * Logger utility that only outputs in development mode
 * Prevents console statements from appearing in production builds
 */

const isDev = import.meta.env.DEV;

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

  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  }
};
