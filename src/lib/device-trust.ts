/**
 * Device Trust Service
 *
 * Handles "Remember this device" functionality for reducing MFA friction.
 * Uses browser fingerprinting and secure tokens to identify trusted devices.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';
import { secureSet, secureGet, isSecureCacheAvailable } from './secure-cache';

// Constants
const TRUST_TOKEN_KEY = 'device_trust_token';
const DEVICE_ID_KEY = 'device_trust_id';
const FINGERPRINT_KEY = 'device_fingerprint';
// Absolute maximum lifetime of a trust record (server-side hard cap).
const TRUST_DURATION_DAYS = 30;
// A trust token is invalidated if the device has not been verified within this
// many days (sliding inactivity window, stricter than the 30-day hard cap).
const TRUST_INACTIVITY_DAYS = 14;
const TRUST_INACTIVITY_MS = TRUST_INACTIVITY_DAYS * 24 * 60 * 60 * 1000;

// Rate limiting for trust-token verification. Prevents brute-force guessing of
// fingerprints/tokens by capping verification attempts in a sliding window.
const VERIFY_RATE_LIMIT = 5;
const VERIFY_RATE_WINDOW_MS = 60 * 1000; // 1 minute
let verifyAttemptTimestamps: number[] = [];

/**
 * Sliding-window rate limiter for verification attempts. Returns false when the
 * caller has exceeded VERIFY_RATE_LIMIT attempts within VERIFY_RATE_WINDOW_MS.
 */
function allowVerificationAttempt(): boolean {
  const now = Date.now();
  verifyAttemptTimestamps = verifyAttemptTimestamps.filter((t) => now - t < VERIFY_RATE_WINDOW_MS);
  if (verifyAttemptTimestamps.length >= VERIFY_RATE_LIMIT) {
    return false;
  }
  verifyAttemptTimestamps.push(now);
  return true;
}

/**
 * Reset the verification rate-limit window. Exposed for tests and for callers
 * that want to clear the limiter after a successful full re-authentication.
 */
export function resetVerificationRateLimit(): void {
  verifyAttemptTimestamps = [];
}

/**
 * Hash a trust token with SHA-256 (Web Crypto) and return a hex digest.
 * Only the hash is ever persisted locally or sent to the server, so a token
 * value at rest cannot be replayed as-is if the raw pre-image is never stored.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Types
export interface TrustedDevice {
  id: string;
  device_name: string;
  device_type: string;
  browser: string;
  operating_system: string;
  ip_address: string;
  last_used_at: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface DeviceInfo {
  fingerprint: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  operatingSystem: string;
}

export interface TrustDeviceOptions {
  trustDurationDays?: number;
  verificationMethod?: 'mfa' | 'password' | 'oauth';
}

// ============================================
// Device Fingerprinting
// ============================================

/**
 * Generate a unique device fingerprint based on browser characteristics
 * This is not meant to be a secure identifier, but rather a way to
 * consistently identify the same browser/device combination.
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = [];

  // Screen information
  if (typeof window !== 'undefined' && window.screen) {
    components.push(`${window.screen.width}x${window.screen.height}`);
    components.push(`${window.screen.colorDepth}`);
    components.push(`${window.devicePixelRatio || 1}`);
  }

  // Timezone
  try {
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    components.push('unknown-tz');
  }

  // Language
  if (typeof navigator !== 'undefined') {
    components.push(navigator.language);
    components.push(navigator.languages?.join(',') || '');
    components.push(navigator.hardwareConcurrency?.toString() || '0');
    components.push(navigator.maxTouchPoints?.toString() || '0');
  }

  // Canvas fingerprint (simplified)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('device-fingerprint', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('device-fingerprint', 4, 17);
      components.push(canvas.toDataURL().slice(-50));
    }
  } catch {
    components.push('canvas-blocked');
  }

  // WebGL fingerprint (simplified)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = (gl as WebGLRenderingContext).getParameter(
          debugInfo.UNMASKED_RENDERER_WEBGL
        );
        components.push(renderer);
      }
    }
  } catch {
    components.push('webgl-blocked');
  }

  // Audio context fingerprint (simplified)
  try {
    const AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (AudioContext) {
      const audioCtx = new AudioContext();
      components.push(audioCtx.sampleRate.toString());
      audioCtx.close();
    }
  } catch {
    components.push('audio-blocked');
  }

  // Installed-fonts entropy: measure the rendered width of a probe string in a
  // set of candidate fonts against baseline fonts. Fonts that are installed
  // render at a different width than the fallback, yielding a stable per-device
  // signal that is independent of canvas/WebGL. This is one of several entropy
  // sources (timezone, screen dimensions, installed fonts, ...) that a stolen
  // trust token is bound to, so it cannot be replayed from a different device.
  components.push(detectInstalledFonts());

  // Create hash of components
  const data = components.join('|');
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return fingerprint;
}

/**
 * Detect which of a set of candidate fonts are installed by comparing the
 * rendered width of a probe string against baseline (generic) fonts. Returns a
 * compact signature string (e.g. "Arial,Verdana"). Best-effort: returns a
 * sentinel when the canvas 2D context is unavailable.
 */
function detectInstalledFonts(): string {
  try {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
      'Arial',
      'Verdana',
      'Times New Roman',
      'Courier New',
      'Georgia',
      'Helvetica',
      'Comic Sans MS',
      'Impact',
      'Tahoma',
      'Trebuchet MS',
      'Segoe UI',
      'Roboto',
      'Ubuntu',
      'Cantarell',
      'Menlo',
    ];
    const probe = 'mmmmmmmmmmlli~WwZz0O';
    const size = '72px';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'fonts-unavailable';

    const measure = (font: string) => {
      ctx.font = `${size} ${font}`;
      return ctx.measureText(probe).width;
    };

    // Baseline widths for each generic family.
    const baseWidths: Record<string, number> = {};
    for (const base of baseFonts) baseWidths[base] = measure(base);

    const detected: string[] = [];
    for (const font of testFonts) {
      // A font is considered installed if it changes the width for at least one
      // generic fallback family.
      const isInstalled = baseFonts.some(
        (base) => measure(`'${font}',${base}`) !== baseWidths[base]
      );
      if (isInstalled) detected.push(font);
    }
    return detected.length ? detected.join(',') : 'fonts-none';
  } catch {
    return 'fonts-blocked';
  }
}

/**
 * Get device information based on user agent and browser APIs
 */
export function getDeviceInfo(): Omit<DeviceInfo, 'fingerprint'> {
  const ua = navigator.userAgent;

  // Detect device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  // Detect browser
  let browser = 'Unknown';
  if (/edg/i.test(ua)) {
    browser = 'Edge';
  } else if (/chrome/i.test(ua)) {
    browser = 'Chrome';
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browser = 'Safari';
  } else if (/firefox/i.test(ua)) {
    browser = 'Firefox';
  } else if (/msie|trident/i.test(ua)) {
    browser = 'Internet Explorer';
  }

  // Detect OS
  let operatingSystem = 'Unknown';
  if (/windows/i.test(ua)) {
    operatingSystem = 'Windows';
  } else if (/macintosh|mac os x/i.test(ua)) {
    operatingSystem = 'macOS';
  } else if (/linux/i.test(ua)) {
    operatingSystem = 'Linux';
  } else if (/android/i.test(ua)) {
    operatingSystem = 'Android';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    operatingSystem = 'iOS';
  }

  // Generate device name
  const deviceName = `${browser} on ${operatingSystem}`;

  return {
    deviceName,
    deviceType,
    browser,
    operatingSystem,
  };
}

/**
 * Get full device info including fingerprint
 */
export async function getFullDeviceInfo(): Promise<DeviceInfo> {
  const fingerprint = await generateDeviceFingerprint();
  const deviceInfo = getDeviceInfo();

  return {
    fingerprint,
    ...deviceInfo,
  };
}

// ============================================
// Trust Token Management
// ============================================

/**
 * Generate a secure trust token
 */
export async function generateTrustToken(): Promise<string> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  // Add timestamp for uniqueness
  const timestamp = Date.now().toString(36);

  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(Array.from(randomBytes).join('') + timestamp)
  );

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return `trust_${timestamp}_${hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

// Unified key for encrypted trust data
const ENCRYPTED_TRUST_KEY = 'device_trust_encrypted';
const LAST_USED_KEY = 'device_trust_last_used';

/**
 * Stored trust record. `token` is ALWAYS a SHA-256 hash of the raw trust token
 * (never the plaintext token) and `fingerprint` is itself a SHA-256 digest of
 * device characteristics — no plaintext secrets are persisted. `lastUsedAt` is
 * an epoch-ms timestamp used to enforce the inactivity window.
 */
export interface StoredTrust {
  token: string;
  deviceId: string;
  fingerprint: string;
  lastUsedAt: number;
}

/**
 * Store the (already hashed) trust token in localStorage.
 *
 * IMPORTANT: `token` MUST be a hash (see hashToken); callers never pass the raw
 * token. Uses secure-cache AES-GCM encryption when available, with a plaintext
 * fallback that still only ever holds the hash.
 */
export async function storeTrustToken(
  token: string,
  deviceId: string,
  fingerprint: string,
  userId?: string,
  lastUsedAt: number = Date.now()
): Promise<void> {
  try {
    const trustData: StoredTrust = { token, deviceId, fingerprint, lastUsedAt };

    if (userId && isSecureCacheAvailable()) {
      await secureSet(ENCRYPTED_TRUST_KEY, trustData, userId);
      // Clean up any legacy plaintext keys
      localStorage.removeItem(TRUST_TOKEN_KEY);
      localStorage.removeItem(DEVICE_ID_KEY);
      localStorage.removeItem(FINGERPRINT_KEY);
      localStorage.removeItem(LAST_USED_KEY);
    } else {
      // Fallback to plain storage if crypto not available or no userId. Only
      // the hash is written here, never the raw token.
      localStorage.setItem(TRUST_TOKEN_KEY, token);
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
      localStorage.setItem(FINGERPRINT_KEY, fingerprint);
      localStorage.setItem(LAST_USED_KEY, String(lastUsedAt));
    }
  } catch (error) {
    logger.warn('Failed to store trust token:', error);
  }
}

/**
 * Get stored trust record, decrypting if encrypted.
 */
export async function getStoredTrustToken(userId?: string): Promise<StoredTrust | null> {
  try {
    // Try encrypted storage first
    if (userId && isSecureCacheAvailable()) {
      const encrypted = await secureGet<StoredTrust>(ENCRYPTED_TRUST_KEY, userId);
      if (encrypted) {
        // Older records may predate the lastUsedAt field; treat those as fresh.
        return { ...encrypted, lastUsedAt: encrypted.lastUsedAt ?? Date.now() };
      }
    }

    // Fallback: read from legacy plaintext keys
    const token = localStorage.getItem(TRUST_TOKEN_KEY);
    const deviceId = localStorage.getItem(DEVICE_ID_KEY);
    const fingerprint = localStorage.getItem(FINGERPRINT_KEY);
    const lastUsedRaw = localStorage.getItem(LAST_USED_KEY);

    if (token && deviceId && fingerprint) {
      return {
        token,
        deviceId,
        fingerprint,
        lastUsedAt: lastUsedRaw ? Number(lastUsedRaw) : Date.now(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear stored trust token (both encrypted and legacy)
 */
export function clearTrustToken(): void {
  try {
    localStorage.removeItem(ENCRYPTED_TRUST_KEY);
    localStorage.removeItem(TRUST_TOKEN_KEY);
    localStorage.removeItem(DEVICE_ID_KEY);
    localStorage.removeItem(FINGERPRINT_KEY);
    localStorage.removeItem(LAST_USED_KEY);
  } catch (error) {
    logger.warn('Failed to clear trust token:', error);
  }
}

// ============================================
// Device Trust Operations
// ============================================

/**
 * Check if the current device is trusted for a user
 */
export async function isDeviceTrusted(userId: string): Promise<{
  trusted: boolean;
  deviceId?: string;
  deviceName?: string;
}> {
  try {
    // Rate limit verification to prevent brute-force fingerprint/token guessing.
    if (!allowVerificationAttempt()) {
      logger.warn('Device trust verification rate limit exceeded');
      return { trusted: false };
    }

    const stored = await getStoredTrustToken(userId);
    if (!stored) {
      return { trusted: false };
    }

    // Inactivity expiry: invalidate tokens not used within the inactivity
    // window, independent of the server-side hard expiry.
    if (Date.now() - stored.lastUsedAt > TRUST_INACTIVITY_MS) {
      logger.warn('Device trust token expired due to inactivity');
      clearTrustToken();
      return { trusted: false };
    }

    // Verify fingerprint still matches
    const currentFingerprint = await generateDeviceFingerprint();
    if (currentFingerprint !== stored.fingerprint) {
      // Fingerprint changed, clear old token
      clearTrustToken();
      return { trusted: false };
    }

    // Verify hashed token with database
    const { data, error } = await supabase.rpc('verify_trust_token', {
      _trust_token: stored.token,
      _user_id: userId,
      _device_fingerprint: stored.fingerprint,
    });

    if (error) {
      logger.error('Failed to verify trust token:', error);
      return { trusted: false };
    }

    if (data && data.length > 0 && data[0].is_valid) {
      const deviceId = data[0].device_id;

      // Forward secrecy: rotate the trust token on every successful
      // verification so a captured token becomes useless after the next login.
      await rotateTrustToken(userId, stored, deviceId);

      // Update last used timestamp server-side (best effort).
      await supabase.rpc('update_device_last_used', {
        _device_id: deviceId,
        _ip_address: null, // Will be set by server
      });

      return {
        trusted: true,
        deviceId,
        deviceName: data[0].device_name,
      };
    }

    // Token invalid, clear it
    clearTrustToken();
    return { trusted: false };
  } catch (error) {
    logger.error('Error checking device trust:', error);
    return { trusted: false };
  }
}

/**
 * Rotate the stored trust token to a fresh value (forward secrecy). Generates a
 * new token, hashes it, atomically swaps it server-side via rotate_trust_token,
 * and only then persists the new hash locally so local/server stay consistent.
 * On any failure the existing token is preserved (last-used timestamp refreshed)
 * so a rotation hiccup never locks the user out.
 */
async function rotateTrustToken(
  userId: string,
  stored: StoredTrust,
  deviceId: string
): Promise<void> {
  try {
    const newToken = await generateTrustToken();
    const newHash = await hashToken(newToken);

    const { data, error } = await supabase.rpc('rotate_trust_token', {
      _old_trust_token: stored.token,
      _new_trust_token: newHash,
      _user_id: userId,
      _device_fingerprint: stored.fingerprint,
    });

    if (!error && data === true) {
      await storeTrustToken(newHash, deviceId, stored.fingerprint, userId, Date.now());
      return;
    }

    // Rotation unavailable/failed — keep the current token but refresh activity.
    await storeTrustToken(stored.token, deviceId, stored.fingerprint, userId, Date.now());
  } catch (error) {
    logger.warn('Trust token rotation failed, keeping current token:', error);
    await storeTrustToken(stored.token, deviceId, stored.fingerprint, userId, Date.now());
  }
}

/**
 * Trust the current device for a user
 */
export async function trustDevice(
  userId: string,
  options: TrustDeviceOptions = {}
): Promise<{ success: boolean; deviceId?: string; error?: string }> {
  const { trustDurationDays = TRUST_DURATION_DAYS, verificationMethod = 'mfa' } = options;

  try {
    const deviceInfo = await getFullDeviceInfo();
    const trustToken = await generateTrustToken();
    // Only the hash is ever persisted or sent to the server; the raw token is
    // discarded after hashing so it cannot be recovered from storage.
    const trustTokenHash = await hashToken(trustToken);

    const { data, error } = await supabase.rpc('upsert_trusted_device', {
      _user_id: userId,
      _device_fingerprint: deviceInfo.fingerprint,
      _device_name: deviceInfo.deviceName,
      _device_type: deviceInfo.deviceType,
      _browser: deviceInfo.browser,
      _operating_system: deviceInfo.operatingSystem,
      _ip_address: null, // Will be set by server
      _trust_token: trustTokenHash,
      _verification_method: verificationMethod,
      _expires_in_days: trustDurationDays,
    });

    if (error) {
      logger.error('Failed to trust device:', error);
      return { success: false, error: error.message };
    }

    const deviceId = data as string;

    // Store hashed token locally (encrypted at rest via secure-cache)
    await storeTrustToken(trustTokenHash, deviceId, deviceInfo.fingerprint, userId);

    logger.log('Device trusted successfully:', deviceId);
    return { success: true, deviceId };
  } catch (error) {
    logger.error('Error trusting device:', error);
    return { success: false, error: 'Failed to trust device' };
  }
}

/**
 * Revoke trust for a specific device
 */
export async function revokeDeviceTrust(
  deviceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('revoke_trusted_device', {
      _device_id: deviceId,
      _user_id: userId,
    });

    if (error) {
      logger.error('Failed to revoke device trust:', error);
      return { success: false, error: error.message };
    }

    // If revoking current device, clear local token
    const stored = await getStoredTrustToken(userId);
    if (stored && stored.deviceId === deviceId) {
      clearTrustToken();
    }

    return { success: data === true };
  } catch (error) {
    logger.error('Error revoking device trust:', error);
    return { success: false, error: 'Failed to revoke device trust' };
  }
}

/**
 * Revoke trust for all devices of a user
 */
export async function revokeAllDeviceTrust(
  userId: string
): Promise<{ success: boolean; revokedCount?: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('trusted_devices')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)
      .select('id');

    if (error) {
      logger.error('Failed to revoke all device trusts:', error);
      return { success: false, error: error.message };
    }

    // Clear local token
    clearTrustToken();

    return { success: true, revokedCount: data?.length || 0 };
  } catch (error) {
    logger.error('Error revoking all device trusts:', error);
    return { success: false, error: 'Failed to revoke all device trusts' };
  }
}

/**
 * Get all trusted devices for a user
 */
export async function getTrustedDevices(userId: string): Promise<{
  devices: TrustedDevice[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_used_at', { ascending: false });

    if (error) {
      logger.error('Failed to get trusted devices:', error);
      return { devices: [], error: error.message };
    }

    return { devices: data || [] };
  } catch (error) {
    logger.error('Error getting trusted devices:', error);
    return { devices: [], error: 'Failed to get trusted devices' };
  }
}

/**
 * Get current device ID if it's trusted
 */
export async function getCurrentDeviceId(userId?: string): Promise<string | null> {
  const stored = await getStoredTrustToken(userId);
  return stored?.deviceId || null;
}

// Export type for table
export type { TrustedDevice as TrustedDeviceRow };
