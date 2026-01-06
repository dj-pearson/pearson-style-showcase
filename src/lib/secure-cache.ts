/**
 * Secure Cache Utilities
 *
 * Provides encrypted localStorage caching to protect sensitive data
 * from XSS attacks. Uses AES-GCM encryption with a key derived from
 * a combination of user ID and a random salt stored in sessionStorage.
 */

import { logger } from '@/lib/logger';

// Salt storage key (in sessionStorage - survives page reloads, not tab closes)
const CACHE_SALT_KEY = 'secure_cache_salt';

// Encryption algorithm
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Get or generate cache salt
 * Salt is stored in sessionStorage so it survives page reloads
 * but is cleared when the browser tab is closed
 */
function getOrCreateSalt(): string {
  try {
    let salt = sessionStorage.getItem(CACHE_SALT_KEY);
    if (!salt) {
      // Generate a new random salt
      const saltBytes = new Uint8Array(16);
      crypto.getRandomValues(saltBytes);
      salt = Array.from(saltBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      sessionStorage.setItem(CACHE_SALT_KEY, salt);
    }
    return salt;
  } catch {
    // Fallback to a random salt if sessionStorage fails
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    return Array.from(saltBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

/**
 * Clear the cache salt (called on logout)
 */
export function clearCacheSalt(): void {
  try {
    sessionStorage.removeItem(CACHE_SALT_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Derive an encryption key from user ID and salt
 */
async function deriveKey(userId: string): Promise<CryptoKey> {
  const salt = getOrCreateSalt();
  const keyMaterial = `${userId}:${salt}`;

  // Import the key material
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyMaterial);

  // Use SHA-256 to create a fixed-length key
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);

  // Import as AES key
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data for storage
 */
async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    dataBuffer
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt stored data
 */
async function decryptData(encryptedBase64: string, key: CryptoKey): Promise<string> {
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, IV_LENGTH);
  const encryptedData = combined.slice(IV_LENGTH);

  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    encryptedData
  );

  // Convert back to string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Securely store data in localStorage with encryption
 * @param key - The storage key
 * @param data - The data to store (will be JSON serialized)
 * @param userId - User ID used for key derivation
 */
export async function secureSet<T>(
  key: string,
  data: T,
  userId: string
): Promise<boolean> {
  try {
    const jsonData = JSON.stringify(data);
    const cryptoKey = await deriveKey(userId);
    const encrypted = await encryptData(jsonData, cryptoKey);

    localStorage.setItem(key, encrypted);
    return true;
  } catch (err) {
    logger.warn('Failed to securely store data:', err);
    return false;
  }
}

/**
 * Retrieve and decrypt data from localStorage
 * @param key - The storage key
 * @param userId - User ID used for key derivation
 * @returns The decrypted data or null if not found/invalid
 */
export async function secureGet<T>(
  key: string,
  userId: string
): Promise<T | null> {
  try {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;

    const cryptoKey = await deriveKey(userId);
    const decrypted = await decryptData(encrypted, cryptoKey);

    return JSON.parse(decrypted) as T;
  } catch (err) {
    // Decryption failed - data may be corrupted or from different session
    logger.debug('Failed to decrypt cached data (expected on new session):', err);
    // Clean up invalid cache
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore cleanup errors
    }
    return null;
  }
}

/**
 * Remove cached data
 * @param key - The storage key
 */
export function secureRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

/**
 * Check if Web Crypto API is available
 */
export function isSecureCacheAvailable(): boolean {
  try {
    return !!(
      window.crypto &&
      window.crypto.subtle &&
      typeof window.crypto.getRandomValues === 'function'
    );
  } catch {
    return false;
  }
}
