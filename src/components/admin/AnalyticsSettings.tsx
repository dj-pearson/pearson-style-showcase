import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Save, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface AnalyticsConfig {
  id?: string;
  google_analytics_id: string;
  enabled: boolean;
}

const AnalyticsSettings = () => {
  const [config, setConfig] = useState<AnalyticsConfig>({
    google_analytics_id: '',
    enabled: false,
  });
  const [showTrackingId, setShowTrackingId] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAnalyticsConfig();
  }, []);

  const loadAnalyticsConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('analytics_settings')
        .select('*')
        .single();

      if (error) {
        console.error('Error loading analytics config:', error);
      } else if (data) {
        setConfig({
          id: data.id,
          google_analytics_id: data.google_analytics_id || '',
          enabled: data.enabled,
        });
      }
    } catch (error) {
      console.error('Error loading analytics config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAnalyticsConfig = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('analytics_settings')
        .update({
          google_analytics_id: config.google_analytics_id || null,
          enabled: config.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id!);

      if (error) throw error;
      
      toast({
        title: "Analytics settings saved",
        description: config.enabled 
          ? "Google Analytics is now active with your tracking ID" 
          : "Analytics tracking has been disabled",
      });

      // Reload page to apply new analytics settings
      if (config.enabled && config.google_analytics_id) {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isValidTrackingId = (id: string) => {
    // For GA4 Tracking ID format or Property ID
    return /^(G-[A-Z0-9-]+|\d+)$/i.test(id);
  };

  const getAnalyticsStatus = () => {
    if (!config.enabled) return { status: 'disabled', color: 'secondary' as const };
    if (!config.google_analytics_id || !isValidTrackingId(config.google_analytics_id)) {
      return { status: 'invalid', color: 'destructive' as const };
    }
    return { status: 'active', color: 'default' as const };
  };

  const status = getAnalyticsStatus();

  if (isLoading) {
    return <div className="p-4">Loading analytics settings...</div>;
  }

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
              <Label className="text-base font-medium">Enable Analytics Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Enable Google Analytics tracking for website visitors
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
              Google Analytics Tracking ID
            </Label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Input
                  id="trackingId"
                  type={showTrackingId ? 'text' : 'password'}
                  placeholder="G-XXXXXXXXXX or Property ID"
                  value={config.google_analytics_id}
                  onChange={(e) => setConfig(prev => ({ ...prev, google_analytics_id: e.target.value }))}
                  className={!isValidTrackingId(config.google_analytics_id) && config.google_analytics_id ? 'border-destructive' : ''}
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
            {config.google_analytics_id && !isValidTrackingId(config.google_analytics_id) && (
              <p className="text-sm text-destructive">
                Please enter a valid GA4 Tracking ID (e.g., G-XXXXXXXXXX)
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Find your Tracking ID in Google Analytics: Admin → Data Streams → Your Stream
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {config.enabled && config.google_analytics_id && isValidTrackingId(config.google_analytics_id) && (
                <span className="text-green-600">✓ Configuration is valid and ready to use</span>
              )}
            </div>
            <Button 
              onClick={saveAnalyticsConfig}
              disabled={isSaving || (config.enabled && !isValidTrackingId(config.google_analytics_id))}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Preview */}
      {config.enabled && config.google_analytics_id && isValidTrackingId(config.google_analytics_id) && (
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
                <span className="font-mono">{config.google_analytics_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="text-green-600">✓ Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Page View Tracking:</span>
                <span className="text-green-600">✓ Enabled</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsSettings;
