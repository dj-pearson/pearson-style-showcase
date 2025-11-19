import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Inbox, Plus, Edit, Trash2, Mail, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Mailbox {
  id: string;
  name: string;
  email_address: string;
  description: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  is_active: boolean;
  is_default: boolean;
  signature: string | null;
}

export const EmailMailboxManager = () => {
  const { toast } = useToast();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email_address: '',
    description: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_use_tls: true,
    is_active: true,
    is_default: false,
    signature: '',
  });

  useEffect(() => {
    loadMailboxes();
  }, []);

  const loadMailboxes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('email_mailboxes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMailboxes(data || []);
    } catch (error: any) {
      logger.error('Failed to load mailboxes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load mailboxes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingMailbox) {
        const { error } = await supabase
          .from('email_mailboxes')
          .update(formData)
          .eq('id', editingMailbox.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Mailbox updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('email_mailboxes')
          .insert([formData]);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Mailbox created successfully',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadMailboxes();
    } catch (error: any) {
      logger.error('Failed to save mailbox:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (mailbox: Mailbox) => {
    setEditingMailbox(mailbox);
    setFormData({
      name: mailbox.name,
      email_address: mailbox.email_address,
      description: mailbox.description || '',
      smtp_host: mailbox.smtp_host,
      smtp_port: mailbox.smtp_port,
      smtp_username: mailbox.smtp_username,
      smtp_password: mailbox.smtp_password,
      smtp_use_tls: mailbox.smtp_use_tls,
      is_active: mailbox.is_active,
      is_default: mailbox.is_default,
      signature: mailbox.signature || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mailbox?')) return;

    try {
      const { error } = await supabase
        .from('email_mailboxes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Mailbox deleted successfully',
      });
      loadMailboxes();
    } catch (error: any) {
      logger.error('Failed to delete mailbox:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setEditingMailbox(null);
    setFormData({
      name: '',
      email_address: '',
      description: '',
      smtp_host: '',
      smtp_port: 587,
      smtp_username: '',
      smtp_password: '',
      smtp_use_tls: true,
      is_active: true,
      is_default: false,
      signature: '',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              <CardTitle>Email Mailboxes</CardTitle>
            </div>
            <CardDescription>
              Manage mailboxes for receiving and sending emails
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Mailbox
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingMailbox ? 'Edit Mailbox' : 'Add New Mailbox'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Mailbox Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Support Inbox"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email_address}
                      onChange={(e) => setFormData(prev => ({ ...prev, email_address: e.target.value }))}
                      placeholder="support@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this mailbox"
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">SMTP Configuration</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp_host">SMTP Host *</Label>
                      <Input
                        id="smtp_host"
                        value={formData.smtp_host}
                        onChange={(e) => setFormData(prev => ({ ...prev, smtp_host: e.target.value }))}
                        placeholder="smtp.gmail.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp_port">SMTP Port *</Label>
                      <Input
                        id="smtp_port"
                        type="number"
                        value={formData.smtp_port}
                        onChange={(e) => setFormData(prev => ({ ...prev, smtp_port: parseInt(e.target.value) }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp_username">SMTP Username *</Label>
                      <Input
                        id="smtp_username"
                        value={formData.smtp_username}
                        onChange={(e) => setFormData(prev => ({ ...prev, smtp_username: e.target.value }))}
                        placeholder="your-email@example.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp_password">SMTP Password *</Label>
                      <Input
                        id="smtp_password"
                        type="password"
                        value={formData.smtp_password}
                        onChange={(e) => setFormData(prev => ({ ...prev, smtp_password: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signature">Email Signature</Label>
                  <Textarea
                    id="signature"
                    value={formData.signature}
                    onChange={(e) => setFormData(prev => ({ ...prev, signature: e.target.value }))}
                    placeholder="Enter your email signature..."
                    rows={4}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="smtp_use_tls"
                      checked={formData.smtp_use_tls}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, smtp_use_tls: checked }))}
                    />
                    <Label htmlFor="smtp_use_tls">Use TLS</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_default"
                      checked={formData.is_default}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
                    />
                    <Label htmlFor="is_default">Default</Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingMailbox ? 'Update' : 'Create'} Mailbox
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : mailboxes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No mailboxes configured</p>
            <p className="text-sm mt-1">Add a mailbox to start managing emails</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead>SMTP Host</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mailboxes.map((mailbox) => (
                <TableRow key={mailbox.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {mailbox.name}
                      {mailbox.is_default && (
                        <Badge variant="outline" className="text-xs">Default</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{mailbox.email_address}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {mailbox.smtp_host}:{mailbox.smtp_port}
                  </TableCell>
                  <TableCell>
                    <Badge variant={mailbox.is_active ? 'default' : 'secondary'}>
                      {mailbox.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(mailbox)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(mailbox.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};