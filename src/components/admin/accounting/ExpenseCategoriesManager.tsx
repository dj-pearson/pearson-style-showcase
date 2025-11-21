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
import { Plus, Pencil, Trash2, Tag, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ExpenseCategory {
  id: string;
  name: string;
  category_code: string | null;
  description: string | null;
  tax_deductible: boolean;
  account_id: string | null;
  parent_category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Account {
  id: string;
  account_name: string;
  account_number: string;
  account_type: string;
}

const ExpenseCategoriesManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category_code: '',
    description: '',
    tax_deductible: true,
    account_id: '',
    parent_category_id: '',
    is_active: true,
  });

  // Fetch expense categories
  const { data: categories, isLoading } = useQuery({
    queryKey: ['expense_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as ExpenseCategory[];
    },
  });

  // Fetch expense accounts for dropdown
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
    mutationFn: async (newCategory: Partial<ExpenseCategory>) => {
      const { data, error } = await supabase
        .from('expense_categories')
        .insert([newCategory])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] });
      toast.success('Expense category created successfully');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to create expense category: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedCategory: Partial<ExpenseCategory> & { id: string }) => {
      const { id, ...updates } = updatedCategory;
      const { data, error } = await supabase
        .from('expense_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] });
      toast.success('Expense category updated successfully');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update expense category: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] });
      toast.success('Expense category deleted successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete expense category: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category_code: '',
      description: '',
      tax_deductible: true,
      account_id: '',
      parent_category_id: '',
      is_active: true,
    });
    setEditingCategory(null);
  };

  const handleEdit = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      category_code: category.category_code || '',
      description: category.description || '',
      tax_deductible: category.tax_deductible,
      account_id: category.account_id || '',
      parent_category_id: category.parent_category_id || '',
      is_active: category.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const categoryData = {
      name: formData.name,
      category_code: formData.category_code || null,
      description: formData.description || null,
      tax_deductible: formData.tax_deductible,
      account_id: formData.account_id || null,
      parent_category_id: formData.parent_category_id || null,
      is_active: formData.is_active,
    };

    if (editingCategory) {
      updateMutation.mutate({ ...categoryData, id: editingCategory.id });
    } else {
      createMutation.mutate(categoryData);
    }
  };

  // Common IRS Schedule C categories
  const irsCategoryCodes = [
    { code: '8', label: 'Advertising' },
    { code: '9', label: 'Car and truck expenses' },
    { code: '10', label: 'Commissions and fees' },
    { code: '11', label: 'Contract labor' },
    { code: '12', label: 'Depletion' },
    { code: '13', label: 'Depreciation' },
    { code: '14', label: 'Employee benefit programs' },
    { code: '15', label: 'Insurance (other than health)' },
    { code: '16a', label: 'Mortgage interest' },
    { code: '16b', label: 'Other interest' },
    { code: '17', label: 'Legal and professional services' },
    { code: '18', label: 'Office expense' },
    { code: '19', label: 'Pension and profit-sharing plans' },
    { code: '20a', label: 'Rent - Vehicles, machinery, equipment' },
    { code: '20b', label: 'Rent - Other business property' },
    { code: '21', label: 'Repairs and maintenance' },
    { code: '22', label: 'Supplies' },
    { code: '23', label: 'Taxes and licenses' },
    { code: '24a', label: 'Travel' },
    { code: '24b', label: 'Deductible meals' },
    { code: '25', label: 'Utilities' },
    { code: '26', label: 'Wages' },
    { code: '27a', label: 'Other expenses (list type and amount)' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Expense Categories</h2>
          <p className="text-sm text-muted-foreground">
            Tax-ready expense categorization for IRS reporting
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Edit Expense Category' : 'Add Expense Category'}
              </DialogTitle>
              <DialogDescription>
                Create tax-deductible expense categories for business tracking
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., AI Services, Domain & Hosting"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category_code">IRS Schedule C Line Number</Label>
                <Select
                  value={formData.category_code}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_code: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select IRS category (optional)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {irsCategoryCodes.map((cat) => (
                      <SelectItem key={cat.code} value={cat.code}>
                        Line {cat.code} - {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Maps to IRS Schedule C (Form 1040) for tax reporting
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the expense category"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_id">Linked Expense Account</Label>
                <Select
                  value={formData.account_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, account_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account (optional)" />
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

              <div className="space-y-2">
                <Label htmlFor="parent_category_id">Parent Category (Optional)</Label>
                <Select
                  value={formData.parent_category_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, parent_category_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.filter(c => c.id !== editingCategory?.id).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="tax_deductible"
                    checked={formData.tax_deductible}
                    onChange={(e) => setFormData({ ...formData, tax_deductible: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="tax_deductible" className="font-normal">
                    Tax Deductible
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
                  {editingCategory ? 'Update' : 'Create'} Category
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
      ) : categories && categories.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>IRS Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Tax Deductible</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      {category.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {category.category_code ? (
                      <Badge variant="outline">Line {category.category_code}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {category.description || (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {category.tax_deductible ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm">Yes</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm">No</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={category.is_active ? 'default' : 'secondary'}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this category?')) {
                            deleteMutation.mutate(category.id);
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
          No expense categories found. Click "Add Category" to create one.
        </div>
      )}
    </div>
  );
};

export default ExpenseCategoriesManager;
