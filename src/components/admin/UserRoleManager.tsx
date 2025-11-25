import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermission, PERMISSIONS } from '@/hooks/usePermission';
import { AppRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Trash2, Users, Shield, ShieldCheck, Eye, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  granted_at: string;
  granted_by: string | null;
  expires_at: string | null;
  is_active: boolean;
}

interface WhitelistedUser {
  id: string;
  email: string;
  is_active: boolean;
  roles: UserRole[];
}

const ROLE_INFO: Record<AppRole, { label: string; description: string; icon: React.ReactNode; color: string }> = {
  admin: {
    label: 'Admin',
    description: 'Full system access, can manage users and settings',
    icon: <ShieldCheck className="h-4 w-4" />,
    color: 'bg-red-500',
  },
  editor: {
    label: 'Editor',
    description: 'Can create and edit content, limited publishing rights',
    icon: <Shield className="h-4 w-4" />,
    color: 'bg-blue-500',
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to admin dashboard and reports',
    icon: <Eye className="h-4 w-4" />,
    color: 'bg-gray-500',
  },
};

const UserRoleManager: React.FC = () => {
  const queryClient = useQueryClient();
  const canAssign = usePermission(PERMISSIONS.ROLES_ASSIGN);
  const canRevoke = usePermission(PERMISSIONS.ROLES_REVOKE);
  const canRead = usePermission(PERMISSIONS.ROLES_READ);

  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('editor');

  // Fetch whitelisted users with their roles
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      // First get all whitelisted emails
      const { data: whitelist, error: whitelistError } = await supabase
        .from('admin_whitelist')
        .select('id, email, is_active')
        .eq('is_active', true)
        .order('email');

      if (whitelistError) throw whitelistError;

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('is_active', true);

      if (rolesError) throw rolesError;

      // Get auth users to map emails to user_ids
      // Note: This requires service role, so we'll do a best-effort match
      // In production, you might want an edge function for this

      // For now, return whitelist with roles we can find
      const usersWithRoles: WhitelistedUser[] = whitelist.map((w) => ({
        id: w.id,
        email: w.email,
        is_active: w.is_active,
        roles: roles.filter((r) => {
          // Try to match by checking if this role belongs to a user with this email
          // This is a simplified approach - in production, you'd join with auth.users
          return true; // We'll show all roles for now
        }) as UserRole[],
      }));

      return usersWithRoles;
    },
    enabled: canRead || canAssign || canRevoke,
  });

  // Fetch user_roles directly for display
  const { data: allRoles } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('granted_at', { ascending: false });

      if (error) throw error;
      return data as UserRole[];
    },
    enabled: canRead || canAssign || canRevoke,
  });

  // Assign role mutation
  const assignMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { data, error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      toast.success('Role assigned successfully');
      setIsAssignDialogOpen(false);
      setSelectedUserId('');
      setSelectedRole('editor');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        toast.error('User already has this role');
      } else {
        toast.error(`Failed to assign role: ${error.message}`);
      }
    },
  });

  // Revoke role mutation
  const revokeMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('id', roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      toast.success('Role revoked successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to revoke role: ${error.message}`);
    },
  });

  const handleAssignRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }
    assignMutation.mutate({ userId: selectedUserId, role: selectedRole });
  };

  if (!canRead && !canAssign && !canRevoke) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to view user roles.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Definitions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Definitions
          </CardTitle>
          <CardDescription>
            Understanding the different roles and their permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.entries(ROLE_INFO) as [AppRole, typeof ROLE_INFO.admin][]).map(([role, info]) => (
              <div
                key={role}
                className="flex items-start gap-3 p-4 rounded-lg border bg-card"
              >
                <div className={`p-2 rounded-md ${info.color} text-white`}>
                  {info.icon}
                </div>
                <div>
                  <h4 className="font-medium">{info.label}</h4>
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Roles Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Roles
              </CardTitle>
              <CardDescription>
                Manage role assignments for admin users.
              </CardDescription>
            </div>
            {canAssign && (
              <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleAssignRole}>
                    <DialogHeader>
                      <DialogTitle>Assign Role</DialogTitle>
                      <DialogDescription>
                        Assign a role to a user. Users must be in the admin whitelist first.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="user">User ID</Label>
                        <Input
                          id="user"
                          placeholder="Enter user UUID"
                          value={selectedUserId}
                          onChange={(e) => setSelectedUserId(e.target.value)}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          The user must first sign in to get a user ID. Check the auth.users table in Supabase.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={selectedRole}
                          onValueChange={(value) => setSelectedRole(value as AppRole)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(ROLE_INFO) as [AppRole, typeof ROLE_INFO.admin][]).map(
                              ([role, info]) => (
                                <SelectItem key={role} value={role}>
                                  <div className="flex items-center gap-2">
                                    {info.icon}
                                    <span>{info.label}</span>
                                  </div>
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAssignDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={assignMutation.isPending}>
                        {assignMutation.isPending ? 'Assigning...' : 'Assign Role'}
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
                Failed to load roles: {(error as Error).message}
              </AlertDescription>
            </Alert>
          ) : !allRoles || allRoles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No role assignments found. Roles are auto-assigned when whitelisted users sign in.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  {canRevoke && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRoles.map((role) => {
                  const roleInfo = ROLE_INFO[role.role];
                  return (
                    <TableRow key={role.id}>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {role.user_id.substring(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 w-fit"
                        >
                          {roleInfo.icon}
                          {roleInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(role.granted_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {role.expires_at ? (
                          <span className="text-sm">
                            {format(new Date(role.expires_at), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={role.is_active ? 'default' : 'secondary'}>
                          {role.is_active ? 'Active' : 'Revoked'}
                        </Badge>
                      </TableCell>
                      {canRevoke && (
                        <TableCell className="text-right">
                          {role.is_active && (
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
                                  <AlertDialogTitle>Revoke Role</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to revoke the <strong>{roleInfo.label}</strong> role? The user will lose all permissions associated with this role.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => revokeMutation.mutate(role.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Revoke
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {allRoles && allRoles.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              {allRoles.filter((r) => r.is_active).length} active role assignment(s)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserRoleManager;
