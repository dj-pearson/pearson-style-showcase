import { describe, it, expect, beforeEach } from 'vitest';
import { ensureCsrfToken, secureMutation } from '../secure-supabase';
import { getStoredCSRFTokenSync, clearCSRFToken } from '../csrf';

beforeEach(() => {
  clearCSRFToken();
});

describe('secure-supabase', () => {
  it('ensureCsrfToken provisions a token in storage', async () => {
    expect(getStoredCSRFTokenSync()).toBeNull();
    const token = await ensureCsrfToken();
    expect(token).toBeTruthy();
    // Now readable synchronously (used by the client fetch layer).
    expect(getStoredCSRFTokenSync()).toBe(token);
  });

  it('secureMutation provisions a token before running the mutation', async () => {
    expect(getStoredCSRFTokenSync()).toBeNull();
    let tokenAtRun: string | null = 'unset';
    const result = await secureMutation(() => {
      tokenAtRun = getStoredCSRFTokenSync();
      return 42;
    });
    expect(result).toBe(42);
    // The token existed when the mutation ran, so the fetch layer can attach it.
    expect(tokenAtRun).toBeTruthy();
  });

  it('secureMutation returns the mutation result (awaits thenables)', async () => {
    const result = await secureMutation(async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });
});
