import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
// Registers the jest-dom matchers on Vitest's `expect` AND augments the
// TypeScript types (toBeInTheDocument, toHaveValue, ...) globally for all tests.
import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock IntersectionObserver for OptimizedImage component
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver for components that observe element size (charts, panels)
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Ensure the Web Crypto API is available on window for modules that use it
// (secure-cache AES-GCM, device-trust fingerprinting, csrf state, session
// rotation). jsdom/Node usually expose globalThis.crypto; when a
// subtle/getRandomValues implementation is missing we fall back to Node's
// webcrypto so those code paths run under test.
{
  const nodeCrypto = (globalThis as any).crypto ?? webcrypto;
  if (!window.crypto || !window.crypto.subtle || !window.crypto.getRandomValues) {
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      writable: true,
      value: nodeCrypto,
    });
  }
  if (typeof window.crypto.randomUUID !== 'function' && nodeCrypto?.randomUUID) {
    (window.crypto as any).randomUUID = nodeCrypto.randomUUID.bind(nodeCrypto);
  }
}
