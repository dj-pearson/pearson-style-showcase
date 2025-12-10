/**
 * Remember Device Checkbox Component
 *
 * A checkbox component for the "Remember this device" feature during MFA verification.
 * When checked, the device will be trusted and MFA will be skipped on future logins.
 */

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Shield, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RememberDeviceCheckboxProps {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Callback when the checkbox changes */
  onCheckedChange: (checked: boolean) => void;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Number of days the trust will last */
  trustDays?: number;
  /** Additional CSS classes */
  className?: string;
  /** Show detailed tooltip */
  showTooltip?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

export const RememberDeviceCheckbox: React.FC<RememberDeviceCheckboxProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  trustDays = 30,
  className,
  showTooltip = true,
  compact = false,
}) => {
  const content = (
    <div className={cn('flex items-start gap-3', compact && 'items-center', className)}>
      <Checkbox
        id="remember-device"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="space-y-1">
        <Label
          htmlFor="remember-device"
          className={cn(
            'flex items-center gap-2 cursor-pointer',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Shield className={cn('h-4 w-4', checked ? 'text-primary' : 'text-muted-foreground')} />
          <span>Remember this device</span>
          {showTooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm">
                    When enabled, you won't need to complete MFA verification on this device
                    for the next {trustDays} days.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only use on personal devices you trust.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </Label>
        {!compact && (
          <p className="text-xs text-muted-foreground">
            Skip MFA verification for {trustDays} days on this browser
          </p>
        )}
      </div>
    </div>
  );

  return content;
};

/**
 * Inline version for use in forms
 */
export const RememberDeviceInline: React.FC<
  Omit<RememberDeviceCheckboxProps, 'compact' | 'showTooltip'>
> = (props) => {
  return <RememberDeviceCheckbox {...props} compact showTooltip />;
};

export default RememberDeviceCheckbox;
