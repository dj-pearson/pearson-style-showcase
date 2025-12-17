/**
 * Device Trust Hook
 *
 * React hook for managing device trust status and operations.
 * Provides methods to trust/untrust devices and check current trust status.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isDeviceTrusted,
  trustDevice,
  revokeDeviceTrust,
  revokeAllDeviceTrust,
  getTrustedDevices,
  getCurrentDeviceId,
  getFullDeviceInfo,
  type TrustedDevice,
  type DeviceInfo,
  type TrustDeviceOptions,
} from '@/lib/device-trust';

interface UseDeviceTrustReturn {
  /** Whether the current device is trusted */
  isTrusted: boolean;
  /** ID of the current trusted device (if any) */
  currentDeviceId: string | null;
  /** Name of the current trusted device (if any) */
  currentDeviceName: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Trust the current device */
  trust: (options?: TrustDeviceOptions) => Promise<boolean>;
  /** Revoke trust for the current device */
  revokeCurrentDevice: () => Promise<boolean>;
  /** Revoke trust for a specific device by ID */
  revokeDevice: (deviceId: string) => Promise<boolean>;
  /** Revoke trust for all devices */
  revokeAllDevices: () => Promise<boolean>;
  /** Get all trusted devices */
  getAllDevices: () => Promise<TrustedDevice[]>;
  /** Get information about the current device */
  getDeviceInfo: () => Promise<DeviceInfo>;
  /** Refresh trust status */
  refresh: () => Promise<void>;
}

export function useDeviceTrust(): UseDeviceTrustReturn {
  const { user, isAuthenticated } = useAuth();
  const [isTrusted, setIsTrusted] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [currentDeviceName, setCurrentDeviceName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check trust status when user changes
  const checkTrustStatus = useCallback(async () => {
    if (!user?.id || !isAuthenticated) {
      setIsTrusted(false);
      setCurrentDeviceId(null);
      setCurrentDeviceName(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await isDeviceTrusted(user.id);
      setIsTrusted(result.trusted);
      setCurrentDeviceId(result.deviceId || null);
      setCurrentDeviceName(result.deviceName || null);
    } catch (err) {
      setError('Failed to check device trust status');
      setIsTrusted(false);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isAuthenticated]);

  useEffect(() => {
    checkTrustStatus();
  }, [checkTrustStatus]);

  // Trust the current device
  const trust = useCallback(
    async (options?: TrustDeviceOptions): Promise<boolean> => {
      if (!user?.id) {
        setError('User not authenticated');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await trustDevice(user.id, options);

        if (result.success && result.deviceId) {
          setIsTrusted(true);
          setCurrentDeviceId(result.deviceId);

          // Get device name
          const deviceInfo = await getFullDeviceInfo();
          setCurrentDeviceName(deviceInfo.deviceName);
          return true;
        } else {
          setError(result.error || 'Failed to trust device');
          return false;
        }
      } catch (err) {
        setError('Failed to trust device');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id]
  );

  // Revoke trust for the current device
  const revokeCurrentDevice = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      setError('User not authenticated');
      return false;
    }

    const deviceId = getCurrentDeviceId();
    if (!deviceId) {
      setError('No trusted device found');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await revokeDeviceTrust(deviceId, user.id);

      if (result.success) {
        setIsTrusted(false);
        setCurrentDeviceId(null);
        setCurrentDeviceName(null);
        return true;
      } else {
        setError(result.error || 'Failed to revoke device trust');
        return false;
      }
    } catch (err) {
      setError('Failed to revoke device trust');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Revoke trust for a specific device
  const revokeDevice = useCallback(
    async (deviceId: string): Promise<boolean> => {
      if (!user?.id) {
        setError('User not authenticated');
        return false;
      }

      setError(null);

      try {
        const result = await revokeDeviceTrust(deviceId, user.id);

        if (result.success) {
          // Check if we revoked the current device
          if (deviceId === currentDeviceId) {
            setIsTrusted(false);
            setCurrentDeviceId(null);
            setCurrentDeviceName(null);
          }
          return true;
        } else {
          setError(result.error || 'Failed to revoke device trust');
          return false;
        }
      } catch (err) {
        setError('Failed to revoke device trust');
        return false;
      }
    },
    [user?.id, currentDeviceId]
  );

  // Revoke trust for all devices
  const revokeAllDevices = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      setError('User not authenticated');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await revokeAllDeviceTrust(user.id);

      if (result.success) {
        setIsTrusted(false);
        setCurrentDeviceId(null);
        setCurrentDeviceName(null);
        return true;
      } else {
        setError(result.error || 'Failed to revoke all device trusts');
        return false;
      }
    } catch (err) {
      setError('Failed to revoke all device trusts');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Get all trusted devices
  const getAllDevices = useCallback(async (): Promise<TrustedDevice[]> => {
    if (!user?.id) {
      setError('User not authenticated');
      return [];
    }

    try {
      const result = await getTrustedDevices(user.id);

      if (result.error) {
        setError(result.error);
        return [];
      }

      return result.devices;
    } catch (err) {
      setError('Failed to get trusted devices');
      return [];
    }
  }, [user?.id]);

  // Get current device info
  const getDeviceInfo = useCallback(async (): Promise<DeviceInfo> => {
    return getFullDeviceInfo();
  }, []);

  // Refresh trust status
  const refresh = useCallback(async (): Promise<void> => {
    await checkTrustStatus();
  }, [checkTrustStatus]);

  return {
    isTrusted,
    currentDeviceId,
    currentDeviceName,
    isLoading,
    error,
    trust,
    revokeCurrentDevice,
    revokeDevice,
    revokeAllDevices,
    getAllDevices,
    getDeviceInfo,
    refresh,
  };
}

export default useDeviceTrust;
