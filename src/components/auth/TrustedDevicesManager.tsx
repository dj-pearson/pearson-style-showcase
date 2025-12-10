/**
 * Trusted Devices Manager Component
 *
 * Allows users to view and manage their trusted devices.
 * Shows device information, last used date, and allows revoking trust.
 */

import React, { useState, useEffect } from 'react';
import { useDeviceTrust } from '@/hooks/useDeviceTrust';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
  Shield,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Clock,
  MapPin,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { TrustedDevice } from '@/lib/device-trust';

interface TrustedDevicesManagerProps {
  showCurrentDeviceActions?: boolean;
  className?: string;
}

const DeviceIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'mobile':
      return <Smartphone className="h-5 w-5" />;
    case 'tablet':
      return <Tablet className="h-5 w-5" />;
    default:
      return <Monitor className="h-5 w-5" />;
  }
};

export const TrustedDevicesManager: React.FC<TrustedDevicesManagerProps> = ({
  showCurrentDeviceActions = true,
  className,
}) => {
  const {
    isTrusted,
    currentDeviceId,
    currentDeviceName,
    isLoading,
    error,
    trust,
    revokeDevice,
    revokeAllDevices,
    getAllDevices,
    refresh,
  } = useDeviceTrust();

  const { toast } = useToast();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // Load devices on mount
  useEffect(() => {
    const loadDevices = async () => {
      setLoadingDevices(true);
      const deviceList = await getAllDevices();
      setDevices(deviceList);
      setLoadingDevices(false);
    };
    loadDevices();
  }, [getAllDevices]);

  const handleTrustDevice = async () => {
    const success = await trust({ verificationMethod: 'mfa' });
    if (success) {
      toast({
        title: 'Device trusted',
        description: 'This device is now trusted and MFA will be skipped for future logins.',
      });
      const deviceList = await getAllDevices();
      setDevices(deviceList);
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to trust device',
        description: error || 'An error occurred while trusting this device.',
      });
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    setRevoking(deviceId);
    const success = await revokeDevice(deviceId);
    setRevoking(null);

    if (success) {
      toast({
        title: 'Device trust revoked',
        description: 'The device has been removed from your trusted devices.',
      });
      setDevices(devices.filter((d) => d.id !== deviceId));
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to revoke trust',
        description: error || 'An error occurred while revoking device trust.',
      });
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    const success = await revokeAllDevices();
    setRevokingAll(false);

    if (success) {
      toast({
        title: 'All devices untrusted',
        description: 'All trusted devices have been removed. MFA will be required for all logins.',
      });
      setDevices([]);
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to revoke all',
        description: error || 'An error occurred while revoking all device trusts.',
      });
    }
  };

  const handleRefresh = async () => {
    await refresh();
    const deviceList = await getAllDevices();
    setDevices(deviceList);
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Trusted Devices
          </CardTitle>
          <CardDescription>
            Manage devices that can skip MFA verification
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || loadingDevices}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingDevices ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {devices.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={revokingAll}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Revoke All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke all trusted devices?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove trust from all devices. You will need to complete MFA
                    verification on all future logins until you trust devices again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRevokeAll}>
                    Revoke All Devices
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current device status */}
        {showCurrentDeviceActions && (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isTrusted ? (
                  <ShieldCheck className="h-6 w-6 text-green-500" />
                ) : (
                  <Shield className="h-6 w-6 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">Current Device</p>
                  <p className="text-sm text-muted-foreground">
                    {isTrusted ? currentDeviceName : 'Not trusted'}
                  </p>
                </div>
              </div>
              {isTrusted ? (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  Trusted
                </Badge>
              ) : (
                <Button onClick={handleTrustDevice} disabled={isLoading}>
                  Trust This Device
                </Button>
              )}
            </div>
            {isTrusted && (
              <p className="text-xs text-muted-foreground mt-2">
                MFA verification will be skipped on this device until trust expires.
              </p>
            )}
          </div>
        )}

        {/* Loading state */}
        {loadingDevices && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* No devices message */}
        {!loadingDevices && devices.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No trusted devices</p>
            <p className="text-sm">
              Trust a device to skip MFA verification on future logins.
            </p>
          </div>
        )}

        {/* Device list */}
        {!loadingDevices && devices.length > 0 && (
          <div className="space-y-2">
            {devices.map((device) => {
              const isCurrentDevice = device.id === currentDeviceId;
              const expiresAt = new Date(device.expires_at);
              const isExpiringSoon = expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000; // 7 days

              return (
                <div
                  key={device.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    isCurrentDevice ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <DeviceIcon type={device.device_type} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{device.device_name}</p>
                          {isCurrentDevice && (
                            <Badge variant="outline" className="text-xs">
                              Current
                            </Badge>
                          )}
                          {isExpiringSoon && !isCurrentDevice && (
                            <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Expiring Soon
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(device.last_used_at), { addSuffix: true })}
                          </span>
                          {device.ip_address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {device.ip_address}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {device.browser} • {device.operating_system}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires {formatDistanceToNow(expiresAt, { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={revoking === device.id}
                        >
                          {revoking === device.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke device trust?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {isCurrentDevice ? (
                              <>
                                This is your current device. Revoking trust will require you to
                                complete MFA verification on your next login.
                              </>
                            ) : (
                              <>
                                Remove trust from <strong>{device.device_name}</strong>? This
                                device will need to complete MFA verification on the next login.
                              </>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRevokeDevice(device.id)}>
                            Revoke Trust
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Security note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Security Recommendation</p>
            <p>
              Only trust devices you personally own. Revoke trust immediately if a device is
              lost, stolen, or compromised.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrustedDevicesManager;
