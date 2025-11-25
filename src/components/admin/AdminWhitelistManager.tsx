import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermission, PERMISSIONS } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import { Plus, Trash2, Shield, Mail, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface WhitelistEntry {
  id: string;
  email: string;
  is_active: boolean;
  added_by: string | null;
  added_at: string;
  deactivated_at: string | null;
  notes: string | null;
}

const AdminWhitelistManager: React.FC = () => {
  const queryClient = useQueryClient();
  const canManage = usePermission(PERMISSIONS.WHITELIST_MANAGE);
  const canRead = usePermission(PERMISSIONS.WHITELIST_READ);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Fetch whitelist entries
  const { data: whitelist, isLoading, error } = useQuery({
    queryKey: ['admin-whitelist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_whitelist')
        .select('*')
        .order('added_at', { ascending: false });

      if (error) throw error;
      return data as WhitelistEntry[];
    },
    enabled: canRead || canManage,
  });

  // Add new entry mutation
  const addMutation = useMutation({
    mutationFn: async ({ email, notes }: { email: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('admin_whitelist')
        .insert({
          email: email.toLowerCase().trim(),
          notes,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-whitelist'] });
      toast.success('Admin email added to whitelist');
      setIsAddDialogOpen(false);
      setNewEmail('');
      setNewNotes('');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('This email is already in the whitelist');
      } else {
        toast.error(`Failed to add email: ${error.message}`);
      }
    },
  });

  // Toggle active status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('admin_whitelist')
        .update({
          is_active: isActive,
          deactivated_at: isActive ? null : new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-whitelist'] });
      toast.success(variables.isActive ? 'Admin access enabled' : 'Admin access disabled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  // Delete entry mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_whitelist')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-whitelist'] });
      toast.success('Admin removed from whitelist');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove admin: ${error.message}`);
    },
  });

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    addMutation.mutate({ email: newEmail, notes: newNotes || undefined });
  };

  if (!canRead && !canManage) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to view the admin whitelist.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin Whitelist
            </CardTitle>
            <CardDescription>
              Manage which email addresses have admin access to the system.
            </CardDescription>
          </div>
          {canManage && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Admin
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddEmail}>
                  <DialogHeader>
                    <DialogTitle>Add Admin Email</DialogTitle>
                    <DialogDescription>
                      Add a new email address to the admin whitelist. Users with whitelisted emails can access the admin dashboard.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (optional)</Label>
                      <Input
                        id="notes"
                        placeholder="e.g., Primary administrator"
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addMutation.isPending}>
                      {addMutation.isPending ? 'Adding...' : 'Add Admin'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load whitelist: {(error as Error).message}
            </AlertDescription>
          </Alert>
        ) : !whitelist || whitelist.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No admin emails in whitelist. Add one to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Notes</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {whitelist.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{entry.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={entry.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: entry.id, isActive: checked })
                          }
                          disabled={toggleMutation.isPending}
                        />
                        <Badge variant={entry.is_active ? 'default' : 'secondary'}>
                          {entry.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant={entry.is_active ? 'default' : 'secondary'}>
                        {entry.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(entry.added_at), 'MMM d, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {entry.notes || '-'}
                    </span>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Admin Access</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove <strong>{entry.email}</strong> from the admin whitelist? They will no longer be able to access the admin dashboard.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(entry.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {whitelist && whitelist.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            {whitelist.filter((e) => e.is_active).length} active admin(s) •{' '}
            {whitelist.filter((e) => !e.is_active).length} inactive
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminWhitelistManager;
