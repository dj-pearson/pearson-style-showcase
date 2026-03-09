import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, FileText, ExternalLink, Download, Edit, Eye, Upload as UploadIcon, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { DocumentUpload } from './DocumentUpload';

interface Invoice {
  id: string;
  invoice_type: 'sales' | 'purchase';
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  amount_paid: number;
  amount_due: number;
  status: string;
  import_source: string | null;
  external_url: string | null;
  external_id: string | null;
  contact_id: string | null;
  currency_id: string | null;
  notes: string | null;
  contacts?: { contact_name: string } | null;
}

interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  expense_category_id?: string;
}

interface ParsedInvoiceData {
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  total_amount?: number;
  vendor_name?: string;
  notes?: string;
  line_items?: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
}

export const InvoicesManager = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'sales' | 'purchase'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [parsedInvoiceData, setParsedInvoiceData] = useState<ParsedInvoiceData | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch invoices using TanStack Query
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', filterType, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*, contacts(contact_name)')
        .order('invoice_date', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('invoice_type', filterType);
      }
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Invoice[];
    },
  });

  // Fetch invoice line items for viewing
  const { data: selectedInvoiceItems = [] } = useQuery({
    queryKey: ['invoice_items', selectedInvoice?.id],
    queryFn: async () => {
      if (!selectedInvoice?.id) return [];
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', selectedInvoice.id)
        .order('line_number');

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedInvoice?.id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      // Delete items first
      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
      const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Success', description: 'Invoice deleted' });
    },
    onError: (error) => {
      logger.error('Error deleting invoice:', error);
      toast({ title: 'Error', description: 'Failed to delete invoice', variant: 'destructive' });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === 'paid') {
        const invoice = invoices.find(i => i.id === id);
        if (invoice) {
          updates.amount_paid = invoice.total_amount;
          updates.amount_due = 0;
        }
      }
      const { error } = await supabase.from('invoices').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Success', description: 'Invoice status updated' });
    },
    onError: (error) => {
      logger.error('Error updating status:', error);
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      paid: 'default',
      partially_paid: 'secondary',
      draft: 'outline',
      sent: 'secondary',
      overdue: 'destructive',
      cancelled: 'outline',
      void: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.replace('_', ' ')}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleExportCSV = () => {
    const csvLines: string[] = [];
    csvLines.push('Invoice #,Type,Contact,Date,Due Date,Total,Paid,Due,Status,Source');

    invoices.forEach((inv) => {
      csvLines.push([
        `"${inv.invoice_number}"`,
        inv.invoice_type,
        `"${inv.contacts?.contact_name || ''}"`,
        inv.invoice_date,
        inv.due_date || '',
        inv.total_amount.toFixed(2),
        inv.amount_paid.toFixed(2),
        inv.amount_due.toFixed(2),
        inv.status,
        inv.import_source || 'manual',
      ].join(','));
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `invoices-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Invoices & Bills</CardTitle>
              <CardDescription>Manage sales invoices and purchase bills</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Upload & Parse
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Upload Invoice or Bill</DialogTitle>
                    <DialogDescription>
                      Upload a PDF or image. AI will extract data automatically.
                    </DialogDescription>
                  </DialogHeader>
                  <DocumentUpload
                    documentType="invoice"
                    relatedEntityType="invoice"
                    relatedEntityId={selectedInvoice?.id}
                    autoProcess={true}
                    showExistingDocuments={false}
                    onUploadComplete={async (documentId, parsedData) => {
                      if (parsedData) {
                        const extractedData: ParsedInvoiceData = {
                          invoice_number: parsedData.invoice_number || parsedData.invoiceNumber || '',
                          invoice_date: parsedData.invoice_date || parsedData.invoiceDate || parsedData.date || '',
                          due_date: parsedData.due_date || parsedData.dueDate || '',
                          total_amount: parseFloat(parsedData.total_amount || parsedData.totalAmount || parsedData.amount || '0'),
                          vendor_name: parsedData.vendor_name || parsedData.vendorName || parsedData.from || '',
                          notes: parsedData.description || parsedData.notes || '',
                          line_items: parsedData.line_items || parsedData.items || [],
                        };

                        // Auto-create draft invoice from parsed data
                        try {
                          const lineItems = extractedData.line_items || [];
                          const totalAmount = extractedData.total_amount || 0;

                          const invoiceData = {
                            invoice_type: 'purchase' as const,
                            invoice_number: extractedData.invoice_number || `SCAN-${Date.now()}`,
                            invoice_date: extractedData.invoice_date || new Date().toISOString().split('T')[0],
                            due_date: extractedData.due_date || null,
                            subtotal: totalAmount,
                            total_amount: totalAmount,
                            amount_due: totalAmount,
                            amount_paid: 0,
                            status: 'draft',
                            import_source: 'ai_scan',
                            notes: extractedData.vendor_name
                              ? `Vendor: ${extractedData.vendor_name}${extractedData.notes ? '\n' + extractedData.notes : ''}`
                              : extractedData.notes || null,
                          };

                          const { data: inserted, error: insertError } = await supabase
                            .from('invoices')
                            .insert([invoiceData])
                            .select()
                            .single();

                          if (insertError) throw insertError;

                          // Insert line items if available
                          const validItems = lineItems.filter((item: any) => item.description);
                          if (validItems.length > 0 && inserted) {
                            const items = validItems.map((item: any, index: number) => ({
                              invoice_id: inserted.id,
                              line_number: index + 1,
                              description: item.description,
                              quantity: item.quantity || 1,
                              unit_price: item.unit_price || item.amount || item.total || 0,
                              line_total: item.amount || item.total || ((item.quantity || 1) * (item.unit_price || 0)),
                            }));

                            await supabase.from('invoice_items').insert(items);
                          }

                          // Link document to invoice
                          await supabase
                            .from('accounting_documents')
                            .update({
                              related_entity_type: 'invoice',
                              related_entity_id: inserted.id,
                            })
                            .eq('id', documentId);

                          queryClient.invalidateQueries({ queryKey: ['invoices'] });
                          setShowUploadDialog(false);
                          toast({
                            title: 'Draft invoice created',
                            description: `Invoice ${invoiceData.invoice_number} created from scan. Review and approve.`,
                          });
                        } catch (error) {
                          logger.error('Failed to auto-create invoice:', error);
                          // Fall back to manual form
                          setParsedInvoiceData(extractedData);
                          setShowUploadDialog(false);
                          setShowCreateDialog(true);
                          toast({
                            title: 'Data extracted',
                            description: 'Auto-create failed. Review and save manually.',
                            variant: 'destructive',
                          });
                        }
                      } else {
                        setShowUploadDialog(false);
                        setShowCreateDialog(true);
                      }
                    }}
                    onError={(error) => logger.error('Upload error:', error)}
                  />
                </DialogContent>
              </Dialog>

              <Dialog open={showCreateDialog} onOpenChange={(open) => {
                setShowCreateDialog(open);
                if (!open) {
                  setParsedInvoiceData(null);
                  setEditingInvoice(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
                    </DialogTitle>
                    <DialogDescription>
                      {parsedInvoiceData
                        ? 'Review the auto-filled data from the uploaded document'
                        : editingInvoice
                          ? 'Update invoice details and line items'
                          : 'Create a new sales invoice or purchase bill'}
                    </DialogDescription>
                  </DialogHeader>
                  <InvoiceForm
                    existingInvoice={editingInvoice}
                    onClose={() => {
                      setShowCreateDialog(false);
                      setParsedInvoiceData(null);
                      setEditingInvoice(null);
                    }}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ['invoices'] });
                    }}
                    initialData={parsedInvoiceData}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sales">Sales Invoices</SelectItem>
                <SelectItem value="purchase">Purchase Bills</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No invoices found</p>
              <p className="text-sm">Create your first invoice or import from integrations</p>
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
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{invoice.invoice_type}</Badge>
                      </TableCell>
                      <TableCell>{invoice.contacts?.contact_name || '-'}</TableCell>
                      <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                      <TableCell>{invoice.due_date ? formatDate(invoice.due_date) : '-'}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(invoice.total_amount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(invoice.amount_paid)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(invoice.amount_due)}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        {invoice.import_source ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{invoice.import_source}</Badge>
                            {invoice.external_url && (
                              <a
                                href={invoice.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline">manual</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowViewDialog(true);
                            }}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingInvoice(invoice);
                              setShowCreateDialog(true);
                            }}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {invoice.status !== 'paid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: 'paid' })}
                              title="Mark as paid"
                            >
                              <span className="text-xs font-medium text-green-600">Paid</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Delete invoice ${invoice.invoice_number}?`)) {
                                deleteMutation.mutate(invoice.id);
                              }
                            }}
                            title="Delete"
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

      {/* View Invoice Dialog */}
      <Dialog open={showViewDialog} onOpenChange={(open) => {
        setShowViewDialog(open);
        if (!open) setSelectedInvoice(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <p className="font-medium capitalize">{selectedInvoice.invoice_type}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div>{getStatusBadge(selectedInvoice.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Contact</Label>
                  <p className="font-medium">{selectedInvoice.contacts?.contact_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="font-medium">{formatDate(selectedInvoice.invoice_date)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Due Date</Label>
                  <p className="font-medium">{selectedInvoice.due_date ? formatDate(selectedInvoice.due_date) : '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Source</Label>
                  <p className="font-medium">{selectedInvoice.import_source || 'manual'}</p>
                </div>
              </div>

              {/* Line Items */}
              {selectedInvoiceItems.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Line Items</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoiceItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Number(item.unit_price))}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Number(item.line_total))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Total</span>
                  <span className="font-mono font-bold">{formatCurrency(selectedInvoice.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Paid</span>
                  <span className="font-mono text-green-600">{formatCurrency(selectedInvoice.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Due</span>
                  <span className="font-mono text-red-600">{formatCurrency(selectedInvoice.amount_due)}</span>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="border-t pt-4">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Full invoice form with contact selection and line items
const InvoiceForm = ({
  existingInvoice,
  onClose,
  onSuccess,
  initialData,
}: {
  existingInvoice?: Invoice | null;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: ParsedInvoiceData | null;
}) => {
  const isEditing = !!existingInvoice;

  const [formData, setFormData] = useState({
    invoice_type: existingInvoice?.invoice_type || 'purchase',
    invoice_number: existingInvoice?.invoice_number || initialData?.invoice_number || '',
    invoice_date: existingInvoice?.invoice_date || initialData?.invoice_date || new Date().toISOString().split('T')[0],
    due_date: existingInvoice?.due_date || initialData?.due_date || '',
    contact_id: existingInvoice?.contact_id || '',
    status: existingInvoice?.status || 'draft',
    notes: existingInvoice?.notes || initialData?.notes || (initialData?.vendor_name ? `Vendor: ${initialData.vendor_name}` : ''),
  });

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(
    initialData?.line_items?.map((item) => ({
      description: item.description,
      quantity: item.quantity || 1,
      unit_price: item.unit_price || item.total || 0,
      line_total: item.total || (item.quantity || 1) * (item.unit_price || 0),
    })) || (initialData?.total_amount ? [{
      description: initialData.vendor_name ? `${initialData.vendor_name} charges` : 'Service charges',
      quantity: 1,
      unit_price: initialData.total_amount,
      line_total: initialData.total_amount,
    }] : [{
      description: '',
      quantity: 1,
      unit_price: 0,
      line_total: 0,
    }])
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch contacts for dropdown
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', 'invoice-form'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, contact_name, contact_type')
        .eq('is_active', true)
        .order('contact_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch expense categories for line items
  const { data: expenseCategories = [] } = useQuery({
    queryKey: ['expense_categories', 'invoice-form'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('id, name, category_code')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Load existing line items when editing
  const { data: existingItems = [] } = useQuery({
    queryKey: ['invoice_items', existingInvoice?.id],
    queryFn: async () => {
      if (!existingInvoice?.id) return [];
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', existingInvoice.id)
        .order('line_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!existingInvoice?.id,
  });

  // Populate line items from existing when editing
  useState(() => {
    if (existingItems.length > 0 && lineItems.length === 1 && !lineItems[0].description) {
      setLineItems(existingItems.map((item: any) => ({
        id: item.id,
        description: item.description || '',
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        line_total: Number(item.line_total || 0),
        expense_category_id: item.expense_category_id,
      })));
    }
  });

  const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate line total
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].line_total = (Number(updated[index].quantity) || 0) * (Number(updated[index].unit_price) || 0);
    }

    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0, line_total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const invoiceData = {
        invoice_type: formData.invoice_type,
        invoice_number: formData.invoice_number,
        invoice_date: formData.invoice_date,
        due_date: formData.due_date || null,
        contact_id: formData.contact_id && formData.contact_id !== 'none' ? formData.contact_id : null,
        subtotal: subtotal,
        total_amount: subtotal,
        amount_due: subtotal,
        amount_paid: 0,
        status: formData.status,
        import_source: isEditing ? existingInvoice.import_source : 'manual',
        notes: formData.notes || null,
      };

      let invoiceId: string;

      if (isEditing) {
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', existingInvoice.id);
        if (error) throw error;
        invoiceId = existingInvoice.id;

        // Delete existing items and re-insert
        await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
      } else {
        const { data: inserted, error } = await supabase
          .from('invoices')
          .insert([invoiceData])
          .select()
          .single();
        if (error) throw error;
        invoiceId = inserted.id;
      }

      // Insert line items
      const validItems = lineItems.filter(item => item.description.trim() && item.line_total > 0);
      if (validItems.length > 0) {
        const items = validItems.map((item, index) => ({
          invoice_id: invoiceId,
          line_number: index + 1,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          expense_category_id: item.expense_category_id && item.expense_category_id !== 'none' ? item.expense_category_id : null,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(items);
        if (itemsError) throw itemsError;
      }

      toast({
        title: 'Success',
        description: isEditing ? 'Invoice updated' : 'Invoice created',
      });

      onSuccess();
      onClose();
    } catch (error) {
      logger.error('Error saving invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to save invoice',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={formData.invoice_type}
            onValueChange={(value) => setFormData({ ...formData, invoice_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Sales Invoice</SelectItem>
              <SelectItem value="purchase">Purchase Bill</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Invoice Number</Label>
          <Input
            value={formData.invoice_number}
            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
            placeholder="INV-001"
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partially_paid">Partially Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Contact</Label>
          <Select
            value={formData.contact_id}
            onValueChange={(value) => setFormData({ ...formData, contact_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select contact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No contact</SelectItem>
              {contacts.map((contact: any) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.contact_name} ({contact.contact_type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Invoice Date</Label>
          <Input
            type="date"
            value={formData.invoice_date}
            onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Due Date</Label>
          <Input
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          />
        </div>
      </div>

      {/* Line Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Line Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
            <Plus className="h-3 w-3 mr-1" />
            Add Line
          </Button>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Description</TableHead>
                <TableHead className="w-[15%]">Category</TableHead>
                <TableHead className="text-right w-[12%]">Qty</TableHead>
                <TableHead className="text-right w-[15%]">Unit Price</TableHead>
                <TableHead className="text-right w-[13%]">Total</TableHead>
                <TableHead className="w-[5%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="p-1">
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="border-0 shadow-none"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={item.expense_category_id || ''}
                      onValueChange={(value) => updateLineItem(index, 'expense_category_id', value)}
                    >
                      <SelectTrigger className="border-0 shadow-none">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {expenseCategories.map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="text-right border-0 shadow-none"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="text-right border-0 shadow-none"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono p-2">
                    ${item.line_total.toFixed(2)}
                  </TableCell>
                  <TableCell className="p-1">
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end pt-2">
          <div className="text-right">
            <span className="text-sm text-muted-foreground mr-4">Subtotal:</span>
            <span className="font-mono font-bold text-lg">${subtotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Invoice' : 'Create Invoice'}
        </Button>
      </div>
    </form>
  );
};
