/**
 * AES-256-GCM encryption helpers for the secure vault.
 *
 * Extracted from secure-vault/index.ts so the crypto can be unit-tested in
 * isolation (it depends only on the Web Crypto API and the VAULT_ENCRYPTION_KEY
 * env var, with no Supabase/network imports).
 */

/** Derive a 256-bit AES-GCM key from the configured VAULT_ENCRYPTION_KEY. */
export async function getEncryptionKey(): Promise<CryptoKey> {
  const keyMaterial = Deno.env.get('VAULT_ENCRYPTION_KEY');
  if (!keyMaterial) {
    throw new Error('VAULT_ENCRYPTION_KEY not configured');
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyMaterial);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);

  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt plaintext, returning base64(IV || ciphertext). */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/** Decrypt a base64(IV || ciphertext) string produced by encrypt(). */
export async function decrypt(encryptedBase64: string): Promise<string> {
  const key = await getEncryptionKey();

  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

  // Extract IV (first 12 bytes) and encrypted data
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
