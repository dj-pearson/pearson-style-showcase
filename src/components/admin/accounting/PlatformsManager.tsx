import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

interface Platform {
  id: string;
  name: string;
  platform_type: 'revenue' | 'expense' | 'both';
  category: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  default_income_account_id: string | null;
  default_expense_account_id: string | null;
  api_enabled: boolean;
  api_config: any;
  is_active: boolean;
  monthly_budget: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Account {
  id: string;
  account_name: string;
  account_number: string;
  account_type: string;
}

const PlatformsManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'revenue' | 'expense' | 'both'>('all');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    platform_type: 'expense' as 'revenue' | 'expense' | 'both',
    category: '',
    description: '',
    logo_url: '',
    website_url: '',
    default_income_account_id: '',
    default_expense_account_id: '',
    monthly_budget: '',
    is_active: true,
    notes: '',
  });

  // Fetch platforms
  const { data: platforms, isLoading } = useQuery({
    queryKey: ['platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Platform[];
    },
  });

  // Fetch accounts for dropdowns
  const { data: incomeAccounts } = useQuery({
    queryKey: ['accounts', 'Income'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, account_name, account_number, account_type')
        .eq('account_type', 'Income')
        .eq('is_active', true)
        .order('account_number');

      if (error) throw error;
      return data as Account[];
    },
  });

  const { data: expenseAccounts } = useQuery({
    queryKey: ['accounts', 'Expense'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, account_name, account_number, account_type')
        .eq('account_type', 'Expense')
        .eq('is_active', true)
        .order('account_number');

      if (error) throw error;
      return data as Account[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (newPlatform: Partial<Platform>) => {
      const { data, error } = await supabase
        .from('platforms')
        .insert([newPlatform])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
      toast.success('Platform created successfully');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to create platform: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedPlatform: Partial<Platform> & { id: string }) => {
      const { id, ...updates } = updatedPlatform;
      const { data, error } = await supabase
        .from('platforms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
      toast.success('Platform updated successfully');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update platform: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platforms')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
      toast.success('Platform deleted successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete platform: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      platform_type: 'expense',
      category: '',
      description: '',
      logo_url: '',
      website_url: '',
      default_income_account_id: '',
      default_expense_account_id: '',
      monthly_budget: '',
      is_active: true,
      notes: '',
    });
    setEditingPlatform(null);
  };

  const handleEdit = (platform: Platform) => {
    setEditingPlatform(platform);
    setFormData({
      name: platform.name,
      platform_type: platform.platform_type,
      category: platform.category || '',
      description: platform.description || '',
      logo_url: platform.logo_url || '',
      website_url: platform.website_url || '',
      default_income_account_id: platform.default_income_account_id || '',
      default_expense_account_id: platform.default_expense_account_id || '',
      monthly_budget: platform.monthly_budget?.toString() || '',
      is_active: platform.is_active,
      notes: platform.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const platformData = {
      name: formData.name,
      platform_type: formData.platform_type,
      category: formData.category || null,
      description: formData.description || null,
      logo_url: formData.logo_url || null,
      website_url: formData.website_url || null,
      default_income_account_id: formData.default_income_account_id || null,
      default_expense_account_id: formData.default_expense_account_id || null,
      monthly_budget: formData.monthly_budget ? parseFloat(formData.monthly_budget) : null,
      is_active: formData.is_active,
      notes: formData.notes || null,
    };

    if (editingPlatform) {
      updateMutation.mutate({ ...platformData, id: editingPlatform.id });
    } else {
      createMutation.mutate(platformData);
    }
  };

  const filteredPlatforms = platforms?.filter(platform => {
    if (filterType === 'all') return true;
    return platform.platform_type === filterType;
  });

  const getPlatformTypeIcon = (type: string) => {
    switch (type) {
      case 'revenue':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'expense':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'both':
        return <DollarSign className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getPlatformTypeBadge = (type: string) => {
    const variants = {
      revenue: 'default',
      expense: 'destructive',
      both: 'secondary',
    } as const;

    return (
      <Badge variant={variants[type as keyof typeof variants] || 'default'}>
        {type}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Platforms</h2>
          <p className="text-sm text-muted-foreground">
            Manage your revenue and expense platforms
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Platform
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPlatform ? 'Edit Platform' : 'Add New Platform'}
              </DialogTitle>
              <DialogDescription>
                {editingPlatform
                  ? 'Update platform information'
                  : 'Add a new revenue or expense platform to track'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Platform Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., OpenAI, Stripe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platform_type">Type *</Label>
                  <Select
                    value={formData.platform_type}
                    onValueChange={(value: 'revenue' | 'expense' | 'both') =>
                      setFormData({ ...formData, platform_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., ai_service, hosting"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly_budget">Monthly Budget</Label>
                  <Input
                    id="monthly_budget"
                    type="number"
                    step="0.01"
                    value={formData.monthly_budget}
                    onChange={(e) => setFormData({ ...formData, monthly_budget: e.target.value })}
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
                  placeholder="Brief description of the platform"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input
                    id="logo_url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website_url">Website URL</Label>
                  <Input
                    id="website_url"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {(formData.platform_type === 'revenue' || formData.platform_type === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="default_income_account_id">Default Income Account</Label>
                  <Select
                    value={formData.default_income_account_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, default_income_account_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {incomeAccounts?.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_number} - {account.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(formData.platform_type === 'expense' || formData.platform_type === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="default_expense_account_id">Default Expense Account</Label>
                  <Select
                    value={formData.default_expense_account_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, default_expense_account_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseAccounts?.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_number} - {account.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes"
                  rows={2}
                />
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
                  {editingPlatform ? 'Update' : 'Create'} Platform
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <Button
          variant={filterType === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('all')}
        >
          All
        </Button>
        <Button
          variant={filterType === 'revenue' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('revenue')}
        >
          Revenue
        </Button>
        <Button
          variant={filterType === 'expense' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('expense')}
        >
          Expense
        </Button>
        <Button
          variant={filterType === 'both' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('both')}
        >
          Both
        </Button>
      </div>

      {/* Platforms table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading platforms...</div>
      ) : filteredPlatforms && filteredPlatforms.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Monthly Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlatforms.map((platform) => (
                <TableRow key={platform.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getPlatformTypeIcon(platform.platform_type)}
                      {platform.name}
                    </div>
                  </TableCell>
                  <TableCell>{getPlatformTypeBadge(platform.platform_type)}</TableCell>
                  <TableCell>
                    {platform.category ? (
                      <Badge variant="outline">{platform.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {platform.monthly_budget ? (
                      <span className="font-mono">${platform.monthly_budget.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={platform.is_active ? 'default' : 'secondary'}>
                      {platform.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(platform)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this platform?')) {
                            deleteMutation.mutate(platform.id);
                          }
                        }}
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
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No platforms found. Click "Add Platform" to create one.
        </div>
      )}
    </div>
  );
};

export default PlatformsManager;
