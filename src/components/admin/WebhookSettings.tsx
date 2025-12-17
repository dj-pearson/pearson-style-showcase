import { useState, useEffect } from 'react';
import { logger } from "@/lib/logger";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Send, Webhook } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { invokeEdgeFunction } from '@/lib/edge-functions';

export const WebhookSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [webhookId, setWebhookId] = useState<string | null>(null);

  useEffect(() => {
    loadWebhookSettings();
  }, []);

  const loadWebhookSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('webhook_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setWebhookId(data.id);
        setWebhookUrl(data.webhook_url);
        setEnabled(data.enabled);
      }
    } catch (error) {
      logger.error('Error loading webhook settings:', error);
      toast.error('Failed to load webhook settings');
    } finally {
      setLoading(false);
    }
  };

  const saveWebhookSettings = async () => {
    setSaving(true);
    try {
      if (webhookId) {
        const { error } = await supabase
          .from('webhook_settings')
          .update({
            webhook_url: webhookUrl,
            enabled: enabled,
          })
          .eq('id', webhookId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('webhook_settings')
          .insert({
            webhook_url: webhookUrl,
            enabled: enabled,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setWebhookId(data.id);
      }

      toast.success('Webhook settings saved successfully');
    } catch (error) {
      logger.error('Error saving webhook settings:', error);
      toast.error('Failed to save webhook settings');
    } finally {
      setSaving(false);
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl) {
      toast.error('Please enter a webhook URL first');
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await invokeEdgeFunction('send-article-webhook', {
        body: { isTest: true }
      });

      if (error) throw error;

      toast.success('Test webhook sent! Check Make.com for the payload structure.');
      logger.log('Test webhook payload:', data.payload);
    } catch (error) {
      logger.error('Error testing webhook:', error);
      toast.error('Failed to send test webhook');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Webhook Settings</h2>
        <p className="text-muted-foreground mt-2">
          Configure Make.com webhook for automatic social media post distribution
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            When articles are published, social media content will be automatically sent to this webhook
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Make.com Webhook URL</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://hook.us1.make.com/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Paste your Make.com webhook URL here
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="webhook-enabled">Enable Webhook</Label>
              <p className="text-sm text-muted-foreground">
                Automatically send article data when published
              </p>
            </div>
            <Switch
              id="webhook-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={saveWebhookSettings} disabled={saving || !webhookUrl}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={testWebhook} 
              disabled={testing || !webhookUrl}
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Test Webhook
                </>
              )}
            </Button>
          </div>

          <Alert>
            <AlertDescription>
              <strong>Webhook Payload Structure:</strong>
              <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto">
{`{
  "articleTitle": "Article title",
  "articleUrl": "https://yourdomain.com/article/slug",
  "shortForm": "Twitter/X post (max 280 chars)",
  "longForm": "Facebook post (300-500 chars)",
  "imageUrl": "https://image-url.com/image.jpg",
  "isTest": false
}`}
              </pre>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};