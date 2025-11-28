import { useState } from 'react';
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
import { Plus, CreditCard, Pencil, Trash2, Link, ArrowDown, ArrowUp, Upload as UploadIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { DocumentUpload } from './DocumentUpload';

interface Payment {
  id: string;
  payment_type: 'received' | 'made';
  payment_number: string;
  contact_id: string | null;
  payment_date: string;
  amount: number;
  currency_id: string | null;
  payment_method: string | null;
  reference_number: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  import_source: string | null;
  external_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: 'sales' | 'purchase';
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  invoice_date: string;
}

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Credit Card',
  'Debit Card',
  'Cash',
  'Check',
  'PayPal',
  'Stripe',
  'Wire Transfer',
  'Other',
];

const getDefaultFormData = () => ({
  payment_type: 'received' as 'received' | 'made',
  payment_number: '',
  contact_id: '',
  payment_date: new Date().toISOString().split('T')[0],
  amount: '',
  payment_method: 'Bank Transfer',
  reference_number: '',
  from_account_id: '',
  to_account_id: '',
  notes: '',
});

export const PaymentsManager = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAllocateDialogOpen, setIsAllocateDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [allocatingPayment, setAllocatingPayment] = useState<Payment | null>(null);
  const [selectedPaymentForUpload, setSelectedPaymentForUpload] = useState<Payment | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'received' | 'made'>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState(getDefaultFormData());

  const [allocationData, setAllocationData] = useState<{
    invoice_id: string;
    amount: string;
  }[]>([]);

  // Fetch payments with contact information
  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', filterType],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('*, contacts(contact_name)')
        .order('payment_date', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('payment_type', filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Payment & { contacts?: { contact_name: string } })[];
    },
  });

  // Fetch contacts
  const { data: contacts } = useQuery({
    queryKey: ['contacts', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, contact_name, company_name, contact_type')
        .eq('is_active', true)
        .order('contact_name');

      if (error) throw error;
      return data;
    },
  });

  // Fetch accounts
  const { data: _ } = useQuery({
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

  // Fetch unpaid invoices for allocation
  const { data: unpaidInvoices } = useQuery({
    queryKey: ['invoices', 'unpaid', allocatingPayment?.id],
    enabled: !!allocatingPayment,
    queryFn: async () => {
      if (!allocatingPayment) return [];

      const invoiceType = allocatingPayment.payment_type === 'received' ? 'sales' : 'purchase';

      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('invoice_type', invoiceType)
        .gt('amount_due', 0)
        .order('invoice_date', { ascending: true });

      if (error) throw error;
      return data as Invoice[];
    },
  });

  // Generate next payment number
  const generatePaymentNumber = async (type: 'received' | 'made') => {
    const prefix = type === 'received' ? 'PMT-R' : 'PMT-P';
    const { data, error } = await supabase
      .from('payments')
      .select('payment_number')
      .like('payment_number', `${prefix}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error('Error generating payment number:', error);
      return `${prefix}-${Date.now()}`;
    }

    if (!data || data.length === 0) {
      return `${prefix}-0001`;
    }

    const lastNumber = data[0].payment_number.split('-').pop();
    const nextNumber = (parseInt(lastNumber || '0') + 1).toString().padStart(4, '0');
    return `${prefix}-${nextNumber}`;
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (newPayment: Partial<Payment>) => {
      const paymentNumber = await generatePaymentNumber(newPayment.payment_type!);

      const { data, error } = await supabase
        .from('payments')
        .insert([{ ...newPayment, payment_number: paymentNumber }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast({ title: 'Success', description: 'Payment recorded successfully' });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      logger.error('Error creating payment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to record payment',
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedPayment: Partial<Payment> & { id: string }) => {
      const { id, ...updates } = updatedPayment;
      const { data, error } = await supabase
        .from('payments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast({ title: 'Success', description: 'Payment updated successfully' });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      logger.error('Error updating payment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update payment',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast({ title: 'Success', description: 'Payment deleted successfully' });
    },
    onError: (error: any) => {
      logger.error('Error deleting payment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete payment',
        variant: 'destructive',
      });
    },
  });

  // Allocate payment to invoices
  const allocateMutation = useMutation({
    mutationFn: async (allocations: { payment_id: string; invoice_id: string; amount_allocated: number }[]) => {
      const { error } = await supabase
        .from('payment_allocations')
        .insert(allocations);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Success', description: 'Payment allocated successfully' });
      setIsAllocateDialogOpen(false);
      setAllocationData([]);
    },
    onError: (error: any) => {
      logger.error('Error allocating payment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to allocate payment',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      payment_type: 'received',
      payment_number: '',
      contact_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_method: 'Bank Transfer',
      reference_number: '',
      from_account_id: '',
      to_account_id: '',
      notes: '',
    });
    setEditingPayment(null);
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      payment_type: payment.payment_type,
      payment_number: payment.payment_number,
      contact_id: payment.contact_id || '',
      payment_date: payment.payment_date,
      amount: payment.amount.toString(),
      payment_method: payment.payment_method || 'Bank Transfer',
      reference_number: payment.reference_number || '',
      from_account_id: payment.from_account_id || '',
      to_account_id: payment.to_account_id || '',
      notes: payment.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const paymentData = {
      payment_type: formData.payment_type,
      contact_id: formData.contact_id || null,
      payment_date: formData.payment_date,
      amount: parseFloat(formData.amount),
      currency_id: null,
      payment_method: formData.payment_method || null,
      reference_number: formData.reference_number || null,
      from_account_id: formData.from_account_id || null,
      to_account_id: formData.to_account_id || null,
      notes: formData.notes || null,
    };

    if (editingPayment) {
      updateMutation.mutate({ ...paymentData, id: editingPayment.id });
    } else {
      createMutation.mutate(paymentData);
    }
  };

  const handleDelete = (payment: Payment) => {
    if (confirm(`Are you sure you want to delete payment "${payment.payment_number}"?`)) {
      deleteMutation.mutate(payment.id);
    }
  };

  const handleAllocate = (payment: Payment) => {
    setAllocatingPayment(payment);
    setIsAllocateDialogOpen(true);
  };

  const handleAllocateSubmit = () => {
    if (!allocatingPayment) return;

    const allocations = allocationData
      .filter(a => a.invoice_id && parseFloat(a.amount) > 0)
      .map(a => ({
        payment_id: allocatingPayment.id,
        invoice_id: a.invoice_id,
        amount_allocated: parseFloat(a.amount),
      }));

    if (allocations.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one invoice and amount',
        variant: 'destructive',
      });
      return;
    }

    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount_allocated, 0);
    if (totalAllocated > allocatingPayment.amount) {
      toast({
        title: 'Error',
        description: 'Total allocated amount exceeds payment amount',
        variant: 'destructive',
      });
      return;
    }

    allocateMutation.mutate(allocations);
  };

  const addAllocationRow = () => {
    setAllocationData([...allocationData, { invoice_id: '', amount: '' }]);
  };

  const removeAllocationRow = (index: number) => {
    setAllocationData(allocationData.filter((_, i) => i !== index));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (date: string) => {
    return format(parseISO(date), 'MMM d, yyyy');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payments</CardTitle>
              <CardDescription>Track payments received and made</CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Upload Receipt
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Upload Payment Proof or Receipt</DialogTitle>
                    <DialogDescription>
                      Upload a receipt or payment confirmation. Our AI will automatically extract the data.
                    </DialogDescription>
                  </DialogHeader>
                  <DocumentUpload
                    documentType="payment_proof"
                    relatedEntityType="payment"
                    relatedEntityId={selectedPaymentForUpload?.id}
                    autoProcess={true}
                    showExistingDocuments={false}
                    onUploadComplete={(documentId, parsedData) => {
                      logger.log('Payment document uploaded and parsed:', parsedData);

                      if (parsedData) {
                        // Auto-populate payment form with parsed data
                        setFormData({
                          ...getDefaultFormData(),
                          payment_type: parsedData.payment_type || 'received',
                          payment_number: parsedData.payment_number || parsedData.reference || parsedData.transactionId || '',
                          payment_date: parsedData.payment_date || parsedData.date || new Date().toISOString().split('T')[0],
                          amount: (parsedData.amount || parsedData.total || '').toString(),
                          payment_method: parsedData.payment_method || parsedData.method || 'Bank Transfer',
                          reference_number: parsedData.reference_number || parsedData.reference || '',
                          notes: parsedData.description || parsedData.notes || '',
                        });

                        setIsUploadDialogOpen(false);
                        setIsDialogOpen(true);

                        toast({
                          title: 'Data extracted successfully',
                          description: 'Payment data has been auto-filled. Please review and save.',
                        });
                      } else {
                        setIsUploadDialogOpen(false);
                      }

                      queryClient.invalidateQueries({ queryKey: ['payments'] });
                    }}
                    onError={(error) => {
                      logger.error('Upload error:', error);
                    }}
                  />
                </DialogContent>
              </Dialog>

              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) resetForm();
                }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingPayment ? 'Edit Payment' : 'Record New Payment'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingPayment ? 'Update payment information' : 'Record a payment received or made'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment_type">Type *</Label>
                      <Select
                        value={formData.payment_type}
                        onValueChange={(value: 'received' | 'made') =>
                          setFormData({ ...formData, payment_type: value })
                        }
                        disabled={!!editingPayment}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="received">Payment Received</SelectItem>
                          <SelectItem value="made">Payment Made</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment_date">Date *</Label>
                      <Input
                        id="payment_date"
                        type="date"
                        value={formData.payment_date}
                        onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                    <div className="space-y-2">
                      <Label htmlFor="contact_id">
                        {formData.payment_type === 'received' ? 'Customer' : 'Vendor'}
                      </Label>
                      <Select
                        value={formData.contact_id}
                        onValueChange={(value) => setFormData({ ...formData, contact_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select contact" />
                        </SelectTrigger>
                        <SelectContent>
                          {contacts
                            ?.filter((c: any) =>
                              formData.payment_type === 'received'
                                ? c.contact_type === 'customer' || c.contact_type === 'both'
                                : c.contact_type === 'vendor' || c.contact_type === 'both'
                            )
                            .map((contact: any) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.company_name || contact.contact_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment_method">Payment Method</Label>
                      <Select
                        value={formData.payment_method}
                        onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method} value={method}>
                              {method}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reference_number">Reference Number</Label>
                      <Input
                        id="reference_number"
                        value={formData.reference_number}
                        onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                        placeholder="Check #, Transaction ID, etc."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes about this payment"
                      rows={2}
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => {
                      resetForm();
                      setIsDialogOpen(false);
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingPayment ? 'Update' : 'Record'} Payment
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
              </Dialog>
            </div>
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
              variant={filterType === 'received' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('received')}
            >
              <ArrowDown className="h-3 w-3 mr-1" />
              Received
            </Button>
            <Button
              variant={filterType === 'made' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('made')}
            >
              <ArrowUp className="h-3 w-3 mr-1" />
              Made
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : payments && payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payments recorded</p>
              <p className="text-sm">Record your first payment or import from integrations</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments?.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">
                        {payment.payment_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant={payment.payment_type === 'received' ? 'default' : 'secondary'}>
                          <span className="flex items-center gap-1">
                            {payment.payment_type === 'received' ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUp className="h-3 w-3" />
                            )}
                            {payment.payment_type}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>{payment.contacts?.contact_name || '-'}</TableCell>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell className="text-sm">{payment.payment_method || '-'}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedPaymentForUpload(payment);
                              setIsUploadDialogOpen(true);
                            }}
                            title="Upload receipt/proof"
                          >
                            <UploadIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAllocate(payment)}
                            title="Allocate to invoices"
                          >
                            <Link className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(payment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(payment)}
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

      {/* Allocate Payment Dialog */}
      <Dialog open={isAllocateDialogOpen} onOpenChange={setIsAllocateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Allocate Payment to Invoices</DialogTitle>
            <DialogDescription>
              Payment: {allocatingPayment?.payment_number} - {allocatingPayment && formatCurrency(allocatingPayment.amount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Available Invoices</Label>
              <p className="text-sm text-muted-foreground">
                Select invoices and enter allocation amounts
              </p>
            </div>

            {allocationData.map((allocation, index) => (
              <div key={index} className="grid grid-cols-[1fr,120px,40px] gap-2 items-end">
                <div>
                  <Select
                    value={allocation.invoice_id}
                    onValueChange={(value) => {
                      const newData = [...allocationData];
                      newData[index].invoice_id = value;
                      setAllocationData(newData);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      {unpaidInvoices?.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - {formatCurrency(invoice.amount_due)} due
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={allocation.amount}
                  onChange={(e) => {
                    const newData = [...allocationData];
                    newData[index].amount = e.target.value;
                    setAllocationData(newData);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAllocationRow(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addAllocationRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add Invoice
            </Button>

            <div className="pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span>Total Allocated:</span>
                <span className="font-mono">
                  {formatCurrency(
                    allocationData.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Payment Amount:</span>
                <span className="font-mono">
                  {allocatingPayment && formatCurrency(allocatingPayment.amount)}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1 font-semibold">
                <span>Remaining:</span>
                <span className="font-mono">
                  {allocatingPayment &&
                    formatCurrency(
                      allocatingPayment.amount -
                        allocationData.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
                    )}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setIsAllocateDialogOpen(false);
              setAllocationData([]);
            }}>
              Cancel
            </Button>
            <Button onClick={handleAllocateSubmit}>
              Allocate Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
