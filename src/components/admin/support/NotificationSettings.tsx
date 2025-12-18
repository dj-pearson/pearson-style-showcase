import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Plus, X, Mail, MessageSquare, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { invokeEdgeFunction } from '@/lib/edge-functions';

export const NotificationSettings = () => {
  const [emails, setEmails] = useState<string[]>(['pearsonperformance@gmail.com']);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  
  // Slack settings
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackChannel, setSlackChannel] = useState('#emails');
  const [testingSlack, setTestingSlack] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setSettingsId(data.id);
        setEmails(data.notification_emails || []);
        setEnabled(data.enabled);
        // Slack settings - use type assertion for new fields
        const slackData = data as typeof data & { 
          slack_enabled?: boolean; 
          slack_webhook_url?: string; 
          slack_channel?: string;
        };
        setSlackEnabled(slackData.slack_enabled || false);
        setSlackWebhookUrl(slackData.slack_webhook_url || '');
        setSlackChannel(slackData.slack_channel || '#emails');
      }
    } catch (error: any) {
      console.error('Error fetching notification settings:', error);
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settingsId) return;

    try {
      const { error } = await supabase
        .from('notification_settings')
        .update({
          notification_emails: emails,
          enabled: enabled,
          slack_enabled: slackEnabled,
          slack_webhook_url: slackWebhookUrl || null,
          slack_channel: slackChannel || '#emails',
        } as any)
        .eq('id', settingsId);

      if (error) throw error;

      toast.success('Notification settings saved');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save notification settings');
    }
  };

  const testSlackWebhook = async () => {
    if (!slackWebhookUrl) {
      toast.error('Please enter a Slack webhook URL first');
      return;
    }

    setTestingSlack(true);
    try {
      // Use edge function to proxy the Slack request (avoids CORS issues)
      const response = await invokeEdgeFunction('slack-test', {
        body: {
          webhookUrl: slackWebhookUrl,
          channel: slackChannel,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send test message');
      }

      if (response.data?.success) {
        toast.success('Test message sent to Slack!');
      } else {
        throw new Error(response.data?.error || 'Failed to send test message');
      }
    } catch (error: any) {
      console.error('Slack test error:', error);
      toast.error(error.message || 'Failed to send test message. Check your webhook URL.');
    } finally {
      setTestingSlack(false);
    }
  };

  const addEmail = () => {
    const trimmedEmail = newEmail.trim();
    if (!trimmedEmail) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (emails.includes(trimmedEmail)) {
      toast.error('This email is already in the list');
      return;
    }

    setEmails([...emails, trimmedEmail]);
    setNewEmail('');
  };

  const removeEmail = (emailToRemove: string) => {
    if (emails.length === 1) {
      toast.error('You must have at least one notification email');
      return;
    }
    setEmails(emails.filter(email => email !== emailToRemove));
  };

  if (loading) {
    return <div className="p-4">Loading notification settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Configure email addresses that will receive notifications for new tickets and responses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Enable Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send email notifications for new tickets and responses
              </p>
            </div>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="space-y-4">
            <Label>Notification Email Addresses</Label>
            
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addEmail();
                  }
                }}
              />
              <Button onClick={addEmail} size="icon" variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {emails.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-3 border rounded-lg bg-background"
                >
                  <span className="text-sm">{email}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEmail(email)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {emails.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                No notification emails configured
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Slack Integration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Slack Integration
          </CardTitle>
          <CardDescription>
            Send notifications to a Slack channel when new tickets or responses arrive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="slack-enabled">Enable Slack Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send notifications to your Slack workspace
              </p>
            </div>
            <Switch
              id="slack-enabled"
              checked={slackEnabled}
              onCheckedChange={setSlackEnabled}
            />
          </div>

          {slackEnabled && (
            <>
              <Separator />
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  To set up Slack integration, you need to create an{' '}
                  <a 
                    href="https://api.slack.com/messaging/webhooks" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-medium underline inline-flex items-center gap-1"
                  >
                    Incoming Webhook
                    <ExternalLink className="h-3 w-3" />
                  </a>{' '}
                  in your Slack workspace.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slack-channel">Channel Name</Label>
                  <Input
                    id="slack-channel"
                    value={slackChannel}
                    onChange={(e) => setSlackChannel(e.target.value)}
                    placeholder="#emails"
                  />
                  <p className="text-xs text-muted-foreground">
                    The name of the channel where notifications will be sent (for reference only)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slack-webhook">Webhook URL</Label>
                  <Input
                    id="slack-webhook"
                    type="password"
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Slack Incoming Webhook URL (starts with https://hooks.slack.com/services/)
                  </p>
                </div>

                <Button 
                  variant="outline" 
                  onClick={testSlackWebhook}
                  disabled={!slackWebhookUrl || testingSlack}
                  className="w-full"
                >
                  {testingSlack ? (
                    'Sending test message...'
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Send Test Message
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button onClick={saveSettings} className="w-full" size="lg">
        Save All Settings
      </Button>
    </div>
  );
};
