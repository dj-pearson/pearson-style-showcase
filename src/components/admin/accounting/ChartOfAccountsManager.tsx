import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, BookOpen, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Account {
  id: string;
  account_number: string | null;
  account_name: string;
  account_type: string;
  account_subtype: string | null;
  parent_account_id: string | null;
  currency_id: string | null;
  description: string | null;
  is_group: boolean;
  is_active: boolean;
  opening_balance: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

const ACCOUNT_SUBTYPES: Record<string, string[]> = {
  Asset: ['Current Asset', 'Fixed Asset', 'Other Asset'],
  Liability: ['Current Liability', 'Long-term Liability', 'Other Liability'],
  Equity: ['Owner Equity', 'Retained Earnings'],
  Income: ['Revenue', 'Other Income'],
  Expense: ['Operating Expense', 'Cost of Goods Sold', 'Other Expense'],
};

export const ChartOfAccountsManager = () => {
  const [filterType, setFilterType] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    account_number: '',
    account_name: '',
    account_type: 'Asset',
    account_subtype: '',
    parent_account_id: '',
    currency_id: '',
    description: '',
    is_group: false,
    is_active: true,
    opening_balance: '0',
  });

  // Fetch accounts
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts', filterType],
    queryFn: async () => {
      let query = supabase
        .from('accounts')
        .select('*')
        .order('account_number', { ascending: true });

      if (filterType !== 'all') {
        query = query.eq('account_type', filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Account[];
    },
  });

  // Fetch currencies
  const { data: currencies } = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .order('code');

      if (error) throw error;
      return data as Currency[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (newAccount: Partial<Account>) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert([newAccount])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Success',
        description: 'Account created successfully',
      });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      logger.error('Error creating account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create account',
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedAccount: Partial<Account> & { id: string }) => {
      const { id, ...updates } = updatedAccount;
      const { data, error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Success',
        description: 'Account updated successfully',
      });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      logger.error('Error updating account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update account',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Success',
        description: 'Account deleted successfully',
      });
    },
    onError: (error: any) => {
      logger.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete account. It may be in use.',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      account_number: '',
      account_name: '',
      account_type: 'Asset',
      account_subtype: '',
      parent_account_id: '',
      currency_id: '',
      description: '',
      is_group: false,
      is_active: true,
      opening_balance: '0',
    });
    setEditingAccount(null);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      account_number: account.account_number || '',
      account_name: account.account_name,
      account_type: account.account_type,
      account_subtype: account.account_subtype || '',
      parent_account_id: account.parent_account_id || '',
      currency_id: account.currency_id || '',
      description: account.description || '',
      is_group: account.is_group,
      is_active: account.is_active,
      opening_balance: account.opening_balance.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Get base currency if none selected
    const currencyId = formData.currency_id || currencies?.find(c => c.code === 'USD')?.id || null;

    const accountData = {
      account_number: formData.account_number || null,
      account_name: formData.account_name,
      account_type: formData.account_type,
      account_subtype: formData.account_subtype || null,
      parent_account_id: formData.parent_account_id || null,
      currency_id: currencyId,
      description: formData.description || null,
      is_group: formData.is_group,
      is_active: formData.is_active,
      opening_balance: parseFloat(formData.opening_balance) || 0,
    };

    if (editingAccount) {
      updateMutation.mutate({ ...accountData, id: editingAccount.id });
    } else {
      createMutation.mutate(accountData);
    }
  };

  const handleDelete = (account: Account) => {
    if (confirm(`Are you sure you want to delete account "${account.account_name}"? This cannot be undone.`)) {
      deleteMutation.mutate(account.id);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Asset: 'bg-blue-100 text-blue-800',
      Liability: 'bg-red-100 text-red-800',
      Equity: 'bg-green-100 text-green-800',
      Income: 'bg-emerald-100 text-emerald-800',
      Expense: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Get potential parent accounts (exclude self and same-level)
  const getParentAccountOptions = () => {
    if (!accounts) return [];
    return accounts.filter(account =>
      account.account_type === formData.account_type &&
      account.id !== editingAccount?.id &&
      account.is_group
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Chart of Accounts</CardTitle>
              <CardDescription>
                Manage your account structure for double-entry bookkeeping
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingAccount ? 'Edit Account' : 'Create New Account'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingAccount
                      ? 'Update account information for your chart of accounts'
                      : 'Add a new account to your chart of accounts'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="account_number">Account Number</Label>
                      <Input
                        id="account_number"
                        value={formData.account_number}
                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                        placeholder="e.g., 1000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account_name">Account Name *</Label>
                      <Input
                        id="account_name"
                        value={formData.account_name}
                        onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                        placeholder="e.g., Cash"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="account_type">Account Type *</Label>
                      <Select
                        value={formData.account_type}
                        onValueChange={(value) =>
                          setFormData({ ...formData, account_type: value, account_subtype: '' })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account_subtype">Account Subtype</Label>
                      <Select
                        value={formData.account_subtype}
                        onValueChange={(value) =>
                          setFormData({ ...formData, account_subtype: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select subtype" />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_SUBTYPES[formData.account_type]?.map((subtype) => (
                            <SelectItem key={subtype} value={subtype}>
                              {subtype}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="parent_account_id">Parent Account (Optional)</Label>
                      <Select
                        value={formData.parent_account_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, parent_account_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None (top-level account)" />
                        </SelectTrigger>
                        <SelectContent>
                          {getParentAccountOptions().map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.account_number ? `${account.account_number} - ` : ''}{account.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="opening_balance">Opening Balance</Label>
                      <Input
                        id="opening_balance"
                        type="number"
                        step="0.01"
                        value={formData.opening_balance}
                        onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of the account"
                      rows={2}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_group"
                        checked={formData.is_group}
                        onChange={(e) => setFormData({ ...formData, is_group: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="is_group" className="font-normal">
                        Group Account (can contain sub-accounts)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="is_active" className="font-normal">
                        Active
                      </Label>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetForm();
                        setIsDialogOpen(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingAccount ? 'Update' : 'Create'} Account
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
            >
              All
            </Button>
            <Button
              variant={filterType === 'Asset' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Asset')}
            >
              Assets
            </Button>
            <Button
              variant={filterType === 'Liability' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Liability')}
            >
              Liabilities
            </Button>
            <Button
              variant={filterType === 'Equity' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Equity')}
            >
              Equity
            </Button>
            <Button
              variant={filterType === 'Income' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Income')}
            >
              Income
            </Button>
            <Button
              variant={filterType === 'Expense' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Expense')}
            >
              Expenses
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : accounts && accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No accounts found</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account #</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subtype</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts?.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono">
                        {account.account_number || '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {account.account_name}
                        {account.is_group && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Group
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(account.account_type)}>
                          {account.account_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {account.account_subtype || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(account.current_balance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? 'default' : 'outline'}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(account)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(account)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
