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
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface RecurringTransaction {
  id: string;
  transaction_type: 'income' | 'expense';
  name: string;
  description: string | null;
  amount: number;
  currency_id: string | null;
  platform_id: string | null;
  expense_category_id: string | null;
  contact_id: string | null;
  account_id: string | null;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval_count: number;
  start_date: string;
  end_date: string | null;
  auto_create: boolean;
  auto_post: boolean;
  days_in_advance: number;
  last_created_date: string | null;
  next_due_date: string | null;
  is_active: boolean;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const RecurringTransactionsManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const [formData, setFormData] = useState({
    transaction_type: 'expense' as 'income' | 'expense',
    name: '',
    description: '',
    amount: '',
    platform_id: '',
    expense_category_id: '',
    contact_id: '',
    account_id: '',
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    interval_count: '1',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    auto_create: true,
    auto_post: false,
    days_in_advance: '0',
    is_active: true,
    payment_method: '',
    reference_number: '',
    notes: '',
  });

  // Fetch recurring transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['recurring_transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as RecurringTransaction[];
    },
  });

  // Fetch platforms for dropdown
  const { data: platforms } = useQuery({
    queryKey: ['platforms', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('id, name, platform_type')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Fetch expense categories
  const { data: expenseCategories } = useQuery({
    queryKey: ['expense_categories', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, account_name, account_number, account_type')
        .eq('is_active', true)
        .order('account_number');

      if (error) throw error;
      return data;
    },
  });

  // Fetch contacts
  const { data: contacts } = useQuery({
    queryKey: ['contacts', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, contact_name, company_name')
        .eq('is_active', true)
        .order('contact_name');

      if (error) throw error;
      return data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (newTransaction: Partial<RecurringTransaction>) => {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .insert([newTransaction])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_transactions'] });
      toast.success('Recurring transaction created successfully');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to create recurring transaction: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedTransaction: Partial<RecurringTransaction> & { id: string }) => {
      const { id, ...updates } = updatedTransaction;
      const { data, error } = await supabase
        .from('recurring_transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_transactions'] });
      toast.success('Recurring transaction updated successfully');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update recurring transaction: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_transactions'] });
      toast.success('Recurring transaction deleted successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete recurring transaction: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      transaction_type: 'expense',
      name: '',
      description: '',
      amount: '',
      platform_id: '',
      expense_category_id: '',
      contact_id: '',
      account_id: '',
      frequency: 'monthly',
      interval_count: '1',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      auto_create: true,
      auto_post: false,
      days_in_advance: '0',
      is_active: true,
      payment_method: '',
      reference_number: '',
      notes: '',
    });
    setEditingTransaction(null);
  };

  const handleEdit = (transaction: RecurringTransaction) => {
    setEditingTransaction(transaction);
    setFormData({
      transaction_type: transaction.transaction_type,
      name: transaction.name,
      description: transaction.description || '',
      amount: transaction.amount.toString(),
      platform_id: transaction.platform_id || '',
      expense_category_id: transaction.expense_category_id || '',
      contact_id: transaction.contact_id || '',
      account_id: transaction.account_id || '',
      frequency: transaction.frequency,
      interval_count: transaction.interval_count.toString(),
      start_date: transaction.start_date,
      end_date: transaction.end_date || '',
      auto_create: transaction.auto_create,
      auto_post: transaction.auto_post,
      days_in_advance: transaction.days_in_advance.toString(),
      is_active: transaction.is_active,
      payment_method: transaction.payment_method || '',
      reference_number: transaction.reference_number || '',
      notes: transaction.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const transactionData = {
      transaction_type: formData.transaction_type,
      name: formData.name,
      description: formData.description || null,
      amount: parseFloat(formData.amount),
      currency_id: null, // Default to base currency
      platform_id: formData.platform_id || null,
      expense_category_id: formData.expense_category_id || null,
      contact_id: formData.contact_id || null,
      account_id: formData.account_id || null,
      frequency: formData.frequency,
      interval_count: parseInt(formData.interval_count),
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      auto_create: formData.auto_create,
      auto_post: formData.auto_post,
      days_in_advance: parseInt(formData.days_in_advance),
      is_active: formData.is_active,
      payment_method: formData.payment_method || null,
      reference_number: formData.reference_number || null,
      notes: formData.notes || null,
    };

    if (editingTransaction) {
      updateMutation.mutate({ ...transactionData, id: editingTransaction.id });
    } else {
      createMutation.mutate(transactionData);
    }
  };

  const filteredTransactions = transactions?.filter(transaction => {
    if (filterType === 'all') return true;
    return transaction.transaction_type === filterType;
  });

  const getFrequencyLabel = (frequency: string, count: number) => {
    if (count === 1) return frequency;
    return `Every ${count} ${frequency === 'yearly' ? 'years' : frequency.slice(0, -2) + 's'}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Recurring Transactions</h2>
          <p className="text-sm text-muted-foreground">
            Manage automated recurring income and expenses
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Recurring Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? 'Edit Recurring Transaction' : 'Add Recurring Transaction'}
              </DialogTitle>
              <DialogDescription>
                Set up automated recurring income or expenses
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transaction_type">Type *</Label>
                  <Select
                    value={formData.transaction_type}
                    onValueChange={(value: 'income' | 'expense') =>
                      setFormData({ ...formData, transaction_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Description *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Monthly OpenAI Subscription"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="platform_id">Platform</Label>
                  <Select
                    value={formData.platform_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, platform_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms?.filter(p =>
                        formData.transaction_type === 'income'
                          ? p.platform_type === 'revenue' || p.platform_type === 'both'
                          : p.platform_type === 'expense' || p.platform_type === 'both'
                      ).map((platform) => (
                        <SelectItem key={platform.id} value={platform.id}>
                          {platform.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.transaction_type === 'expense' && (
                  <div className="space-y-2">
                    <Label htmlFor="expense_category_id">Expense Category</Label>
                    <Select
                      value={formData.expense_category_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, expense_category_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories?.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.transaction_type === 'income' && (
                  <div className="space-y-2">
                    <Label htmlFor="contact_id">Customer</Label>
                    <Select
                      value={formData.contact_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, contact_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts?.filter((c: any) =>
                          c.contact_type === 'customer' || c.contact_type === 'both'
                        ).map((contact: any) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.company_name || contact.contact_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency *</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, frequency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval_count">Every</Label>
                  <Input
                    id="interval_count"
                    type="number"
                    min="1"
                    value={formData.interval_count}
                    onChange={(e) => setFormData({ ...formData, interval_count: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="days_in_advance">Days in Advance</Label>
                  <Input
                    id="days_in_advance"
                    type="number"
                    min="0"
                    value={formData.days_in_advance}
                    onChange={(e) => setFormData({ ...formData, days_in_advance: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date (Optional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Input
                  id="payment_method"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  placeholder="e.g., Credit Card, Bank Transfer"
                />
              </div>

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

              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="auto_create"
                    checked={formData.auto_create}
                    onChange={(e) => setFormData({ ...formData, auto_create: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="auto_create" className="font-normal">
                    Auto-create transactions
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="auto_post"
                    checked={formData.auto_post}
                    onChange={(e) => setFormData({ ...formData, auto_post: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="auto_post" className="font-normal">
                    Auto-post journal entries
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
                  {editingTransaction ? 'Update' : 'Create'}
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
          variant={filterType === 'income' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('income')}
        >
          Income
        </Button>
        <Button
          variant={filterType === 'expense' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('expense')}
        >
          Expense
        </Button>
      </div>

      {/* Transactions table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredTransactions && filteredTransactions.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">{transaction.name}</TableCell>
                  <TableCell>
                    <Badge variant={transaction.transaction_type === 'income' ? 'default' : 'destructive'}>
                      {transaction.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">
                    ${transaction.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {getFrequencyLabel(transaction.frequency, transaction.interval_count)}
                  </TableCell>
                  <TableCell>
                    {transaction.next_due_date ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(transaction.next_due_date), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={transaction.is_active ? 'default' : 'secondary'}>
                      {transaction.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(transaction)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this recurring transaction?')) {
                            deleteMutation.mutate(transaction.id);
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
          No recurring transactions found. Click "Add Recurring Transaction" to create one.
        </div>
      )}
    </div>
  );
};

export default RecurringTransactionsManager;
