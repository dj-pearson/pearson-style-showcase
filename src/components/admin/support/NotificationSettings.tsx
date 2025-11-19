import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, X, Mail } from 'lucide-react';

export const NotificationSettings = () => {
  const [emails, setEmails] = useState<string[]>(['pearsonperformance@gmail.com']);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');

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
        })
        .eq('id', settingsId);

      if (error) throw error;

      toast.success('Notification settings saved');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save notification settings');
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Configure email addresses that will receive notifications for new tickets and responses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enabled">Enable Notifications</Label>
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

        <Button onClick={saveSettings} className="w-full">
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
};
