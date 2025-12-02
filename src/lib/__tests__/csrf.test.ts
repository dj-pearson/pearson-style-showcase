import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCSRFToken,
  refreshCSRFToken,
  clearCSRFToken,
  getCSRFHeaders,
  requiresCSRFProtection,
  CSRF_HEADER_NAME,
} from '../csrf';

describe('CSRF Protection', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('getCSRFToken', () => {
    it('should generate a new token when none exists', async () => {
      const token = await getCSRFToken();

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(20);
      expect(token).toContain('.'); // Format: timestamp.hash
    });

    it('should return cached token on subsequent calls', async () => {
      const token1 = await getCSRFToken();
      const token2 = await getCSRFToken();

      expect(token1).toBe(token2);
    });

    it('should store token in sessionStorage', async () => {
      const token = await getCSRFToken();

      const storedToken = sessionStorage.getItem('csrf_token');
      expect(storedToken).toBe(token);
    });

    it('should store expiry in sessionStorage', async () => {
      await getCSRFToken();

      const expiry = sessionStorage.getItem('csrf_token_expiry');
      expect(expiry).toBeDefined();
      expect(parseInt(expiry!, 10)).toBeGreaterThan(Date.now());
    });
  });

  describe('refreshCSRFToken', () => {
    it('should generate a new token', async () => {
      const token1 = await getCSRFToken();
      const token2 = await refreshCSRFToken();

      expect(token1).not.toBe(token2);
    });

    it('should clear old token from storage', async () => {
      await getCSRFToken();
      await refreshCSRFToken();

      // New token should be in storage
      const storedToken = sessionStorage.getItem('csrf_token');
      expect(storedToken).toBeDefined();
    });
  });

  describe('clearCSRFToken', () => {
    it('should remove token from sessionStorage', async () => {
      await getCSRFToken();

      clearCSRFToken();

      expect(sessionStorage.getItem('csrf_token')).toBeNull();
      expect(sessionStorage.getItem('csrf_token_expiry')).toBeNull();
    });
  });

  describe('getCSRFHeaders', () => {
    it('should return headers with token', async () => {
      const headers = await getCSRFHeaders();

      expect(headers).toHaveProperty(CSRF_HEADER_NAME);
      expect(headers[CSRF_HEADER_NAME]).toBeDefined();
      expect(headers[CSRF_HEADER_NAME].length).toBeGreaterThan(20);
    });
  });

  describe('requiresCSRFProtection', () => {
    it('should return true for POST', () => {
      expect(requiresCSRFProtection('POST')).toBe(true);
      expect(requiresCSRFProtection('post')).toBe(true);
    });

    it('should return true for PUT', () => {
      expect(requiresCSRFProtection('PUT')).toBe(true);
    });

    it('should return true for DELETE', () => {
      expect(requiresCSRFProtection('DELETE')).toBe(true);
    });

    it('should return true for PATCH', () => {
      expect(requiresCSRFProtection('PATCH')).toBe(true);
    });

    it('should return false for GET', () => {
      expect(requiresCSRFProtection('GET')).toBe(false);
    });

    it('should return false for HEAD', () => {
      expect(requiresCSRFProtection('HEAD')).toBe(false);
    });

    it('should return false for OPTIONS', () => {
      expect(requiresCSRFProtection('OPTIONS')).toBe(false);
    });
  });

  describe('Token format', () => {
    it('should have correct format: timestamp.hash', async () => {
      const token = await getCSRFToken();
      const parts = token.split('.');

      expect(parts).toHaveLength(2);

      // First part should be base36 encoded timestamp
      const timestamp = parseInt(parts[0], 36);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
      expect(timestamp).toBeGreaterThan(Date.now() - 1000); // Within last second
    });

    it('should generate unique tokens each time', async () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 5; i++) {
        clearCSRFToken();
        const token = await getCSRFToken();
        tokens.add(token);
      }

      expect(tokens.size).toBe(5);
    });
  });
});
