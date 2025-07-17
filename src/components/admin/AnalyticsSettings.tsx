import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { BarChart3, Save, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface AnalyticsConfig {
  trackingId: string;
  enabled: boolean;
  trackEvents: boolean;
  trackScrolling: boolean;
  trackFormSubmissions: boolean;
}

const AnalyticsSettings = () => {
  const [config, setConfig] = useState<AnalyticsConfig>({
    trackingId: '',
    enabled: false,
    trackEvents: true,
    trackScrolling: true,
    trackFormSubmissions: true,
  });
  const [showTrackingId, setShowTrackingId] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAnalyticsConfig();
  }, []);

  const loadAnalyticsConfig = () => {
    const savedConfig = localStorage.getItem('analytics_config');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (error) {
        console.error('Error loading analytics config:', error);
      }
    }
  };

  const saveAnalyticsConfig = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('analytics_config', JSON.stringify(config));
      
      // Update the global analytics configuration
      if (typeof window !== 'undefined' && config.enabled && config.trackingId) {
        // Reload the page to apply new analytics settings
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
      
      toast({
        title: "Analytics settings saved",
        description: config.enabled 
          ? "Google Analytics is now active with your tracking ID" 
          : "Analytics tracking has been disabled",
      });
    } catch (error) {
      toast({
        title: "Error saving settings",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isValidTrackingId = (id: string) => {
    // For GA4 Property ID (numeric) or tracking ID format
    return /^(G-[A-Z0-9-]+|\d+)$/i.test(id);
  };

  const getAnalyticsStatus = () => {
    if (!config.enabled) return { status: 'disabled', color: 'secondary' as const };
    if (!config.trackingId || !isValidTrackingId(config.trackingId)) {
      return { status: 'invalid', color: 'destructive' as const };
    }
    return { status: 'active', color: 'default' as const };
  };

  const status = getAnalyticsStatus();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Google Analytics Configuration</CardTitle>
                <CardDescription>
                  Set up Google Analytics to track website performance and user behavior
                </CardDescription>
              </div>
            </div>
            <Badge variant={status.color}>
              {status.status === 'active' && 'Active'}
              {status.status === 'disabled' && 'Disabled'}
              {status.status === 'invalid' && 'Invalid Config'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Analytics */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Enable Analytics Data Collection</Label>
              <p className="text-sm text-muted-foreground">
                Enable backend collection of Google Analytics data for dashboard metrics
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => setConfig(prev => ({ ...prev, enabled }))}
            />
          </div>

          {/* Tracking ID Input */}
          <div className="space-y-2">
            <Label htmlFor="trackingId" className="text-base font-medium">
              Google Analytics Property ID
            </Label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Input
                  id="trackingId"
                  type={showTrackingId ? 'text' : 'password'}
                  placeholder="GA4 Property ID (e.g., 123456789)"
                  value={config.trackingId}
                  onChange={(e) => setConfig(prev => ({ ...prev, trackingId: e.target.value }))}
                  className={!isValidTrackingId(config.trackingId) && config.trackingId ? 'border-destructive' : ''}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-8 w-8 p-0"
                  onClick={() => setShowTrackingId(!showTrackingId)}
                >
                  {showTrackingId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => window.open('https://analytics.google.com/', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Get ID
              </Button>
            </div>
            {config.trackingId && !isValidTrackingId(config.trackingId) && (
              <p className="text-sm text-destructive">
                Please enter a valid GA4 Property ID (e.g., 123456789) or tracking ID (e.g., G-XXXXXXXXXX)
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Find your Property ID in Google Analytics: Admin → Data Streams → Your Stream → Property ID
            </p>
          </div>

          {/* Advanced Settings */}
          {config.enabled && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-base font-medium">Tracking Options</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Event Tracking</Label>
                    <p className="text-xs text-muted-foreground">Track button clicks and user interactions</p>
                  </div>
                  <Switch
                    checked={config.trackEvents}
                    onCheckedChange={(trackEvents) => setConfig(prev => ({ ...prev, trackEvents }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Scroll Tracking</Label>
                    <p className="text-xs text-muted-foreground">Track how far users scroll on pages</p>
                  </div>
                  <Switch
                    checked={config.trackScrolling}
                    onCheckedChange={(trackScrolling) => setConfig(prev => ({ ...prev, trackScrolling }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Form Submissions</Label>
                    <p className="text-xs text-muted-foreground">Track contact form and newsletter signups</p>
                  </div>
                  <Switch
                    checked={config.trackFormSubmissions}
                    onCheckedChange={(trackFormSubmissions) => setConfig(prev => ({ ...prev, trackFormSubmissions }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {config.enabled && config.trackingId && isValidTrackingId(config.trackingId) && (
                <span className="text-green-600">✓ Configuration is valid and ready to use</span>
              )}
            </div>
            <Button 
              onClick={saveAnalyticsConfig}
              disabled={isSaving || (config.enabled && !isValidTrackingId(config.trackingId))}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Preview */}
      {config.enabled && config.trackingId && isValidTrackingId(config.trackingId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analytics Preview</CardTitle>
            <CardDescription>
              Current tracking configuration that will be applied
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tracking ID:</span>
                <span className="font-mono">{config.trackingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Page Views:</span>
                <span className="text-green-600">✓ Enabled</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Event Tracking:</span>
                <span className={config.trackEvents ? 'text-green-600' : 'text-muted-foreground'}>
                  {config.trackEvents ? '✓ Enabled' : '○ Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scroll Tracking:</span>
                <span className={config.trackScrolling ? 'text-green-600' : 'text-muted-foreground'}>
                  {config.trackScrolling ? '✓ Enabled' : '○ Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Form Tracking:</span>
                <span className={config.trackFormSubmissions ? 'text-green-600' : 'text-muted-foreground'}>
                  {config.trackFormSubmissions ? '✓ Enabled' : '○ Disabled'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsSettings;