import { describe, it, expect } from 'vitest';
import { getJwtAal, isAal2Token, isMfaRequiredError } from '@/lib/mfa-assurance';

function fakeJwt(payload: unknown): string {
  const utf8 = new TextEncoder().encode(JSON.stringify(payload));
  const b64 = btoa(String.fromCharCode(...utf8))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `eyJhbGciOiJIUzI1NiJ9.${b64}.sig`;
}

describe('getJwtAal', () => {
  it('reads the aal claim', () => {
    expect(getJwtAal(fakeJwt({ sub: 'u1', aal: 'aal1' }))).toBe('aal1');
    expect(getJwtAal(fakeJwt({ sub: 'u1', aal: 'aal2' }))).toBe('aal2');
  });

  it('handles base64url payloads with non-ASCII claims', () => {
    // '?>>' encodes to '/' and '+' in standard base64, '_' and '-' in base64url.
    expect(getJwtAal(fakeJwt({ email: 'r\u00e9mi?>>@example.com', aal: 'aal2' }))).toBe('aal2');
  });

  it('returns null for missing or malformed tokens', () => {
    expect(getJwtAal(undefined)).toBeNull();
    expect(getJwtAal('')).toBeNull();
    expect(getJwtAal('not-a-jwt')).toBeNull();
    expect(getJwtAal('a.!!!.c')).toBeNull();
    expect(getJwtAal(fakeJwt({ sub: 'u1' }))).toBeNull();
    expect(getJwtAal(fakeJwt([1, 2]))).toBeNull();
  });
});

describe('isAal2Token', () => {
  it('is true only for aal2', () => {
    expect(isAal2Token(fakeJwt({ aal: 'aal2' }))).toBe(true);
    expect(isAal2Token(fakeJwt({ aal: 'aal1' }))).toBe(false);
    expect(isAal2Token(null)).toBe(false);
  });
});

describe('isMfaRequiredError', () => {
  it('recognises the invokeEdgeFunction error and a response body', () => {
    expect(isMfaRequiredError(new Error('mfa_required'))).toBe(true);
    expect(isMfaRequiredError({ error: 'mfa_required' })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isMfaRequiredError(new Error('Forbidden - Not an admin'))).toBe(false);
    expect(isMfaRequiredError({ error: 'Unauthorized' })).toBe(false);
    expect(isMfaRequiredError(null)).toBe(false);
    expect(isMfaRequiredError('mfa_required')).toBe(false);
  });
});
