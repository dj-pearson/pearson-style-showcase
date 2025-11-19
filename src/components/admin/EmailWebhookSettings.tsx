import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Webhook, Copy, Check, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

export const EmailWebhookSettings = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState({
    id: '',
    webhook_url: '',
    webhook_secret: '',
    is_active: false,
    last_received_at: null as string | null,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('email_webhook_settings')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        const projectRef = 'qazhdcqvjppbbjxzvisp';
        const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/email-webhook-receiver`;
        
        setSettings({
          ...data,
          webhook_url: webhookUrl,
        });
      }
    } catch (error: any) {
      logger.error('Failed to load webhook settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load webhook settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateSecret = () => {
    const secret = crypto.randomUUID();
    setSettings(prev => ({ ...prev, webhook_secret: secret }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      if (!settings.webhook_secret) {
        toast({
          title: 'Error',
          description: 'Please generate a webhook secret',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('email_webhook_settings')
        .update({
          webhook_secret: settings.webhook_secret,
          is_active: settings.is_active,
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Webhook settings saved successfully',
      });
    } catch (error: any) {
      logger.error('Failed to save webhook settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save webhook settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied',
      description: 'Webhook URL copied to clipboard',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <CardTitle>Email Webhook Configuration</CardTitle>
        </div>
        <CardDescription>
          Configure webhook to receive forwarded emails and automatically create support tickets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            Configure your email forwarding service (e.g., SendGrid, Mailgun, Postmark) to send incoming emails
            to this webhook URL. Each email will automatically create a support ticket.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                value={settings.webhook_url}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard(settings.webhook_url)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this URL as your webhook endpoint in your email service provider
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-secret">Webhook Secret</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-secret"
                type="password"
                value={settings.webhook_secret}
                onChange={(e) => setSettings(prev => ({ ...prev, webhook_secret: e.target.value }))}
                placeholder="Generate or enter webhook secret"
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={generateSecret}
              >
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send this as the <code className="px-1 py-0.5 bg-muted rounded">x-webhook-secret</code> header with each request
            </p>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="webhook-active">Enable Webhook</Label>
              <p className="text-sm text-muted-foreground">
                Activate webhook to start receiving emails
              </p>
            </div>
            <Switch
              id="webhook-active"
              checked={settings.is_active}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_active: checked }))}
            />
          </div>

          {settings.last_received_at && (
            <div className="text-sm text-muted-foreground">
              Last email received: {new Date(settings.last_received_at).toLocaleString()}
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};