/**
 * Device Trust Service
 *
 * Handles "Remember this device" functionality for reducing MFA friction.
 * Uses browser fingerprinting and secure tokens to identify trusted devices.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

// Constants
const TRUST_TOKEN_KEY = 'device_trust_token';
const DEVICE_ID_KEY = 'device_trust_id';
const FINGERPRINT_KEY = 'device_fingerprint';
const TRUST_DURATION_DAYS = 30;

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
        const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        components.push(renderer);
      }
    }
  } catch {
    components.push('webgl-blocked');
  }

  // Audio context fingerprint (simplified)
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (AudioContext) {
      const audioCtx = new AudioContext();
      components.push(audioCtx.sampleRate.toString());
      audioCtx.close();
    }
  } catch {
    components.push('audio-blocked');
  }

  // Create hash of components
  const data = components.join('|');
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return fingerprint;
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
  return `trust_${timestamp}_${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Store trust token in local storage
 */
export function storeTrustToken(token: string, deviceId: string, fingerprint: string): void {
  try {
    localStorage.setItem(TRUST_TOKEN_KEY, token);
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    localStorage.setItem(FINGERPRINT_KEY, fingerprint);
  } catch (error) {
    logger.warn('Failed to store trust token:', error);
  }
}

/**
 * Get stored trust token
 */
export function getStoredTrustToken(): { token: string; deviceId: string; fingerprint: string } | null {
  try {
    const token = localStorage.getItem(TRUST_TOKEN_KEY);
    const deviceId = localStorage.getItem(DEVICE_ID_KEY);
    const fingerprint = localStorage.getItem(FINGERPRINT_KEY);

    if (token && deviceId && fingerprint) {
      return { token, deviceId, fingerprint };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear stored trust token
 */
export function clearTrustToken(): void {
  try {
    localStorage.removeItem(TRUST_TOKEN_KEY);
    localStorage.removeItem(DEVICE_ID_KEY);
    localStorage.removeItem(FINGERPRINT_KEY);
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
    const stored = getStoredTrustToken();
    if (!stored) {
      return { trusted: false };
    }

    // Verify fingerprint still matches
    const currentFingerprint = await generateDeviceFingerprint();
    if (currentFingerprint !== stored.fingerprint) {
      // Fingerprint changed, clear old token
      clearTrustToken();
      return { trusted: false };
    }

    // Verify token with database
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
      // Update last used timestamp
      await supabase.rpc('update_device_last_used', {
        _device_id: data[0].device_id,
        _ip_address: null, // Will be set by server
      });

      return {
        trusted: true,
        deviceId: data[0].device_id,
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

    const { data, error } = await supabase.rpc('upsert_trusted_device', {
      _user_id: userId,
      _device_fingerprint: deviceInfo.fingerprint,
      _device_name: deviceInfo.deviceName,
      _device_type: deviceInfo.deviceType,
      _browser: deviceInfo.browser,
      _operating_system: deviceInfo.operatingSystem,
      _ip_address: null, // Will be set by server
      _trust_token: trustToken,
      _verification_method: verificationMethod,
      _expires_in_days: trustDurationDays,
    });

    if (error) {
      logger.error('Failed to trust device:', error);
      return { success: false, error: error.message };
    }

    const deviceId = data as string;

    // Store token locally
    storeTrustToken(trustToken, deviceId, deviceInfo.fingerprint);

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
    const stored = getStoredTrustToken();
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
export function getCurrentDeviceId(): string | null {
  const stored = getStoredTrustToken();
  return stored?.deviceId || null;
}

// Export type for table
export type { TrustedDevice as TrustedDeviceRow };
